"use server";
import fetchApi from "@/utils/fetchApi";
import { revalidateTag } from "next/cache";

export async function Data_account() {
  try {
    const res = await fetchApi(`/acc`, {
      method: "GET",
      cache: "force-cache",
      next: { tags: [`data_ac`] },
    });
    return res.data || [];
  } catch (err) {
    return { data: [] };
  }
}

export async function Get_user() {
  try {
    const res = await fetchApi(`/user`, {
      method: "POST",
      cache: "force-cache",
      next: { tags: [`user`] },
      // SỬA LẠI DÒNG NÀY:
      body: JSON.stringify({ source: 1 }), // Bọc trong JSON.stringify
    });
    // Logic mới để trả về user object hoặc null
    if (res && res.status === 2) {
      return res.data;
    }
    return null; // Trả về null nếu không thành công
  } catch (err) {
    console.error("Lỗi trong Get_user:", err.message);
    return null; // Trả về null nếu có lỗi
  }
}

export async function Data_user_report() {
  try {
    const res = await fetchApi(`/reportuser`, { method: "GET" });
    return res.data || [];
  } catch (err) {
    return { data: [] };
  }
}

export async function Re_user() {
  revalidateTag(`user`);
}

export async function Re_acc() {
  revalidateTag(`data_ac`);
}
