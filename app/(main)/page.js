// app/(main)/page.js

import { getCurrentUser } from "@/lib/session";
import ClientPage from "./client/index"; // Import component từ file index.js
import { Data_Client, Data_Label, Data_Status } from "@/data/customer"; // Đảm bảo đúng đường dẫn

export default async function Page({ searchParams }) {
  // BƯỚC 1: Gọi các hàm data-fetching
  // `searchParams` được Next.js tự động cung cấp và truyền thẳng vào Data_Client
  const [userData, clientResponse, labelResponse, statusResponse] =
    await Promise.all([
      getCurrentUser(),
      Data_Client(await searchParams),
      Data_Label(),
      Data_Status(),
    ]);

  // BƯỚC 2: Truyền dữ liệu ban đầu xuống Client Component
  return (
    <ClientPage
      initialData={clientResponse.data}
      initialPagination={clientResponse.pagination}
      initialLabels={labelResponse.data}
      initialStatuses={statusResponse.data}
      user={userData}
    />
  );
}
