'use server';
import fetchApi from "@/utils/fetchApi";
import { revalidateTag } from 'next/cache';

export async function Read_Student_All() {
    let data;
    try { data = await fetchApi('/student', { method: 'GET', next: { tags: ["student"] }, cache: "force-cache" }) }
    catch (error) { data = [] }
    if (!data) data = []
    return data.data
}

export async function Read_Student_ById(id) {
    let data;
    try { data = await fetchApi(`/student/${id}`, { method: 'GET', next: { tags: [`student${id}`] }, cache: "force-cache" }) }
    catch (error) { data = [] }
    if (!data) data = []
    return data.data
}

export async function Data_Invoices(id) {
    let data;
    try { data = await fetchApi(`/pay?_id=${id}`, { method: 'GET' }) }
    catch (error) { data = [] }
    if (!data) data = []
    return data.data
}

export async function Re_Student_ById() {
    revalidateTag(`student${id}`);
}

export async function Re_Student_All() {
    revalidateTag(`student`);
}
