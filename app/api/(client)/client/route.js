import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { google } from "googleapis";
import dbConnect from "@/config/connectDB";
import Customer from "@/models/client";
import Status from "@/models/status";

const tag = "customer_data";

async function getGoogleSheetsClient() {
  const scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    projectId: process.env.GOOGLE_PROJECT_ID,
    scopes,
  });
  return google.sheets({ version: "v4", auth });
}

// export async function GET(request) {
//   await dbConnect();
//   try {
//     const { searchParams } = new URL(request.url);
//     const page = parseInt(searchParams.get("page")) || 1;
//     const limit = parseInt(searchParams.get("limit")) || 10;
//     const query = searchParams.get("query");
//     const status = searchParams.get("status");
//     const campaign = searchParams.get("campaign");
//     // Lấy tham số mới để lọc UID
//     const uidStatus = searchParams.get("uidStatus");

//     const skip = (page - 1) * limit;
//     const filter = {};

//     if (status) filter.status = status;
//     if (campaign) filter.campaign = campaign;

//     // --- THÊM LOGIC LỌC THEO TRẠNG THÁI UID ---
//     if (uidStatus === "exists") {
//       // Lọc những bản ghi có trường uid tồn tại và không phải là chuỗi rỗng
//       filter.uid = { $exists: true, $ne: "" };
//     } else if (uidStatus === "missing") {
//       // Lọc những bản ghi không có trường uid hoặc uid là chuỗi rỗng
//       filter.$or = [{ uid: { $exists: false } }, { uid: "" }];
//     }

//     const trimmedQuery = query?.trim();
//     if (trimmedQuery) {
//       if (filter.$or) {
//         filter.$and = [
//           { $or: filter.$or },
//           {
//             $or: [
//               { name: { $regex: trimmedQuery, $options: "i" } },
//               { phone: { $regex: trimmedQuery, $options: "i" } },
//             ],
//           },
//         ];
//         delete filter.$or;
//       } else {
//         filter.$or = [
//           { name: { $regex: trimmedQuery, $options: "i" } },
//           { phone: { $regex: trimmedQuery, $options: "i" } },
//         ];
//       }
//     }

//     const [data, total] = await Promise.all([
//       Customer.find(filter)
//         .populate("status", "name")
//         .sort({ createdAt: -1, _id: 1 })
//         .skip(skip)
//         .limit(limit)
//         .lean(),
//       Customer.countDocuments(filter),
//     ]);

//     return NextResponse.json({
//       status: true,
//       data,
//       pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
//     });
//   } catch (error) {
//     return NextResponse.json(
//       { status: false, message: "Server Error", error: error.message },
//       { status: 500 },
//     );
//   }
// }

export async function GET(request) {
  await dbConnect();
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const query = searchParams.get("query");
    const statusName = searchParams.get("status");
    const uidStatus = searchParams.get("uidStatus");
    const campaign = searchParams.get("campaign");

    const skip = (page - 1) * limit;
    const filterConditions = [];

    if (statusName) {
      const statusDoc = await Status.findOne({ name: statusName })
        .select("_id")
        .lean();
      if (statusDoc) {
        filterConditions.push({ status: statusDoc._id });
      } else {
        return NextResponse.json({
          status: true,
          data: [],
          pagination: { total: 0, page, limit, totalPages: 0 },
        });
      }
    }

    if (campaign) {
      filterConditions.push({ campaign: campaign });
    }

    if (uidStatus === "exists") {
      filterConditions.push({ uid: { $exists: true, $ne: "", $ne: null } });
    } else if (uidStatus === "missing") {
      filterConditions.push({
        $or: [{ uid: { $exists: false } }, { uid: "" }, { uid: null }],
      });
    }

    const trimmedQuery = query?.trim();
    if (trimmedQuery) {
      filterConditions.push({
        $or: [
          { name: { $regex: trimmedQuery, $options: "i" } },
          { phone: { $regex: trimmedQuery, $options: "i" } },
        ],
      });
    }

    const filter =
      filterConditions.length > 0 ? { $and: filterConditions } : {};

    // ▼▼▼ DÒNG DEBUG QUAN TRỌNG ▼▼▼
    console.log(
      "FINAL FILTER SENT TO MONGODB:",
      JSON.stringify(filter, null, 2),
    );
    // ▲▲▲ DÒNG DEBUG QUAN TRỌNG ▲▲▲

    const [data, total] = await Promise.all([
      Customer.find(filter)
        .populate("status", "name")
        .sort({ createdAt: -1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(filter),
    ]);

    return NextResponse.json({
      status: true,
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("API GET Error:", error);
    return NextResponse.json(
      { status: false, message: "Server Error", error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  await dbConnect();
  try {
    const { spreadsheetId, range } = await request.json();
    if (!spreadsheetId || !range) {
      return NextResponse.json(
        {
          status: false,
          mes: "Vui lòng cung cấp spreadsheetId và range.",
          data: [],
        },
        { status: 400 },
      );
    }

    const sheets = await getGoogleSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const rows = response.data.values ?? [];

    if (rows.length < 2) {
      return NextResponse.json({
        status: true,
        mes: "Google Sheet không có dữ liệu.",
        data: [],
      });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const phoneIndex = headers.indexOf("phone");
    const nameIndex = headers.indexOf("nameStudent");
    const uidIndex = headers.indexOf("uid");

    if (phoneIndex === -1) {
      return NextResponse.json(
        {
          status: false,
          mes: 'Không tìm thấy cột "phone" trong Google Sheet.',
          data: [],
        },
        { status: 400 },
      );
    }

    // ----- BƯỚC 1: LỌC TRÙNG LẶP NGAY TRONG GOOGLE SHEET -----
    const processedPhonesInSheet = new Set();
    const validCustomersFromSheet = [];

    for (const row of dataRows) {
      let phone = row[phoneIndex] || "";
      if (!phone) continue;

      // Chuẩn hóa SĐT
      phone = phone.toString().replace(/\s+/g, "");
      const phoneLength = phone.length;
      if (phoneLength < 9 || phoneLength > 11) continue;
      if (phone.length === 9 && phone[0] !== "0") phone = "0" + phone;
      if (phone.length === 10 && phone[0] !== "0") continue;
      if (phone.length === 11 && phone.startsWith("84"))
        phone = "0" + phone.substring(2);
      else if (phone.length === 11) continue;
      if (phone.length !== 10) continue;

      // Đảm bảo mỗi SĐT chỉ được xử lý một lần duy nhất từ sheet
      if (!processedPhonesInSheet.has(phone)) {
        processedPhonesInSheet.add(phone);
        validCustomersFromSheet.push({
          phone: phone,
          name: row[nameIndex] || "",
          uid: row[uidIndex] || "",
        });
      }
    }

    if (validCustomersFromSheet.length === 0) {
      return NextResponse.json({
        status: true,
        mes: "Không có khách hàng có số điện thoại hợp lệ nào trong Sheet.",
        data: [],
      });
    }

    // ----- BƯỚC 2: KIỂM TRA TRÙNG LẶP VỚI DATABASE -----
    // Lấy danh sách các SĐT duy nhất từ sheet để kiểm tra
    const phonesToCheck = Array.from(processedPhonesInSheet);

    // Tìm các khách hàng đã tồn tại trong DB với các SĐT này
    const existingCustomers = await Customer.find({
      phone: { $in: phonesToCheck },
    })
      .select("phone")
      .lean();
    const existingPhonesSet = new Set(existingCustomers.map((c) => c.phone));

    // Lọc lần cuối để chỉ giữ lại những khách hàng có phone CHƯA TỒN TẠI trong DB
    const customersToInsert = validCustomersFromSheet.filter(
      (c) => !existingPhonesSet.has(c.phone),
    );

    if (customersToInsert.length === 0) {
      return NextResponse.json({
        status: true,
        mes: "Tất cả khách hàng hợp lệ trong Sheet đã tồn tại trong database.",
        data: [],
      });
    }

    const result = await Customer.insertMany(customersToInsert);
    revalidateTag(tag);

    return NextResponse.json(
      {
        status: true,
        mes: `Đã thêm thành công ${result.length} khách hàng mới.`,
        data: result,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error.code === 11000) {
      return NextResponse.json(
        {
          status: false,
          mes: "Lỗi trùng lặp số điện thoại. Vui lòng kiểm tra lại.",
          error: error.message,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        status: false,
        mes: "Đã xảy ra lỗi phía server.",
        error: error.message,
      },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  await dbConnect();
  try {
    const body = await request.json();
    const { _id, status, ...otherFields } = body;

    if (!_id) {
      return NextResponse.json(
        { status: false, message: "_id is required for update." },
        { status: 400 },
      );
    }

    // --- BƯỚC 1: TÍNH TOÁN STAGE LEVEL (LOGIC CŨ CỦA BẠN) ---
    let stageLevel = 0;
    if (otherFields.study) {
      stageLevel = 3;
    } else if (otherFields.studyTry) {
      stageLevel = 2;
    } else if (otherFields.care) {
      stageLevel = 1;
    }

    // Gán giá trị stageLevel và các trường khác vào lệnh $set
    const updateOperation = {
      $set: {
        ...otherFields,
        stageLevel: stageLevel,
      },
    };

    // --- BƯỚC 2: XỬ LÝ TRẠNG THÁI ĐỘNG (LOGIC MỚI) ---
    if (status && status.trim() !== "") {
      // Nếu có status ID hợp lệ, thêm nó vào lệnh $set
      updateOperation.$set.status = status;
    } else {
      // Nếu status là rỗng, thêm lệnh $unset để xóa trường này
      updateOperation.$unset = { status: 1 };
    }

    // --- BƯỚC 3: THỰC THI LỆNH CẬP NHẬT ---
    const updatedCustomer = await Customer.findByIdAndUpdate(
      _id,
      updateOperation,
      { new: true },
    ).lean();

    if (!updatedCustomer) {
      return NextResponse.json(
        { status: false, message: "Customer not found." },
        { status: 404 },
      );
    }

    revalidateTag(tag);
    return NextResponse.json({ status: true, data: updatedCustomer });
  } catch (error) {
    if (error.name === "CastError") {
      return NextResponse.json(
        {
          status: false,
          message:
            "Lỗi định dạng dữ liệu, có thể do ID trạng thái không hợp lệ.",
          error: error.message,
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { status: false, message: "Server Error", error: error.message },
      { status: 500 },
    );
  }
}
