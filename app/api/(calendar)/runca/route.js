import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectToDatabase from "@/config/connectDB";
import User from "@/models/users";
import ZaloAccount from "@/models/zalo";
import Customer from "@/models/customer";
import ScheduledJob from "@/models/schedule";
import authenticate from "@/utils/authenticate";
import { Re_acc, Re_user } from "@/data/users";
import { revalidateTag } from "next/cache";
import { logCreateScheduleTask } from "@/app/actions/historyActions";

const LIMIT_PER_HR = 30;

function schedulePersons(
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
  // ================= START: VÔ HIỆU HÓA TRANSACTION =================
  // const session = await mongoose.startSession(); // Bỏ
  // session.startTransaction(); // Bỏ
  // =================  END: VÔ HIỆU HÓA TRANSACTION  =================
  try {
    await connectToDatabase();
    const { user, body } = await authenticate(request);
    if (!user) {
      return NextResponse.json(
        { status: 1, mes: "Xác thực không thành công." },
        { status: 401 },
      );
    }
    const dbUser = await User.findById(user.id).populate("zaloActive").lean();
    if (!dbUser || !dbUser.zaloActive?._id) {
      return NextResponse.json(
        { status: 1, mes: "Người dùng chưa chọn tài khoản Zalo hoạt động." },
        { status: 400 },
      );
    }
    const zaloAccountId = dbUser.zaloActive._id.toString();
    const { jobName, actionType, config = {}, tasks } = body;
    if (!Array.isArray(tasks) || tasks.length === 0 || !actionType) {
      return NextResponse.json(
        { status: 1, mes: "Thiếu dữ liệu: tasks, actionType." },
        { status: 400 },
      );
    }

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

    // Lấy bot mà không cần session
    const account = await ZaloAccount.findById(zaloAccountId); // Bỏ .session(session)
    if (!account) {
      return NextResponse.json(
        { status: 1, mes: "Không tìm thấy tài khoản." },
        { status: 404 },
      );
    }

    let scheduledTasks;
    const personIds = tasks.map((t) => t.person);

    if (personIds.length === 1) {
      scheduledTasks = [
        { person: personIds[0], scheduledFor: new Date(), status: "pending" },
      ];
    } else {
      scheduledTasks = schedulePersons(
        personIds,
        new Date(),
        config.actionsPerHour || account.rateLimitPerHour,
        20_000,
      );
    }

    // Tạo ScheduledJob mà không cần session
    const newJob = await ScheduledJob.create({
      jobName: jobName || `Lịch ${actionType} cho ${tasks.length} người`,
      status: "processing",
      actionType,
      zaloAccount: zaloAccountId,
      tasks: scheduledTasks,
      config,
      statistics: { total: tasks.length, completed: 0, failed: 0 },
      estimatedCompletionTime: scheduledTasks.at(-1).scheduledFor,
      createdBy: user.id,
    });

    for (const task of newJob.tasks) {
      await logCreateScheduleTask(user, newJob, task);
    }

    // Cập nhật các document khác mà không cần session
    await ZaloAccount.findByIdAndUpdate(zaloAccountId, {
      $addToSet: { task: { id: newJob._id, actionType } },
    });

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
    );

    // ================= START: VÔ HIỆU HÓA TRANSACTION =================
    // await session.commitTransaction(); // Bỏ
    // session.endSession(); // Bỏ
    // =================  END: VÔ HIỆU HÓA TRANSACTION  =================

    revalidateTag("customer_data");
    Re_acc();
    Re_user();
    return NextResponse.json({
      status: 2,
      mes: "Đặt lịch thành công!",
      data: newJob,
    });
  } catch (err) {
    // ================= START: VÔ HIỆU HÓA TRANSACTION =================
    // await session.abortTransaction(); // Bỏ
    // session.endSession(); // Bỏ
    // =================  END: VÔ HIỆU HÓA TRANSACTION  =================
    console.error(err);
    return NextResponse.json(
      { status: 0, mes: "Lỗi khi tạo lịch.", data: err.message },
      { status: 500 },
    );
  }
}
