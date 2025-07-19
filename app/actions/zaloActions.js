// app/actions/zaloActions.js
"use server";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import connectDB from "@/config/connectDB";
import User from "@/models/users";
import ZaloAccount from "@/models/zalo";
import { revalidatePath } from "next/cache";

const COOKIE_NAME = "token";
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

/**
 * Cập nhật tài khoản Zalo đang hoạt động cho user.
 * Action này sẽ tạo lại token với thông tin Zalo mới.
 * @param {string | null} zaloAccountId - ID của tài khoản Zalo được chọn, hoặc null để bỏ chọn.
 * @returns {Promise<object>} - Trả về { success: true } hoặc { error: '...' }.
 */
export async function setActiveZalo(zaloAccountId) {
  try {
    await connectDB();
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) throw new Error("Yêu cầu đăng nhập.");

    // 1. Xác thực token web user hiện tại
    const { payload: userPayload } = await jwtVerify(token, JWT_SECRET);
    const userId = userPayload.id;

    let activeZalo = null;
    if (zaloAccountId) {
      // 2. Tìm tài khoản Zalo được chọn trong DB
      activeZalo = await ZaloAccount.findById(zaloAccountId).lean();

      // 3. Kiểm tra xem user có quyền sử dụng Zalo này không
      if (
        !activeZalo ||
        !activeZalo.users.map((id) => id.toString()).includes(userId)
      ) {
        throw new Error("Không có quyền truy cập tài khoản Zalo này.");
      }
    }

    // 4. Cập nhật trường `zaloActive` trong document của User
    await User.findByIdAndUpdate(userId, {
      $set: { zaloActive: activeZalo ? activeZalo._id : null },
    });

    // 5. Tạo token MỚI, giữ nguyên thông tin user và thêm thông tin Zalo
    const newTokenData = {
      id: userPayload.id,
      role: userPayload.role,
      zalo: activeZalo ? JSON.parse(JSON.stringify(activeZalo)) : null,
    };

    const expirationTime = userPayload.exp - Math.floor(Date.now() / 1000);
    const newAccessToken = await new SignJWT(newTokenData)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(expirationTime > 0 ? expirationTime : "1h")
      .sign(JWT_SECRET);

    // 6. Ghi đè cookie cũ bằng token mới
    cookieStore.set(COOKIE_NAME, newAccessToken, { httpOnly: true, path: "/" });

    // 7. Làm mới toàn bộ trang để UI được cập nhật
    revalidatePath("/", "layout");
    return { success: true, message: "Đã cập nhật tài khoản Zalo." };
  } catch (error) {
    console.error("Lỗi khi chọn Zalo:", error);
    return { error: error.message };
  }
}
