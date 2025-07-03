import connectDB from '@/config/connectDB';
import users from '@/models/users';
import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        await connectDB();
        const data = await users
            .find(
                { uid: { $exists: true, $ne: null } },
                { uid: 0 } 
            )
            .lean()
            .exec();

        return NextResponse.json(
            { air: 2, mes: 'Lấy danh sách người dùng có uid thành công', data },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { air: 0, mes: error.message, data: null },
            { status: error.message === 'Authentication failed' ? 401 : 500 }
        );
    }
}
