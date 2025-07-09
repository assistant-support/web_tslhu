// Tạo một file mới, ví dụ: /app/api/statuses/route.js

import { NextResponse } from "next/server";
import dbConnect from "@/config/connectDB";
import Status from "@/models/status"; // Import model Status bạn vừa tạo
import Customer from "@/models/client"; // Import Customer để kiểm tra trước khi xóa

// --- LẤY TẤT CẢ TRẠNG THÁI ---
export async function GET() {
  await dbConnect();
  try {
    // Sắp xếp theo tên để danh sách trong dropdown luôn theo thứ tự ABC
    const statuses = await Status.find({}).sort({ name: 1 }).lean();
    return NextResponse.json({ success: true, data: statuses });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Lỗi Server", error: error.message },
      { status: 500 },
    );
  }
}

// --- TẠO MỘT TRẠNG THÁI MỚI ---
export async function POST(request) {
  await dbConnect();
  try {
    const { name, color } = await request.json();

    if (!name) {
      return NextResponse.json(
        { success: false, message: "Tên trạng thái là bắt buộc." },
        { status: 400 },
      );
    }

    // Tạo mới status
    const newStatus = await Status.create({ name, color });

    return NextResponse.json(
      { success: true, message: "Tạo trạng thái thành công!", data: newStatus },
      { status: 201 },
    );
  } catch (error) {
    // Bắt lỗi nếu tên trạng thái bị trùng
    if (error.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          message: `Trạng thái "${error.keyValue.name}" đã tồn tại.`,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { success: false, message: "Lỗi Server", error: error.message },
      { status: 500 },
    );
  }
}

// --- CẬP NHẬT MỘT TRẠNG THÁI ---
export async function PUT(request) {
  await dbConnect();
  try {
    const { _id, name, color } = await request.json();

    if (!_id) {
      return NextResponse.json(
        { success: false, message: "Cần có ID để cập nhật." },
        { status: 400 },
      );
    }

    const updatedStatus = await Status.findByIdAndUpdate(
      _id,
      { name, color },
      { new: true, runValidators: true }, // new: true để trả về document đã cập nhật, runValidators để kiểm tra required
    );

    if (!updatedStatus) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy trạng thái." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Cập nhật thành công!",
      data: updatedStatus,
    });
  } catch (error) {
    if (error.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          message: `Trạng thái "${error.keyValue.name}" đã tồn tại.`,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { success: false, message: "Lỗi Server", error: error.message },
      { status: 500 },
    );
  }
}

// --- XÓA MỘT TRẠNG THÁI ---
export async function DELETE(request) {
  await dbConnect();
  try {
    const { _id } = await request.json();

    if (!_id) {
      return NextResponse.json(
        { success: false, message: "Cần có ID để xóa." },
        { status: 400 },
      );
    }

    // KIỂM TRA QUAN TRỌNG: Có khách hàng nào đang dùng trạng thái này không?
    const customerUsingStatus = await Customer.findOne({ status: _id });
    if (customerUsingStatus) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Không thể xóa. Vẫn còn khách hàng đang sử dụng trạng thái này.",
        },
        { status: 400 },
      );
    }

    const deletedStatus = await Status.findByIdAndDelete(_id);

    if (!deletedStatus) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy trạng thái." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Xóa trạng thái thành công!",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Lỗi Server", error: error.message },
      { status: 500 },
    );
  }
}
