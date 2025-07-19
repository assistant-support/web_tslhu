// app/actions/authActions.js
"use server";

import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import connectDB from "@/config/connectDB";
import users from "@/models/users";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const COOKIE_NAME = "token";

/**
 * Xử lý logic đăng nhập cho người dùng.
 * Chỉ xác thực tài khoản web và tạo token cơ bản.
 * @param {object} prevState - Trạng thái trước đó (không dùng).
 * @param {FormData} formData - Dữ liệu từ form.
 * @returns {Promise<object>} - Trả về { success: true } hoặc { error: '...' }.
 */
export async function loginUser(prevState, formData) {
  try {
    await connectDB();
    const email = formData.get("email");
    const password = formData.get("password");

    const user = await User.findOne({ email }).lean();
    if (!user) {
      return { error: "Tài khoản không tồn tại!" };
    }

    // So sánh mật khẩu với trường `password` đã hash
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return { error: "Mật khẩu không chính xác!" };
    }

    // Token giờ chỉ chứa thông tin xác thực cốt lõi
    const tokenData = {
      id: user._id.toString(), // Đảm bảo ID là string
      role: user.role,
    };

    const expirationTime = "5h";
    const accessToken = await new SignJWT(tokenData)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(expirationTime)
      .sign(JWT_SECRET);

    cookies().set(COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      // Đặt maxAge tương ứng với 5 giờ (tính bằng giây)
      maxAge: 5 * 60 * 60,
    });

    return { success: true, role: user.role };
  } catch (err) {
    console.error("Lỗi đăng nhập:", err);
    return { error: "Lỗi phía máy chủ, vui lòng thử lại." };
  }
}

export async function logoutUser() {
  // Xóa cookie
  cookies().set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
  // Chuyển hướng về trang đăng nhập
  redirect("/login");
}

// --- ACTION 3: ĐĂNG KÝ TÀI KHOẢN MỚI (DÀNH CHO ADMIN) ---
export async function registerUser(prevState, formData) {
  try {
    await connectDB();
    const name = formData.get("name");
    const email = formData.get("email");
    const password = formData.get("password");
    // Lấy role từ form, nếu không có thì mặc định là 'Employee'
    const role = formData.get("role") ? [formData.get("role")] : ["Employee"];

    if (!email || !password || !name) {
      return { error: "Tên, Email và mật khẩu là bắt buộc" };
    }

    const exists = await users.exists({ email });
    if (exists) {
      return { error: "Email đã tồn tại" };
    }

    const hash = await bcrypt.hash(password, 10);

    await users.create({ name, email, role, uid: hash });

    // Làm mới dữ liệu ở trang admin để danh sách user được cập nhật
    revalidatePath("/admin");
    return { success: "Tạo tài khoản thành công!" };
  } catch (err) {
    console.error(err);
    return { error: "Lỗi phía máy chủ khi tạo tài khoản." };
  }
}
