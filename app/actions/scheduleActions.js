// web_tslhu/app/actions/scheduleActions.js
"use server";

import connectDB from "@/config/connectDB";
import ZaloAccount from "@/models/zalo";
import { getCurrentUser } from "@/lib/session";

/**
 * Tính toán và trả về thời gian bắt đầu và kết thúc dự kiến cho một lịch trình.
 * @param {string} actionType - Loại hành động (findUid, addFriend).
 * @param {number} taskCount - Số lượng tác vụ cần thực hiện.
 * @returns {Promise<object>} - { success, message, data: { estimatedStart, estimatedCompletion } }
 */
export async function getScheduleEstimation(actionType, taskCount) {
  try {
    await connectDB();
    const user = await getCurrentUser();
    if (!user?.zaloActive) {
      throw new Error("Vui lòng chọn tài khoản Zalo đang hoạt động.");
    }

    const account = await ZaloAccount.findById(user.zaloActive).lean();
    if (!account) {
      throw new Error("Không tìm thấy tài khoản Zalo.");
    }

    // --- Logic tính toán thông minh ---
    const now = new Date();
    let smartStartDate = new Date(now);

    // 1. Reset giới hạn nếu cần
    const hourStart = new Date(account.rateLimitHourStart || 0);
    if (now.getTime() - hourStart.getTime() >= 3_600_000) {
      account.actionsUsedThisHour = 0;
    }
    const dayStart = new Date(account.rateLimitDayStart || 0);
    if (now.getTime() - dayStart.getTime() >= 86_400_000) {
      account.actionsUsedThisDay = 0;
    }

    // 2. Tính toán thời gian bắt đầu an toàn
    if (actionType === "findUid" || actionType === "addFriend") {
      const remainingInHour =
        account.rateLimitPerHour - account.actionsUsedThisHour;
      const remainingInDay =
        account.rateLimitPerDay - account.actionsUsedThisDay;

      if (taskCount > remainingInDay) {
        // Nếu vượt giới hạn ngày, phải dời sang ngày hôm sau
        const tomorrow = new Date(dayStart);
        tomorrow.setDate(tomorrow.getDate() + 1);
        smartStartDate = tomorrow;
      } else if (taskCount > remainingInHour) {
        // Nếu vượt giới hạn giờ, dời sang giờ tiếp theo
        const nextHour = new Date(hourStart);
        nextHour.setHours(nextHour.getHours() + 1);
        smartStartDate = new Date(Math.max(now.getTime(), nextHour.getTime()));
      }
    }

    // 3. Tính toán thời gian hoàn thành
    const actionsPerHour = account.rateLimitPerHour;
    const durationMs = (taskCount / actionsPerHour) * 3_600_000;
    const estimatedCompletion = new Date(smartStartDate.getTime() + durationMs);

    return {
      success: true,
      data: {
        estimatedStart: smartStartDate.toLocaleString("vi-VN"),
        estimatedCompletion: estimatedCompletion.toLocaleString("vi-VN"),
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
