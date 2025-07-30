// web_tslhu/app/api/(calendar)/runca/route.js
// -------------------- START: THAY THẾ TOÀN BỘ FILE --------------------
// Chú thích: Cập nhật logic reset lúc 0h và bổ sung logic "đánh dấu" khách hàng.
import { NextResponse } from "next/server";
import connectToDatabase from "@/config/connectDB";
import User from "@/models/users";
import ZaloAccount from "@/models/zalo";
import Customer from "@/models/customer";
import ScheduledJob from "@/models/schedule";
import authenticate from "@/utils/authenticate";
import { revalidateTag } from "next/cache";
import { logCreateScheduleTask } from "@/app/actions/historyActions";
import mongoose from "mongoose";

// --- BỘ NÃO LẬP LỊCH THÔNG MINH ---
function schedulePersonsSmart(persons, account, actionsPerHour) {
  const scheduledTasks = [];
  const baseIntervalMs = 3_600_000 / actionsPerHour;
  const now = new Date();

  let currentTime = new Date(
    Math.max(now.getTime(), account.rateLimitHourStart?.getTime() || 0),
  );
  let currentHourUsage = account.actionsUsedThisHour || 0;
  let currentDayUsage = account.actionsUsedThisDay || 0;

  //<-----------------THAY ĐỔI: Reset giới hạn ngày vào 0h đêm----------------->
  const getNextDayStart = (date) => {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0); // Đặt lại vào 00:00:00
    return nextDay;
  };

  const smartStartDate = new Date(currentTime);

  for (const person of persons) {
    let safeTimeFound = false;
    while (!safeTimeFound) {
      const currentHourStart = new Date(currentTime);
      currentHourStart.setMinutes(0, 0, 0);

      const currentDayStart = new Date(account.rateLimitDayStart || 0);
      currentDayStart.setHours(0, 0, 0, 0);
      const nextDayStart = getNextDayStart(currentDayStart);

      if (currentHourUsage >= account.rateLimitPerHour) {
        currentTime = new Date(currentHourStart.getTime() + 3_600_000);
        currentHourUsage = 0;
        continue;
      }

      if (
        currentDayUsage >= account.rateLimitPerDay ||
        currentTime >= nextDayStart
      ) {
        currentTime = getNextDayStart(currentDayStart); // Sử dụng hàm mới
        currentDayUsage = 0;
        currentHourUsage = 0;
        account.rateLimitDayStart = new Date(currentTime);
        continue;
      }

      safeTimeFound = true;
    }

    const jitterMs = (Math.random() - 0.5) * baseIntervalMs * 0.3;
    const finalScheduledTime = new Date(currentTime.getTime() + jitterMs);

    scheduledTasks.push({
      person,
      scheduledFor: finalScheduledTime,
      status: "pending",
    });

    currentHourUsage++;
    currentDayUsage++;
    currentTime.setTime(currentTime.getTime() + baseIntervalMs);
  }

  return {
    scheduledTasks,
    estimatedCompletion: new Date(currentTime.getTime()),
    smartStartDate,
  };
}

export async function POST(request) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await connectToDatabase();
    const { user, body } = await authenticate(request);
    const { jobName, actionType, config = {}, tasks } = body;

    const dbUser = await User.findById(user.id).populate("zaloActive").lean();
    if (!dbUser?.zaloActive?._id) {
      throw new Error("Chưa chọn tài khoản Zalo hoạt động.");
    }
    const zaloAccountId = dbUser.zaloActive._id.toString();
    const account = await ZaloAccount.findById(zaloAccountId).session(session);
    if (!account) {
      throw new Error("Không tìm thấy tài khoản Zalo.");
    }

    // ... (logic reset giới hạn không đổi)

    const { scheduledTasks, estimatedCompletion } = schedulePersonsSmart(
      tasks.map((t) => t.person),
      account,
      config.actionsPerHour || account.rateLimitPerHour,
    );

    const personIds = tasks.map((t) => t.person._id);

    const [newJob] = await ScheduledJob.create(
      [
        {
          jobName:
            jobName ||
            `Lịch trình ngày ${new Date().toLocaleDateString("vi-VN")}`,
          status: "scheduled",
          actionType,
          zaloAccount: zaloAccountId,
          tasks: scheduledTasks,
          config,
          statistics: { total: tasks.length, completed: 0, failed: 0 },
          estimatedCompletionTime: estimatedCompletion,
          createdBy: user.id,
        },
      ],
      { session },
    );

    //<-----------------THAY ĐỔI: Bổ sung lại logic "đánh dấu" khách hàng----------------->
    await Customer.updateMany(
      { _id: { $in: personIds } },
      {
        $push: {
          action: {
            job: newJob._id,
            zaloAccount: zaloAccountId,
            actionType: actionType,
            status: "pending",
          },
        },
      },
      { session },
    );

    for (const task of newJob.tasks) {
      await logCreateScheduleTask(user, newJob, task);
    }

    await session.commitTransaction();
    session.endSession();

    revalidateTag("customer_data");
    revalidateTag("running_jobs");

    return NextResponse.json({ mes: "Đặt lịch thành công!", data: newJob });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("LỖI KHI TẠO LỊCH:", err);
    return NextResponse.json(
      { mes: "Lỗi máy chủ khi tạo lịch.", error: err.message },
      { status: 500 },
    );
  }
}
// --------------------  END: THAY THẾ TOÀN BỘ FILE  --------------------
