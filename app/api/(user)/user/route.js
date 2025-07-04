import connectDB from "@/config/connectDB";
import users from "@/models/users";
import { NextResponse } from 'next/server';
import authenticate from '@/utils/authenticate';

export async function POST(req) {
    
    try {
        const { user, body } = await authenticate(req);
        await connectDB();
        const data = await users.findOne({ _id: user.id }, { __v: 0, uid: 0 })
        return NextResponse.json({ data }, {
            status: 200,
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        });

    } catch (error) {
        console.log(error.message);
        
        return NextResponse.json(
            { mes: 'Lỗi khi lấy dữ liệu từ Google Sheet.', error: error.message },
            { status: 500 }
        );
    }
}