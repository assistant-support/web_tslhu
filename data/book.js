'use server';

import fetchApi from '@/utils/fetchApi';
import { revalidateTag } from 'next/cache';


export async function Data_book() {
    try {
        const res = await fetchApi(`/book`, {
            method: 'GET',
            cache: "force-cache",
            next: { tags: [`data_book`] }
        });

        return res.data || [];
    } catch (err) {
        return { data: [] };
    }
}

export async function Data_book_one(id) {
    try {
        const res = await fetchApi(`/book/${id}`, {
            method: 'GET',
            cache: "force-cache",
            next: { tags: [`data_book${id}`] }
        });

        return res.data || [];
    } catch (err) {
        return { data: [] };
    }
}

export async function Re_book() {
    revalidateTag(`data_book`);
}

export async function Re_book_one(id) {
    revalidateTag(`data_book${id}`);
}