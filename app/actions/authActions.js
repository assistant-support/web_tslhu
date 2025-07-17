// app/actions/authActions.js
"use server";

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import connectDB from "@/config/connectDB";
import users from "@/models/users";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const COOKIE_NAME = "token";

// --- ACTION 1: ĐĂNG NHẬP ---
export async function loginUser(prevState, formData) {
  try {
    await connectDB();
    const email = formData.get("email");
    const password = formData.get("password");
    const rememberMe = formData.get("rememberMe") === "on";

    const user = await users.findOne({ email }).lean();
    if (!user) {
      return { error: "Tài khoản không tồn tại!" };
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.uid);
    if (!isPasswordCorrect) {
      return { error: "Mật khẩu không chính xác!" };
    }

    const tokenData = {
      id: user._id,
      role: user.role,
      zalo: user.zalo || null,
    };
    const accessToken = jwt.sign(tokenData, process.env.JWT_SECRET, {
      expiresIn: rememberMe ? "120d" : "5h",
    });

    cookies().set(COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: rememberMe ? 60 * 60 * 24 * 120 : undefined,
    });
  } catch (err) {
    console.error(err);
    return { error: "Lỗi phía máy chủ, vui lòng thử lại." };
  }
  // Chuyển hướng về trang chủ sau khi thành công
  redirect("/");
}

// --- ACTION 2: ĐĂNG XUẤT ---
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
