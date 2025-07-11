// app/api/client/detail/route.js
import connectDB from "@/config/connectDB";
import Client from "@/models/client";
import { NextResponse } from "next/server";
import Status from "@/models/status";
import User from "@/models/users";

// export async function GET(request) {
//   try {
//     const url = new URL(request.url);
//     const id = url.searchParams.get("id");

//     if (!id) {
//       return NextResponse.json(
//         { message: "Missing customer ID" },
//         { status: 400 },
//       );
//     }

//     await connectDB();

//     const client = await Client.findById(id)
//       .populate({ path: "status", model: Status }) // Chỉ định rõ model Status
//       .populate({ path: "auth", model: User });

//     if (!client) {
//       return NextResponse.json(
//         { message: "Customer not found" },
//         { status: 404 },
//       );
//     }

//     return NextResponse.json({ data: client }, { status: 200 });
//   } catch (error) {
//     console.error("API Error:", error);
//     return NextResponse.json(
//       { message: "Internal Server Error" },
//       { status: 500 },
//     );
//   }
// }

// app/api/(client)/detail/route.js

export async function GET(request) {
  // Lấy ID từ URL để chắc chắn request đã đến đúng nơi
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  console.log(`✅ API /api/client/detail ĐÃ ĐƯỢC GỌI với ID: ${id}`);

  // Trả về một thông báo thành công đơn giản
  return NextResponse.json({
    message: `API hoạt động! Dữ liệu cho ID ${id} sẽ được xử lý ở đây.`,
  });
}
