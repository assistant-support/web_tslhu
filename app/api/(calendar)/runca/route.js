// web_tslhu/app/api/(calendar)/runca/route.js
import { NextResponse } from "next/server";
import connectToDatabase from "@/config/connectDB";
import User from "@/models/users";
import ZaloAccount from "@/models/zalo";
import Customer from "@/models/customer";
import ScheduledJob from "@/models/schedule";
import authenticate from "@/utils/authenticate";
import { revalidateTag } from "next/cache";
import { logCreateScheduleTask } from "@/app/actions/historyActions";

// Hàm xếp lịch được đơn giản hóa
/**
 * Xếp lịch các tác vụ với một khoảng thời gian ngẫu nhiên (jitter)
 * để tránh bị phát hiện spam.
 * @param {Array} persons - Mảng các đối tượng person.
 * @param {Date} startDate - Thời điểm bắt đầu xếp lịch.
 * @param {number} actionsPerHour - Số hành động mỗi giờ.
 * @returns {object} { scheduledTasks, estimatedCompletion }
 */
function schedulePersons(persons, startDate, actionsPerHour) {
  const result = [];
  const baseIntervalMs = 3_600_000 / actionsPerHour;
  // Jitter: Tạo ra một khoảng ngẫu nhiên ~30% của khoảng thời gian cơ bản
  // Ví dụ: nếu interval là 120s, jitter sẽ từ -36s đến +36s
  const jitterFactor = 0.3;
  let scheduledTime = new Date(startDate.getTime());

  for (const person of persons) {
    // Tính toán một khoảng "nhiễu" ngẫu nhiên
    const jitterMs = (Math.random() - 0.5) * baseIntervalMs * jitterFactor;

    // Thời gian thực tế = Thời gian dự kiến + nhiễu
    const finalScheduledTime = new Date(scheduledTime.getTime() + jitterMs);

    result.push({
      person,
      scheduledFor: finalScheduledTime,
      status: "pending",
    });

    // Tăng thời gian dự kiến cho lần lặp tiếp theo
    scheduledTime.setTime(scheduledTime.getTime() + baseIntervalMs);
  }

  // Thời gian hoàn thành vẫn được ước tính dựa trên khoảng thời gian cơ bản
  const estimatedCompletion = new Date(scheduledTime.getTime());

  return { scheduledTasks: result, estimatedCompletion };
}

export async function POST(request) {
  try {
    await connectToDatabase();
    const { user, body } = await authenticate(request);
    const { jobName, actionType, config = {}, tasks } = body;

    // 1. Lấy thông tin tài khoản Zalo
    const dbUser = await User.findById(user.id).populate("zaloActive").lean();
    if (!dbUser?.zaloActive?._id) {
      return NextResponse.json(
        { mes: "Chưa chọn tài khoản Zalo hoạt động." },
        { status: 400 },
      );
    }
    const zaloAccountId = dbUser.zaloActive._id.toString();
    const account = await ZaloAccount.findById(zaloAccountId);
    if (!account) {
      return NextResponse.json(
        { mes: "Không tìm thấy tài khoản Zalo." },
        { status: 404 },
      );
    }

    // 2. Kiểm tra và Reset giới hạn
    const now = new Date();
    if (
      now.getTime() - (account.rateLimitHourStart?.getTime() || 0) >=
      3_600_000
    ) {
      account.actionsUsedThisHour = 0;
      account.rateLimitHourStart = now;
    }
    if (
      now.getTime() - (account.rateLimitDayStart?.getTime() || 0) >=
      86_400_000
    ) {
      account.actionsUsedThisDay = 0;
      account.rateLimitDayStart = now;
    }

    // 3. Tính toán "Smart Start Date"
    let smartStartDate = new Date();
    const actionsToConsume =
      actionType === "findUid" || actionType === "addFriend" ? tasks.length : 0;

    if (actionsToConsume > 0) {
      const remainingInHour =
        account.rateLimitPerHour - account.actionsUsedThisHour;
      const remainingInDay =
        account.rateLimitPerDay - account.actionsUsedThisDay;

      if (actionsToConsume > remainingInDay) {
        const nextDay = new Date(account.rateLimitDayStart);
        nextDay.setDate(nextDay.getDate() + 1);
        smartStartDate = new Date(Math.max(now.getTime(), nextDay.getTime()));
      } else if (actionsToConsume > remainingInHour) {
        const nextHour = new Date(account.rateLimitHourStart);
        nextHour.setHours(nextHour.getHours() + 1);
        smartStartDate = new Date(Math.max(now.getTime(), nextHour.getTime()));
      }
    }

    // 4. Xếp lịch và tạo Job
    const { scheduledTasks, estimatedCompletion } = schedulePersons(
      tasks.map((t) => t.person),
      smartStartDate,
      config.actionsPerHour || account.rateLimitPerHour,
    );

    const newJob = new ScheduledJob({
      jobName:
        jobName || `Lịch trình ngày ${new Date().toLocaleDateString("vi-VN")}`,
      status: "scheduled", // Bắt đầu với status scheduled
      actionType,
      zaloAccount: zaloAccountId,
      tasks: scheduledTasks,
      config,
      statistics: { total: tasks.length, completed: 0, failed: 0 },
      estimatedCompletionTime: estimatedCompletion,
      createdBy: user.id,
    });
    await newJob.save();

    // 5. "Đặt cọc" giới hạn và ghi log
    if (actionsToConsume > 0) {
      account.actionsUsedThisHour += actionsToConsume;
      account.actionsUsedThisDay += actionsToConsume;
      await account.save();
    }

    for (const task of newJob.tasks) {
      await logCreateScheduleTask(user, newJob, task);
    }

    revalidateTag("customer_data");
    revalidateTag("running_jobs");

    return NextResponse.json({ mes: "Đặt lịch thành công!", data: newJob });
  } catch (err) {
    console.error("LỖI KHI TẠO LỊCH:", err);
    return NextResponse.json(
      { mes: "Lỗi máy chủ khi tạo lịch.", error: err.message },
      { status: 500 },
    );
  }
}
