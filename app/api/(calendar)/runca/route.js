import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectToDatabase from "@/config/connectDB";
import "@/models/users";
import ZaloAccount from "@/models/zalo";
import Customer from "@/models/client";
import ScheduledJob from "@/models/tasks";
import authenticate from "@/utils/authenticate";
import { Re_acc, Re_user } from "@/data/users";
import { revalidateTag } from "next/cache";

const LIMIT_PER_HR = 50; 

function schedulePersonsWithFixedInterval(
  personIds,
  startDate = new Date(),
  limitPerHour = LIMIT_PER_HR,
) {
  const result = [];
  const fixedIntervalMs = 3_600_000 / limitPerHour;
  let scheduledTime = new Date(startDate.getTime());

  for (const personId of personIds) {
    result.push({
      person: personId,
      scheduledFor: new Date(scheduledTime.getTime()),
      status: "pending",
    });
    scheduledTime.setTime(scheduledTime.getTime() + fixedIntervalMs);
  }
  return result;
}


// ---------- POST handler (đã cập nhật) ----------
export async function POST(request) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await connectToDatabase();
    const { user, body } = await authenticate(request);

    if (!user) {
      return NextResponse.json(
        { status: 1, mes: "Xác thực không thành công." },
        { status: 401 },
      );
    }

    const { jobName, actionType, config = {}, zaloAccountId, tasks } = body;
    if (
      !zaloAccountId ||
      !Array.isArray(tasks) ||
      tasks.length === 0 ||
      !actionType
    ) {
      return NextResponse.json(
        { status: 1, mes: "Thiếu dữ liệu: zaloAccountId, tasks, actionType." },
        { status: 400 },
      );
    }

    // Kiểm tra job trùng
    const dup = await ScheduledJob.findOne({
      zaloAccount: zaloAccountId,
      actionType,
      status: { $in: ["pending", "processing"] },
    }).lean();
    if (dup) {
      return NextResponse.json(
        { status: 1, mes: `Tài khoản đã có lịch ${actionType} đang chạy.` },
        { status: 409 },
      );
    }

    // Lấy bot
    const account = await ZaloAccount.findById(zaloAccountId).session(session);
    if (!account) {
      return NextResponse.json(
        { status: 1, mes: "Không tìm thấy tài khoản." },
        { status: 404 },
      );
    }

    // Tính lịch
    let scheduledTasks;
    const personIds = tasks.map((t) => t.person);

    // Nếu chỉ có 1 người, xếp lịch chạy ngay lập tức
    if (personIds.length === 1) {
      console.log("LOGIC: Tối ưu cho 1 người, xếp lịch ngay lập tức.");
      scheduledTasks = [
        {
          person: personIds[0],
          scheduledFor: new Date(), // Thời gian là NGAY BÂY GIỜ
          status: "pending",
        },
      ];
    }
    // Nếu có nhiều người, dùng thuật toán khoảng cách cố định
    else {
      console.log(
        `LOGIC: Dùng thuật toán khoảng cách cố định cho ${personIds.length} người.`,
      );
      // 👇 THAY ĐỔI CHÍNH NẰM Ở ĐÂY
      scheduledTasks = schedulePersonsWithFixedInterval(
        personIds,
        new Date(), // Bắt đầu từ bây giờ
        config.actionsPerHour || account.rateLimitPerHour,
      );
    }

    // Tạo ScheduledJob
    const [newJob] = await ScheduledJob.create(
      [
        {
          jobName: jobName || `Lịch ${actionType} cho ${tasks.length} người`,
          status: "processing",
          actionType,
          zaloAccount: zaloAccountId,
          tasks: scheduledTasks,
          config,
          statistics: { total: tasks.length, completed: 0, failed: 0 },
          estimatedCompletionTime: scheduledTasks.at(-1).scheduledFor,
          createdBy: user.id,
        },
      ],
      { session },
    );

    await ZaloAccount.findByIdAndUpdate(
      zaloAccountId,
      { $addToSet: { task: { id: newJob._id, actionType } } },
      { session },
    );
    await Customer.updateMany(
      { _id: { $in: personIds } },
      {
        $push: {
          action: {
            job: newJob._id,
            zaloAccount: zaloAccountId,
            actionType,
            status: "pending",
          },
        },
      },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    revalidateTag("customer_data");
    Re_acc();
    Re_user();
    return NextResponse.json({
      status: 2,
      mes: "Đặt lịch thành công!",
      data: newJob,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(err);
    return NextResponse.json(
      { status: 0, mes: "Lỗi khi tạo lịch.", data: err.message },
      { status: 500 },
    );
  }
}