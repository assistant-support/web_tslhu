"use server";
import fetchApi from "@/utils/fetchApi";

export async function Data_Status() {
  try {
    const res = await fetchApi(`/statuses`, {
      method: "GET",
      cache: "no-store", // Trạng thái có thể thay đổi, không nên cache
      next: { tags: ["get_statuses"] }, // Thêm tag để có thể revalidate sau này
    });
    return res;
  } catch (err) {
    // Trả về mảng rỗng nếu có lỗi
    return { data: [] };
  }
}
