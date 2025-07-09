import Client from "./client";
import { Data_Client, Data_Label } from "@/data/client";
import { Get_user } from "@/data/users";
import { Data_Status } from "@/data/status";

export default async function Page({ searchParams }) {
  const [clientResponse, labelResponse, userData, statusResponse] =
    await Promise.all([
      Data_Client(await searchParams),
      Data_Label(),
      Get_user(),
      Data_Status(),
    ]);

  const dataclient = clientResponse.data;
  const pagination = clientResponse.pagination;
  const initialStatuses = statusResponse.data;
  console.log(userData);

  return (
    <>
      <Client
        initialData={dataclient}
        initialPagination={pagination}
        initialLabels={labelResponse.data}
        initialStatuses={initialStatuses}
        user={userData}
      />
    </>
  );
}
