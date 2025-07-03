'use server';

import fetchApi from '@/utils/fetchApi';
import { revalidateTag } from 'next/cache';

export async function Read_Area() {
    let data;
    try { data = await fetchApi('/area', { method: 'GET', next: { tags: ["data_area"] }, cache: "force-cache" }) }
    catch (error) { data = [] }
    if (!data) data = []
    return data.data
}

export async function Re_Area() {
    revalidateTag(`data_area`);
}