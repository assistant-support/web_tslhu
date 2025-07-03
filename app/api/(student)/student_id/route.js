import connectDB from '@/config/connectDB';
import PostStudent from '@/models/student';
import authenticate from '@/utils/authenticate';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { user, body } = await authenticate(request);
        let data;
        let message = 'Lấy dữ liệu thành công';
        let status = 200;
        const { _id } = body
        if (!_id) {
            return NextResponse.json(
                { air: status === 200 ? 2 : 1, mes: 'id không tồn tại', data: [] },
                { status: 400 }
            );
        }

        await connectDB();
        data = await PostStudent.findOne({ _id })
        if (!data) {
            return NextResponse.json(
                { air: status === 200 ? 2 : 1, mes: 'Không tìm thấy học sinh', data: [] },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { air: status === 200 ? 2 : 1, mes: message, data },
            { status }
        );
    } catch (error) {
        console.log(error);
        return NextResponse.json(
            { air: 0, mes: error.message, data: null },
            { status: error.message === 'Authentication failed' ? 401 : 500 }
        );
    }
}
