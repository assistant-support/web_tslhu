// lib/session.js
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

/**
 * Hàm được cache để lấy thông tin user đã xác thực từ token.
 * Chỉ chứa dữ liệu cốt lõi (id, role), không chứa dữ liệu nghiệp vụ (Zalo).
 * Dù được gọi nhiều lần trong một request, nó chỉ thực thi một lần.
 * @returns {Promise<object|null>} - Trả về object user cơ bản, hoặc null nếu không hợp lệ.
 */
export const getCurrentUser = cache(async () => {
  const token = cookies().get("token")?.value;
  if (!token) return null;

  try {
    // Chỉ giải mã token để lấy payload
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // "Làm sạch" payload trước khi trả về
    return JSON.parse(JSON.stringify(payload));
  } catch (error) {
    return null;
  }
});
