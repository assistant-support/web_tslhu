// File: app/actions/historyActions.js
"use server";

import { logAction } from "@/data/history";
import { getCurrentUser } from "@/lib/session";

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
    actionDetail: { commentId: newComment._id.toString() },
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
    zaloActive: job.zaloAccount,
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
