// app/page.js
import { getCurrentUser } from "@/lib/session";
import Client from "./client";
import { Data_Client, Data_Label, Data_Status } from "@/data/client";

export default async function Page({ searchParams }) {
  // SỬA LẠI: Đọc và xử lý searchParams ngay tại đây
  const page = parseInt(searchParams.page) || 1;
  const limit = parseInt(searchParams.limit) || 10;
  const status = searchParams.status || null;
  const query = searchParams.query || null;
  const uidStatus = searchParams.uidStatus || null;

  // Gọi hàm đã được cache để lấy user
  const userData = await getCurrentUser();

  // Truyền các giá trị đơn giản vào hàm Data_Client
  const [clientResponse, labelResponse, statusResponse] = await Promise.all([
    Data_Client(page, limit, status, query, uidStatus),
    Data_Label(),
    Data_Status(),
  ]);

  return (
    <>
      <Client
        initialData={clientResponse.data}
        initialPagination={clientResponse.pagination}
        initialLabels={labelResponse.data}
        initialStatuses={statusResponse.data}
        user={userData}
      />
    </>
  );
}
