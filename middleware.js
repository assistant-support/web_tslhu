// middleware.js
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
const COOKIE_NAME = "token"; // Thống nhất tên cookie ở đây

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = await request.cookies.get(COOKIE_NAME)?.value;

  // --- LOGIC CHO NGƯỜI DÙNG ĐÃ ĐĂNG NHẬP (CÓ TOKEN) ---
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      const isAdmin =
        Array.isArray(payload.role) && payload.role.includes("Admin");

      // Nếu họ cố vào lại trang login, đẩy họ về trang chủ
      if (pathname.startsWith("/login")) {
        return NextResponse.redirect(new URL("/", request.url));
      }

      // Nếu họ cố vào trang cần quyền Admin mà không phải Admin
      if (
        (pathname.startsWith("/admin") || pathname.startsWith("/dev")) &&
        !isAdmin
      ) {
        // Đẩy về trang chủ vì không đủ quyền
        return NextResponse.redirect(new URL("/", request.url));
      }

      // Nếu mọi thứ ổn, cho phép đi tiếp
      return NextResponse.next();
    } catch (err) {
      // Nếu token không hợp lệ, xóa cookie và đẩy về trang login
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete(COOKIE_NAME);
      return response;
    }
  }

  // --- LOGIC CHO NGƯỜI DÙNG CHƯA ĐĂNG NHẬP (KHÔNG CÓ TOKEN) ---
  // Nếu họ cố vào bất kỳ trang nào không phải login, đẩy họ về trang login
  if (!pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Nếu họ đang ở trang login thì cứ để họ ở đó
  return NextResponse.next();
}

// Cấu hình để middleware chạy trên TẤT CẢ các đường dẫn,
// TRỪ các file tĩnh của Next.js và các file public.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
