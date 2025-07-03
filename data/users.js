'use server';

import fetchApi from '@/utils/fetchApi';
import { revalidateTag } from 'next/cache';


export async function Data_user() {
    try {
        const res = await fetchApi(`/user`, {
            method: 'GET',
            cache: "force-cache",
            next: { tags: [`data_user`] }
        });

        return res.data || [];
    } catch (err) {
        return { data: [] };
    }
}

export async function Data_user_report() {
    try {
        const res = await fetchApi(`/reportuser`, { method: 'GET' });
        return res.data || [];
    } catch (err) {
        return { data: [] };
    }
}

export async function Re_user() {
    revalidateTag(`data_user`);
}

