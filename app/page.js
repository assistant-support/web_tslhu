import Client from "./client";
import { Data_Client, Data_Label } from "@/data/client";
import { Get_user } from "@/data/users";

export default async function Page({ searchParams }) {
  const [clientResponse, labelResponse, userData] = await Promise.all([
    Data_Client(await searchParams),
    Data_Label(),
    Get_user()
  ]);

  
  const dataclient = clientResponse.data;
  const pagination = clientResponse.pagination;

  return (
    <>
      <Client
        initialData={dataclient}
        initialPagination={pagination}
        initialLabels={labelResponse.data}
        user={userData}
      />
    </>
  );
}