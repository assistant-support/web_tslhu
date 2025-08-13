// app/(main)/page.js

import { getZaloAccounts } from "@/app/actions/zaloAccountActions";
import { getCurrentUser } from "@/lib/session";
import ClientPage from "./client/index";
import { Data_Client, Data_Label, Data_Status } from "@/data/customer";

export default async function Page({ searchParams }) {
  const [userData, labelResponse, statusResponse, zaloAccountsResponse] =
    await Promise.all([
      getCurrentUser(),
      Data_Label(),
      Data_Status(),
      getZaloAccounts(),
    ]);

  // ** MODIFIED: Sửa lại cách truy cập searchParams cho đúng cú pháp
  // searchParams ở đây là một plain object, không có phương thức .get()
  const finalSearchParams = {
    page: searchParams.page,
    limit: searchParams.limit,
    status: searchParams.status,
    query: searchParams.query,
    uidStatus: searchParams.uidStatus,
  };

  if (userData?.zaloActive?._id) {
    finalSearchParams.zaloActive = userData.zaloActive._id.toString();
  }

  const clientResponse = await Data_Client(finalSearchParams);

  return (
    <ClientPage
      initialData={clientResponse.data}
      initialPagination={clientResponse.pagination}
      initialLabels={labelResponse.data}
      initialStatuses={statusResponse.data}
      user={userData}
      initialZaloAccounts={zaloAccountsResponse.data}
    />
  );
}
