// services/historyService.js
"use server";

import connectDB from "@/config/connectDB";
import ActionHistory from "@/models/history";
import User from "@/models/users"; // Import các model cần thiết
import Customer from "@/models/customer";
import ZaloAccount from "@/models/zalo";

// =============================================================================
// === CÁC HÀM GHI LOG (WRITE LOGS) ===
// =============================================================================

/**
 * [Hàm nội bộ] Hàm cơ sở để tạo một bản ghi lịch sử.
 * @param {object} logData - Dữ liệu log.
 */
async function createLog(logData) {
  try {
    await connectDB();
    await ActionHistory.create(logData);
    console.log(
      `[LOG] Action: ${logData.action} | User: ${logData.user} | Status: ${logData.status.status}`,
    );
  } catch (error) {
    console.error(`Lỗi khi ghi log cho hành động ${logData.action}:`, error);
  }
}

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
 * Ghi log cho hành động Đăng xuất của người dùng.
 * @param {string} userId - ID của người dùng.
 * @param {object} details - Chi tiết về hành động.
 * @param {number} details.sessionDurationSeconds - Thời lượng phiên làm việc (giây).
 */
export async function logUserLogout(userId, details) {
  await createLog({
    action: "USER_LOGOUT",
    user: userId,
    status: { status: "SUCCESS" },
    actionDetail: {
      sessionDurationSeconds: details.sessionDurationSeconds,
    },
  });
}

/**
 * Ghi log khi một Admin tạo một tài khoản người dùng mới.
 * @param {string} adminId - ID của Admin thực hiện hành động.
 * @param {object} details - Chi tiết về hành động.
 * @param {string} details.newUserId - ID của user mới được tạo.
 * @param {string} details.newUserEmail - Email của user mới.
 * @param {string} details.newUserRole - Vai trò của user mới.
 */
export async function logUserRegister(adminId, details) {
  await createLog({
    action: "CREATE_NEW_USER", // Đề nghị một tên action mới cho rõ ràng
    user: adminId, // Người thực hiện là Admin
    status: { status: "SUCCESS" },
    // Dùng `customer` (đã đổi tên từ target) để lưu ID của user mới
    customer: details.newUserId,
    actionDetail: {
      newUserEmail: details.newUserEmail,
      newUserRole: details.newUserRole,
    },
  });
}

/**
 * Ghi log cho hành động thay đổi tài khoản Zalo đang hoạt động.
 * @param {string} userId - ID của người dùng thực hiện.
 * @param {object} details - Chi tiết về hành động.
 * @param {string|null} details.newZaloId - ID của tài khoản Zalo mới.
 * @param {string|null} details.oldZaloId - ID của tài khoản Zalo cũ.
 */
export async function logChangeZaloAccount(userId, details) {
  await createLog({
    action: "CHANGE_ZALO_ACCOUNT",
    user: userId,
    status: { status: "SUCCESS" },
    zaloActive: details.newZaloId, // Lưu luôn Zalo đang active
    actionDetail: {
      newZaloId: details.newZaloId,
      oldZaloId: details.oldZaloId,
    },
  });
}

// Thêm các hàm ghi log khác ở đây...
// Ví dụ: export async function logCreateSchedule(...) {}
// Ví dụ: export async function logUpdateCustomer(...) {}

// =============================================================================
// === CÁC HÀM ĐỌC LOG (READ LOGS) ===
// =============================================================================

/**
 * Lấy lịch sử hành động cho một khách hàng cụ thể.
 * @param {string} customerId - ID của khách hàng.
 * @returns {Promise<Array>} - Mảng các bản ghi lịch sử.
 */
export async function getHistoryForCustomer(customerId) {
  try {
    await connectDB();
    const history = await ActionHistory.find({ customer: customerId })
      .populate("user", "name")
      .populate("zaloActive", "name")
      .sort({ time: -1 })
      .limit(100)
      .lean();
    return JSON.parse(JSON.stringify(history));
  } catch (error) {
    console.error("Lỗi khi lấy lịch sử khách hàng:", error);
    return [];
  }
}

// Thêm các hàm đọc log khác ở đây...
// Ví dụ: export async function getHistoryByUser(...) {}
