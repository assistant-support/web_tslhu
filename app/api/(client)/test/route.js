// app/api/(client)/test/route.js
import { NextResponse } from "next/server";

export async function GET(request) {
  console.log("✅✅✅ API TEST ĐÃ ĐƯỢC GỌI THÀNH CÔNG! ✅✅✅");
  return NextResponse.json({ message: "API Test hoạt động!" });
}
