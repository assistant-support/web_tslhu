// File: app/actions/zaloAccountActions.js
"use server";

import connectDB from "@/config/connectDB";
import ZaloAccount from "@/models/zalo";
import User from "@/models/users";
import { revalidatePath } from "next/cache";
import { revalidateAndBroadcast } from "@/lib/revalidation";

/**
 * Lấy tất cả tài khoản Zalo và thông tin user được gán.
 * @returns {Promise<Array>} Mảng các tài khoản Zalo.
 */
export async function getZaloAccounts() {
  try {
    await connectDB();
    const accounts = await ZaloAccount.find({})
      .populate("users", "name email") // Lấy tên và email của user được gán
      .sort({ createdAt: -1 })
      .lean();
    return JSON.parse(JSON.stringify(accounts));
  } catch (error) {
    console.error("Lỗi khi lấy danh sách tài khoản Zalo:", error);
    return [];
  }
}

/**
 * Lấy tất cả user trong hệ thống (để gán quyền).
 * @returns {Promise<Array>} Mảng các user.
 */
export async function getAllUsers() {
  try {
    await connectDB();
    const users = await User.find({}).select("name email").lean();
    return JSON.parse(JSON.stringify(users));
  } catch (error) {
    console.error("Lỗi khi lấy danh sách người dùng:", error);
    return [];
  }
}

/**
 * Gán hoặc thu hồi quyền truy cập của một user vào một tài khoản Zalo.
 * @param {string} accountId - ID của tài khoản Zalo.
 * @param {string} userId - ID của user.
 * @returns {Promise<object>} Kết quả { success: true } hoặc { error: '...' }.
 */
export async function toggleUserAccess(accountId, userId) {
  try {
    await connectDB();
    const account = await ZaloAccount.findById(accountId);
    if (!account) throw new Error("Không tìm thấy tài khoản Zalo.");

    const userIndex = account.users.findIndex((id) => id.toString() === userId);

    if (userIndex > -1) {
      // Nếu đã có -> Xóa (thu hồi quyền)
      account.users.splice(userIndex, 1);
    } else {
      // Nếu chưa có -> Thêm (gán quyền)
      account.users.push(userId);
    }

    await account.save();
    revalidateAndBroadcast("zalo_accounts");
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}
