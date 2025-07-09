'use server';
import fetchApi from '@/utils/fetchApi';
import { revalidateTag } from 'next/cache';

export async function Data_account() {
    try {
        const res = await fetchApi(`/acc`, {
            method: 'GET',
            cache: "force-cache",
            next: { tags: [`data_ac`] }
        });
        return res.data || [];
    } catch (err) {
        return { data: [] };
    }
}

export async function Get_user() {
    try {
        const res = await fetchApi(`/user`, {
            method: 'POST', cache: "force-cache",
            next: { tags: [`user`] }, body: { source: 1 }
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
    revalidateTag(`user`);
}


export async function Re_acc() {
    revalidateTag(`data_ac`);
}
