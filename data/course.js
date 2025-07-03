'use server';
import fetchApi from '@/utils/fetchApi';
import { revalidateTag } from 'next/cache';


export async function Data_calendar(month, year) {
    const url = month != '' && year != '' ? `/calendar?month=${month}&year=${year}` : `/calendar`;
    try {
        const res = await fetchApi(url, {
            method: 'GET',
            cache: "force-cache",
            next: { tags: [`data_calendar${month}-${year}`] }
        });

        return res.data || [];
    } catch (err) {
        return { data: [] };
    }
}

export async function Data_lesson(id) {
    try {
        const res = await fetchApi(`/calendar/${id}`, {
            method: 'GET',
            cache: "force-cache",
            next: { tags: [`data_lesson${id}`] }
        });

        return res.data || [];
    } catch (err) {
        return { data: [] };
    }
}

export async function Data_Course_all() {
    try {
        const res = await fetchApi(`/course`, {
            method: 'GET',
            cache: "force-cache",
            next: { tags: [`data_course_all`] }
        });

        return res.data || [];
    } catch (err) {
        return { data: [] };
    }
}

export async function Data_Course_One(id) {
    try {
        const res = await fetchApi(`/course/${id}`, {
            method: 'GET',
            cache: "force-cache",
            next: { tags: [`data_course_${id}`] }
        });

        return res.data || [];
    } catch (err) {
        return { data: [] };
    }
}




export async function Re_course_one(id) {
    revalidateTag(`data_course_${id}`);
}


export async function Re_course_all() {
    revalidateTag(`data_course_all`);
}

export async function Re_lesson(id) {
    revalidateTag(`data_lesson${id}`);
}

export async function Re_calendar(month, year) {
    revalidateTag(`data_calendar${month}-${year}`);
}
