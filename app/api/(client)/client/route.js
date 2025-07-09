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
const TARGET_EMAIL = "tn2003bh@gmail.com";
const COL_F_INDEX = 5; // cột F (0-based: A=0 … F=5)
const DATA_START_ROW = 23977; // chỉ đọc từ dòng này trở xuống (1-based)
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

/*───────────  POST  ───────────*/
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

    /* 1. Đọc Google Sheet */
    const sheets = await getGoogleSheetsClient();
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const rows = data.values ?? [];

    /* Kiểm tra có đủ dòng để lấy dữ liệu */
    if (rows.length < DATA_START_ROW) {
      return NextResponse.json({
        status: true,
        mes: `Sheet chưa có tới dòng ${DATA_START_ROW}.`,
        data: [],
      });
    }

    /* Header */
    const headers = rows[0].map((h) => h.trim());

    /* Chỉ xử lý từ dòng DATA_START_ROW trở xuống (0-based => -1) */
    const dataRows = rows.slice(DATA_START_ROW - 1);

    /* 2. Xác định cột quan trọng */
    const phoneIdx = headers.indexOf("phone");
    const parentPhoneIdx = headers.indexOf("Parent's Phone Number");
    const nameIdx = headers.indexOf("nameStudent");
    const uidIdx = headers.indexOf("uid");

    if (phoneIdx === -1 && parentPhoneIdx === -1) {
      return NextResponse.json(
        {
          status: false,
          mes: "Thiếu cột phone / Parent's Phone Number.",
          data: [],
        },
        { status: 400 },
      );
    }

    /* 3. Lọc & gom dữ liệu hợp lệ */
    const processed = new Set();
    const sheetRows = [];

    dataRows.forEach((row) => {
      let phone = (row[phoneIdx] || row[parentPhoneIdx] || "")
        .toString()
        .replace(/\s+/g, "");
      if (!phone) return;

      /* Chuẩn hoá SĐT Việt Nam: 10 số, bắt đầu 0 */
      const len = phone.length;
      if (len < 9 || len > 11) return;
      if (len === 9 && phone[0] !== "0") phone = "0" + phone;
      if (len === 10 && phone[0] !== "0") return;
      if (len === 11 && phone.startsWith("84")) phone = "0" + phone.slice(2);
      else if (len === 11) return;
      if (phone.length !== 10) return;

      if (processed.has(phone)) return;
      processed.add(phone);

      const colF = (row[COL_F_INDEX] || "").trim().toLowerCase();
      sheetRows.push({
        phone,
        name: nameIdx !== -1 ? row[nameIdx] || "" : "",
        uid: uidIdx !== -1 ? row[uidIdx] || "" : "",
        needAuth: colF === TARGET_EMAIL.toLowerCase(),
      });
    });

    if (!sheetRows.length) {
      return NextResponse.json({
        status: true,
        mes: "Không tìm thấy số điện thoại hợp lệ.",
        data: [],
      });
    }

    /* 4. Tách dữ liệu mới vs. đã tồn tại */
    const phoneArr = [...processed];
    const existingSet = new Set(
      (
        await Customer.find({ phone: { $in: phoneArr } })
          .select("phone")
          .lean()
      ).map((d) => d.phone),
    );

    /* 5. Lấy _id user (nếu cần) */
    let authId = null;
    if (sheetRows.some((r) => r.needAuth)) {
      const authUser = await User.findOne({ email: TARGET_EMAIL })
        .select("_id")
        .lean();
      authId = authUser?._id?.toString() ?? null;
    }

    /* 6. Phân loại insert / update */
    const docsToInsert = [];
    const phonesNeedAuth = [];

    sheetRows.forEach((r) => {
      if (existingSet.has(r.phone)) {
        if (r.needAuth && authId) phonesNeedAuth.push(r.phone);
      } else {
        const doc = { phone: r.phone, uid: r.uid, name: r.name };
        if (r.needAuth && authId) doc.auth = [authId];
        docsToInsert.push(doc);
      }
    });

    /* 7a. Thêm mới */
    let insertedCount = 0;
    if (docsToInsert.length) {
      const inserted = await Customer.insertMany(docsToInsert);
      insertedCount = inserted.length;
    }

    /* 7b. Update auth các bản ghi cũ */
    let updatedCount = 0;
    if (phonesNeedAuth.length) {
      const res = await Customer.updateMany(
        { phone: { $in: phonesNeedAuth } },
        { $addToSet: { auth: authId } },
      );
      updatedCount = res.modifiedCount || res.nModified || 0;
    }

    /* 8. Hoàn tất */
    revalidateTag(TAG);
    return NextResponse.json(
      {
        status: true,
        mes: `Đã thêm ${insertedCount} KH mới và cập nhật ${updatedCount} KH cũ.`,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error.code === 11000) {
      return NextResponse.json(
        {
          status: false,
          mes: "Lỗi trùng lặp số điện thoại.",
          error: error.message,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { status: false, mes: "Server Error", error: error.message },
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

    if (!updated) {
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
