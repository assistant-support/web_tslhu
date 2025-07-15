// app/api/customer/route.js
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { google } from "googleapis";
import { Types } from "mongoose";
import dbConnect from "@/config/connectDB";
import Customer from "@/models/client";
import Status from "@/models/status";
import User from "@/models/users";
import jwt from "jsonwebtoken";
/* ─────────────── CONSTANTS ─────────────── */
const TAG = "customer_data";
const TARGET_EMAIL = "phihung.tgdd2003@gmail.com"; // email của nhân viên cần gán quyền
const COL_F_INDEX = 10; // cột F (0-based: A=0 … F=5)
const DATA_START_ROW = 385; // chỉ đọc từ dòng này trở xuống (1-based)
/* ────────────────────────────────────────── */

/* Google Sheets client (readonly) */
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

export async function GET(request) {
  /* 0. Lấy & xác thực token */
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { status: false, message: "Missing token" },
      { status: 401 },
    );
  }

  let decodedToken;
  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return NextResponse.json(
      { status: false, message: "Invalid/Expired token" },
      { status: 401 },
    );
  }
  /* decodedToken.id  => _id user
     decodedToken.role => mảng quyền */

  await dbConnect();

  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;
    const query = (searchParams.get("query") || "").trim();
    const statusId = searchParams.get("status")?.trim();
    const uidStatus = searchParams.get("uidStatus");

    /* 1. Xây filter động */
    const conditions = [];

    // Nếu KHÔNG phải admin ⇒ chỉ xem KH do mình phụ trách
    const isAdmin =
      Array.isArray(decodedToken.role) && decodedToken.role.includes("Admin");

    if (!isAdmin && Types.ObjectId.isValid(decodedToken.id)) {
      conditions.push({ auth: decodedToken.id }); // auth chứa _id user
    }

    /* bộ lọc status */
    if (statusId && Types.ObjectId.isValid(statusId)) {
      conditions.push({ status: statusId });
    }

    /* bộ lọc uid */
    if (uidStatus === "exists") {
      conditions.push({ uid: { $exists: true, $nin: ["", null] } });
    } else if (uidStatus === "missing") {
      conditions.push({
        $or: [{ uid: { $exists: false } }, { uid: "" }, { uid: null }],
      });
    }

    /* bộ lọc text */
    if (query) {
      conditions.push({
        $or: [
          { name: { $regex: query, $options: "i" } },
          { phone: { $regex: query, $options: "i" } },
        ],
      });
    }

    const filter = conditions.length ? { $and: conditions } : {};

    /* 2. Truy vấn & phân trang */
    const [data, total] = await Promise.all([
      Customer.find(filter)
        .populate("status", "_id name")
        .populate("auth", "name email")
        .sort({ createdAt: -1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(filter),
    ]);

    return NextResponse.json({
      status: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { status: false, message: "Server Error", error: err.message },
      { status: 500 },
    );
  }
}

/*───────────  POST (Hardcoded Sheet Info) ───────────*/
export async function POST(request) {
  await dbConnect();

  try {
    // Chỉ lấy các tham số động từ request body
    const { targetEmail, startRow } = await request.json();

    // Kiểm tra các tham số bắt buộc
    if (!targetEmail) {
      return NextResponse.json(
        { status: false, mes: "Vui lòng cung cấp targetEmail." },
        { status: 400 },
      );
    }

    // Gán cứng ID và Range của Google Sheet
    const spreadsheetId = "1atiuB7QC_pZiGzb4fwhrkh2wIgif3z4Hjyp3mWyNUvQ";
    const range = "Data!A:K";

    // Thiết lập các hằng số động
    const DATA_START_ROW = Number(startRow) || 1; // Mặc định là 1 nếu không có hoặc không hợp lệ
    const TARGET_EMAIL = targetEmail.trim().toLowerCase();
    const COL_F_INDEX = 10; // Cột K (index 10)

    // --- BƯỚC 1: LẤY ID CỦA NHÂN VIÊN CẦN GÁN QUYỀN ---
    const authUser = await User.findOne({ email: TARGET_EMAIL })
      .select("_id")
      .lean();
    if (!authUser) {
      return NextResponse.json(
        {
          status: false,
          mes: `Không tìm thấy nhân viên với email: ${TARGET_EMAIL}`,
        },
        { status: 404 },
      );
    }
    const authIdToAssign = authUser._id;

    // --- BƯỚC 2: ĐỌC VÀ CHUẨN HÓA DỮ LIỆU TỪ GOOGLE SHEET ---
    const sheets = await getGoogleSheetsClient();
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const rows = data.values ?? [];

    if (rows.length < DATA_START_ROW) {
      return NextResponse.json({
        status: true,
        mes: `Sheet chưa có tới dòng ${DATA_START_ROW}.`,
      });
    }

    const headers = rows[0].map((h) => h.trim());
    const dataRows = rows.slice(DATA_START_ROW - 1);

    const phoneIdx = headers.indexOf("phone");
    const parentPhoneIdx = headers.indexOf("Parent's Phone Number");
    const nameIdx = headers.indexOf("nameStudent");
    const uidIdx = headers.indexOf("uid");

    if (phoneIdx === -1 && parentPhoneIdx === -1) {
      return NextResponse.json(
        {
          status: false,
          mes: "Thiếu cột 'phone' hoặc 'Parent's Phone Number'.",
        },
        { status: 400 },
      );
    }

    // --- BƯỚC 3: LỌC & GOM DỮ LIỆU HỢP LỆ ---
    const processedPhones = new Set();
    const sheetRows = [];

    dataRows.forEach((row) => {
      let phone = (row[phoneIdx] || row[parentPhoneIdx] || "")
        .toString()
        .replace(/\s+/g, "");
      if (!phone) return;

      const len = phone.length;
      if (len < 9 || len > 11) return;
      if (len === 9 && phone[0] !== "0") phone = "0" + phone;
      if (len === 10 && phone[0] !== "0") return;
      if (len === 11 && phone.startsWith("84")) phone = "0" + phone.slice(2);
      else if (len === 11) return;
      if (phone.length !== 10) return;

      if (processedPhones.has(phone)) return;
      processedPhones.add(phone);

      const assignedEmail = (row[COL_F_INDEX] || "").trim().toLowerCase();

      sheetRows.push({
        phone,
        name: nameIdx !== -1 ? row[nameIdx] || "" : "",
        uid: uidIdx !== -1 ? row[uidIdx] || "" : "",
        needAuth: assignedEmail === TARGET_EMAIL,
      });
    });

    if (!sheetRows.length) {
      return NextResponse.json({
        status: true,
        mes: "Không tìm thấy số điện thoại hợp lệ trong vùng dữ liệu đã chọn.",
      });
    }

    // --- BƯỚC 4: TÁCH DỮ LIỆU MỚI VS. ĐÃ TỒN TẠI ---
    const phoneArr = [...processedPhones];
    const existingCustomers = await Customer.find({ phone: { $in: phoneArr } })
      .select("phone auth")
      .lean();
    const existingCustomerMap = new Map(
      existingCustomers.map((c) => [c.phone, c]),
    );

    // --- BƯỚC 5: PHÂN LOẠI INSERT / UPDATE ---
    const docsToInsert = [];
    const phonesToUpdateAuth = [];

    sheetRows.forEach((r) => {
      const existingCustomer = existingCustomerMap.get(r.phone);

      if (existingCustomer) {
        const isAuthAssigned = existingCustomer.auth?.some(
          (id) => id.toString() === authIdToAssign.toString(),
        );
        if (r.needAuth && !isAuthAssigned) {
          phonesToUpdateAuth.push(r.phone);
        }
      } else {
        const doc = { phone: r.phone, uid: r.uid, name: r.name };
        if (r.needAuth) {
          doc.auth = [authIdToAssign];
        }
        docsToInsert.push(doc);
      }
    });

    // --- BƯỚC 6: THỰC THI LỆNH ---
    let insertedCount = 0;
    if (docsToInsert.length) {
      try {
        const inserted = await Customer.insertMany(docsToInsert, {
          ordered: false,
        });
        insertedCount = inserted.length;
      } catch (err) {
        if (err.code === 11000) {
          insertedCount = err.result.nInserted || 0;
        } else {
          throw err;
        }
      }
    }

    let updatedCount = 0;
    if (phonesToUpdateAuth.length) {
      const res = await Customer.updateMany(
        { phone: { $in: phonesToUpdateAuth } },
        { $addToSet: { auth: authIdToAssign } },
      );
      updatedCount = res.modifiedCount || 0;
    }

    // --- BƯỚC 7: HOÀN TẤT ---
    revalidateTag(TAG);
    return NextResponse.json(
      {
        status: true,
        mes: `Đã thêm ${insertedCount} KH mới và cập nhật quyền cho ${updatedCount} KH cũ.`,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("POST Error:", error);
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

    revalidateTag(TAG);
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

export async function PATCH(request) {
  await dbConnect();

  try {
    const body = await request.json();
    const { customerId, updateData } = body;

    // --- Kiểm tra đầu vào ---
    if (!customerId || !Types.ObjectId.isValid(customerId)) {
      return NextResponse.json(
        { status: false, message: "ID khách hàng không hợp lệ." },
        { status: 400 },
      );
    }

    if (
      !updateData ||
      typeof updateData !== "object" ||
      Object.keys(updateData).length === 0
    ) {
      return NextResponse.json(
        { status: false, message: "Vui lòng cung cấp dữ liệu cần cập nhật." },
        { status: 400 },
      );
    }

    // --- Cập nhật linh hoạt ---
    const updatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      { $set: updateData }, // Dùng $set để cập nhật các trường trong updateData
      { new: true }, // Trả về document đã được cập nhật
    )
      .populate("status", "_id name")
      .lean();

    if (!updatedCustomer) {
      return NextResponse.json(
        { status: false, message: "Không tìm thấy khách hàng." },
        { status: 404 },
      );
    }

    // --- Revalidate và trả về kết quả ---
    revalidateTag(TAG);
    return NextResponse.json({ status: true, data: updatedCustomer });
  } catch (error) {
    console.error("PATCH Error:", error);
    return NextResponse.json(
      { status: false, message: "Lỗi phía máy chủ.", error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  await dbConnect();

  try {
    const body = await request.json();
    const { customerId } = body;

    if (!customerId || !Types.ObjectId.isValid(customerId)) {
      return NextResponse.json(
        { status: false, message: "ID khách hàng không hợp lệ." },
        { status: 400 },
      );
    }

    // Dùng $unset để xóa hoàn toàn trường 'status' khỏi document
    const updatedCustomer = await Customer.findByIdAndUpdate(
      customerId,
      { $unset: { status: "" } }, // Giá trị của status không quan trọng, chỉ cần key
      { new: true },
    ).lean();

    if (!updatedCustomer) {
      return NextResponse.json(
        { status: false, message: "Không tìm thấy khách hàng." },
        { status: 404 },
      );
    }

    revalidateTag(TAG);
    return NextResponse.json({ status: true, data: updatedCustomer });
  } catch (error) {
    console.error("DELETE Error:", error);
    return NextResponse.json(
      { status: false, message: "Lỗi phía máy chủ.", error: error.message },
      { status: 500 },
    );
  }
}
