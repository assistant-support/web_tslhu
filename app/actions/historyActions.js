// File: app/actions/historyActions.js
"use server";

import { logAction } from "@/data/history";
import { getCurrentUser } from "@/lib/session";
import connectDB from "@/config/connectDB";
import mongoose from "mongoose";
import ActionHistory from "@/models/history";
import Customer from "@/models/customer";

/**
 * Ghi log cho hành động Đăng nhập của người dùng.
 * @param {'SUCCESS'|'FAILED'} statusName - Trạng thái đăng nhập.
 * @param {string} userId - ID của người dùng.
 * @param {object} details - Chi tiết về hành động.
 * @param {string} details.ipAddress - Địa chỉ IP.
 * @param {string} details.userAgent - Thông tin trình duyệt.
 * @param {string} [details.reason] - (Nếu thất bại) Lý do thất bại.
 * @param {string} [details.passwordAttempt] - (Nếu thất bại) Mật khẩu đã nhập sai.
 */
export async function logUserLogin(statusName, userId, details) {
  await createLog({
    action: "USER_LOGIN",
    user: userId,
    status: {
      status: statusName,
      detail:
        statusName === "FAILED"
          ? { reason: details.reason, passwordAttempt: details.passwordAttempt }
          : null,
    },
    actionDetail: {
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
    },
  });
}

/**
 * Ghi lại lịch sử khi tên của khách hàng được thay đổi.
 * @param {object} user - Object người dùng thực hiện hành động.
 * @param {string} customerId - ID của khách hàng bị tác động.
 * @param {string} oldName - Tên cũ của khách hàng.
 * @param {string} newName - Tên mới của khách hàng.
 */
export async function logUpdateName(user, customerId, oldName, newName) {
  if (oldName === newName) return; // Không ghi log nếu không có thay đổi
  await logAction({
    action: "UPDATE_NAME_CUSTOMER",
    user: user._id,
    customer: customerId,
    status: { status: "SUCCESS" },
    actionDetail: { oldName, newName },
  });
}

/**
 * Ghi lại lịch sử khi trạng thái chăm sóc của khách hàng được thay đổi.
 * @param {object} user - Object người dùng thực hiện hành động.
 * @param {string} customerId - ID của khách hàng bị tác động.
 * @param {string} oldStatus - Tên trạng thái cũ.
 * @param {string} newStatus - Tên trạng thái mới.
 */
export async function logUpdateStatus(user, customerId, oldStatus, newStatus) {
  if (oldStatus === newStatus) return;
  await logAction({
    action: "UPDATE_STATUS_CUSTOMER",
    user: user._id,
    customer: customerId,
    status: { status: "SUCCESS" },
    actionDetail: { oldStatus, newStatus },
  });
}

/**
 * Ghi lại lịch sử khi giai đoạn chăm sóc của khách hàng được thay đổi.
 * @param {object} user - Object người dùng thực hiện hành động.
 * @param {string} customerId - ID của khách hàng bị tác động.
 * @param {number} oldStage - Giai đoạn cũ (số).
 * @param {number} newStage - Giai đoạn mới (số).
 */
export async function logUpdateStage(user, customerId, oldStage, newStage) {
  if (oldStage === newStage) return;
  const stages = ["Chưa có", "Chăm sóc", "OTP", "Nhập học"];
  await logAction({
    action: "UPDATE_STAGE_CUSTOMER",
    user: user._id,
    customer: customerId,
    status: { status: "SUCCESS" },
    actionDetail: {
      oldStage: stages[oldStage] || `Không xác định (${oldStage})`,
      newStage: stages[newStage] || `Không xác định (${newStage})`,
    },
  });
}

/**
 * Ghi lại lịch sử khi một bình luận mới được thêm vào.
 * @param {object} user - Object người dùng thực hiện hành động.
 * @param {string} customerId - ID của khách hàng được bình luận.
 * @param {object} newComment - Object bình luận vừa được tạo.
 */
export async function logAddComment(user, customerId, newComment) {
  await logAction({
    action: "ADD_COMMENT_CUSTOMER",
    user: user._id,
    customer: customerId,
    status: { status: "SUCCESS" },
    actionDetail: { commentId: newComment._id },
  });
}

/**
 * Ghi lại lịch sử khi một lịch trình (chiến dịch) mới được tạo.
 * @param {object} user - Object người dùng thực hiện hành động.
 * @param {object} job - Object lịch trình vừa được tạo từ model ScheduledJob.
 */
export async function logCreateSchedule(user, job) {
  // Xác định đúng loại action dựa trên job.actionType
  const actionTypeMap = {
    sendMessage: "CREATE_ZALO_ACTION_SEND_MESSAGE",
    addFriend: "CREATE_ZALO_ACTION_ADD_FRIEND",
    findUid: "CREATE_ZALO_ACTION_FIND_UID",
  };
  const action = actionTypeMap[job.actionType] || "UNKNOWN_SCHEDULE_CREATED";

  await logAction({
    action,
    user: user._id,
    zalo: job.zaloAccount,
    status: { status: "SUCCESS" },
    actionDetail: {
      scheduleId: job._id.toString(),
      scheduleName: job.jobName,
      targetCount: job.statistics.total,
      ...(job.actionType === "sendMessage" && {
        mes: job.config.messageTemplate,
      }),
    },
  });
}
/**
 * Ghi log cho việc TẠO một task trong lịch trình mới.
 * Hàm này được gọi lặp lại cho mỗi khách hàng trong lịch trình.
 * @param {object} user - Người dùng tạo lịch trình.
 * @param {object} job - Toàn bộ object lịch trình (ScheduledJob).
 * @param {object} task - Task (khách hàng) cụ thể được lên lịch.
 */
export async function logCreateScheduleTask(user, job, task) {
  // Xác định đúng loại action dựa trên job.actionType
  const actionTypeMap = {
    sendMessage: "CREATE_SCHEDULE_SEND_MESSAGE",
    addFriend: "CREATE_SCHEDULE_ADD_FRIEND",
    findUid: "CREATE_SCHEDULE_FIND_UID",
  };
  const action = actionTypeMap[job.actionType] || "UNKNOWN_SCHEDULE_CREATED";

  await logAction({
    action,
    user: user.id || user._id,
    customer: task.person._id, // Ghi log cho khách hàng cụ thể
    zalo: job.zaloAccount,
    status: { status: "SUCCESS" },
    actionDetail: {
      scheduleId: job._id.toString(),
      scheduleName: job.jobName,
      // Chi tiết của riêng task này
      scheduledFor: task.scheduledFor,
      ...(job.actionType === "sendMessage" && {
        messageTemplate: job.config.messageTemplate,
      }),
    },
  });
}

/**
 * Ghi log cho việc XÓA một task khỏi lịch trình.
 * Áp dụng cho cả khi xóa 1 task hoặc xóa toàn bộ lịch trình.
 * @param {object} user - Người dùng thực hiện hành động.
 * @param {object} job - Toàn bộ object lịch trình (ScheduledJob).
 * @param {object} task - Task (khách hàng) cụ thể bị xóa.
 */
export async function logDeleteScheduleTask(user, job, task) {
  const actionTypeMap = {
    sendMessage: "DELETE_SCHEDULE_SEND_MESSAGE",
    addFriend: "DELETE_SCHEDULE_ADD_FRIEND",
    findUid: "DELETE_SCHEDULE_FIND_UID",
  };
  const action = actionTypeMap[job.actionType] || "UNKNOWN_SCHEDULE_DELETED";

  await logAction({
    action,
    user: user.id || user._id,
    customer: task.person._id,
    zalo: job.zaloAccount,
    status: { status: "SUCCESS" },
    actionDetail: {
      scheduleId: job._id.toString(),
      scheduleName: job.jobName,
      removedPerson: {
        name: task.person.name,
        phone: task.person.phone,
      },
    },
  });
}

/**
 * Ghi log chi tiết cho một hành động được thực thi bởi CRON Job.
 * @param {object} jobInfo - Thông tin về job (chiến dịch) cha.
 * @param {object} task - Task được thực thi.
 * @param {string} customerId - ObjectId của khách hàng bị tác động.
 * @param {'SUCCESS' | 'FAILED'} statusName - Trạng thái thực thi.
 * @param {object} executionResult - Toàn bộ object kết quả trả về từ script.
 */
export async function logExecuteScheduleTask(
  jobInfo,
  task,
  customerId,
  statusName,
  executionResult,
) {
  // console.log("\n[DEBUG] Bắt đầu thực thi logExecuteScheduleTask...");
  try {
    const actionTypeMap = {
      sendMessage: "DO_SCHEDULE_SEND_MESSAGE",
      addFriend: "DO_SCHEDULE_ADD_FRIEND",
      findUid: "DO_SCHEDULE_FIND_UID",
    };
    const action =
      actionTypeMap[jobInfo.actionType] || "UNKNOWN_SCHEDULE_EXECUTED";

    const logData = {
      action,
      user: jobInfo.createdBy,
      customer: customerId,
      zalo: jobInfo.zaloAccountId, // Đảm bảo tên trường là 'zalo'
      status: {
        status: statusName,
        detail: executionResult,
      },
      actionDetail: {
        scheduleId: jobInfo.jobId,
        scheduleName: jobInfo.jobName,
        executedAt: new Date(),
        resultMessage: executionResult.actionMessage,
        ...(jobInfo.actionType === "findUid" && {
          uidStatus: executionResult.uidStatus,
          foundUid: executionResult.targetUid,
        }),
      },
    };

    console.log(
      "[DEBUG] Dữ liệu chuẩn bị ghi vào log:",
      JSON.stringify(logData, null, 2),
    );

    // THAY ĐỔI QUAN TRỌNG: Ghi trực tiếp bằng Model thay vì hàm logAction
    // để bắt lỗi schema một cách tường minh.
    await ActionHistory.create(logData);

    // console.log("✅ [DEBUG] Ghi log thành công cho khách hàng:", customerId);
  } catch (error) {
    // Nếu có lỗi schema, nó sẽ bị bắt và in ra ở đây
    console.error("❌ [DEBUG] ĐÃ XẢY RA LỖI KHI GHI LOG TRỰC TIẾP:", error);
  }
}

/**
 * Lấy tất cả lịch sử THỰC THI (DO_...) của một chiến dịch.
 */
export async function getHistoryForSchedule(scheduleId) {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
      console.error("ID lịch trình không hợp lệ:", scheduleId);
      return [];
    }

    const scheduleObjectId = new mongoose.Types.ObjectId(scheduleId);

    const historyRecords = await ActionHistory.find({
      "actionDetail.scheduleId": scheduleObjectId,
      action: {
        $in: [
          "DO_SCHEDULE_SEND_MESSAGE",
          "DO_SCHEDULE_ADD_FRIEND",
          "DO_SCHEDULE_FIND_UID",
        ],
      },
    })
      .populate({
        path: "customer",
        select: "name phone",
      })
      .sort({ time: -1 })
      .lean();

    // "Làm phẳng" dữ liệu để đảm bảo an toàn tuyệt đối
    const safeHistory = historyRecords.map((log) => ({
      ...log,
      _id: log._id.toString(),
      customer: log.customer
        ? {
            ...log.customer,
            _id: log.customer._id.toString(),
          }
        : null,
      user: log.user?.toString(),
      zalo: log.zalo?.toString(),
      // BỔ SUNG LOGIC XỬ LÝ CHO actionDetail
      actionDetail: {
        ...log.actionDetail,
        scheduleId: log.actionDetail.scheduleId?.toString(),
      },
    }));

    return safeHistory;
  } catch (error) {
    console.error("Lỗi khi lấy lịch sử chiến dịch:", error);
    return [];
  }
}
/**
 * Lấy toàn bộ lịch sử hành động của một khách hàng cụ thể.
 */
export async function getHistoryForCustomer(customerId) {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      console.error("ID khách hàng không hợp lệ:", customerId);
      return [];
    }

    const historyRecords = await ActionHistory.find({ customer: customerId })
      .populate([
        { path: "user", select: "name" },
        { path: "zalo", select: "name" },
      ])
      .sort({ time: -1 })
      .limit(100)
      .lean();

    // "Làm phẳng" dữ liệu, bao gồm cả scheduleId lồng bên trong
    const safeHistory = historyRecords.map((log) => ({
      ...log,
      _id: log._id.toString(),
      customer: log.customer?.toString(),
      user: log.user ? { ...log.user, _id: log.user._id.toString() } : null,
      zalo: log.zalo ? { ...log.zalo, _id: log.zalo._id.toString() } : null,
      // BỔ SUNG LOGIC CÒN THIẾU Ở ĐÂY
      actionDetail: log.actionDetail
        ? {
            ...log.actionDetail,
            scheduleId: log.actionDetail.scheduleId?.toString(),
            commentId: log.actionDetail.commentId?.toString(), // Xử lý luôn commentId cho chắc chắn
          }
        : {},
    }));

    return safeHistory;
  } catch (error) {
    console.error("Lỗi khi lấy lịch sử khách hàng:", error);
    return [];
  }
}
