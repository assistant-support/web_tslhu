"use server";
import fetchApi from "@/utils/fetchApi";
import { revalidateTag } from "next/cache";

export async function Data_Client(searchParams) {
  try {
    const queryString = new URLSearchParams(searchParams).toString();
    const res = await fetchApi(`/client?${queryString}`, {
      method: "GET",
      cache: "no-store",
      next: { tags: ["customer_data"] },
    });
    return res;
  } catch (err) {
    return { data: [], pagination: {} };
  }
}

export async function Data_Label() {
  try {
    const res = await fetchApi(`/label`, {
      method: "GET",
      cache: "force-cache",
      next: { tags: ["get_label"] },
    });

    return res;
  } catch (err) {
    return { data: [] };
  }
}

export async function Re_Label() {
  revalidateTag("get_label");
}

export async function Data_History() {
  try {
    const res = await fetchApi(`/hissmes`, {
      method: "GET",
      cache: "force-cache",
      next: { tags: ["get_hissmes"] },
    });

    return res;
  } catch (err) {
    return { data: [] };
  }
}

export async function Data_History_User(params) {
  try {
    const res = await fetchApi(`/hissmes/${params}`, {
      method: "GET",
      cache: "force-cache",
      next: { tags: [`get_hissmes${params}`] },
    });

    return res;
  } catch (err) {
    return { data: [] };
  }
}

export async function Re_History() {
  revalidateTag("get_hissmes");
}
export async function Re_History_User(params) {
  revalidateTag(`get_hissmes${params}`);
}
