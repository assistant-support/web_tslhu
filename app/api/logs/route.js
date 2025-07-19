import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import ActionLog from "@/models/ActionLog";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route"; // Điều chỉnh đường dẫn này cho đúng

// POST: Ghi một log hành động mới
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await dbConnect();
    const body = await request.json();

    const { customerId, actionType, fieldName, oldValue, newValue } = body;

    // Validate đầu vào
    if (!customerId || !actionType || newValue === undefined) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 },
      );
    }

    const newLog = await ActionLog.create({
      userId: session.user.id,
      customerId,
      actionType,
      fieldName,
      oldValue,
      newValue,
    });

    return NextResponse.json(newLog, { status: 201 });
  } catch (error) {
    console.error("Error creating action log:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// GET: Lấy danh sách log cho trang Admin
export async function GET(request) {
  // Thêm logic kiểm tra quyền Admin ở đây nếu cần
  // const session = await getServerSession(authOptions);
  // if (!session?.user?.isAdmin) {
  //   return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  // }

  try {
    await dbConnect();

    const logs = await ActionLog.find({})
      .sort({ createdAt: -1 }) // Sắp xếp theo thời gian mới nhất
      .populate({
        path: "userId",
        select: "name", // Chỉ lấy tên nhân viên
      })
      .populate({
        path: "customerId",
        select: "name phone", // Lấy tên và sđt khách hàng
      })
      .limit(100); // Giới hạn số lượng log trả về để tránh quá tải

    return NextResponse.json(logs, { status: 200 });
  } catch (error) {
    console.error("Error fetching action logs:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
