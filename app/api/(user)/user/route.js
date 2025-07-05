import { NextResponse } from 'next/server';
import connectDB from "@/config/connectDB";
import users from "@/models/users";
import authenticate from '@/utils/authenticate';
import '@/models/zalo';
import ScheduledJob from '@/models/tasks'; 

export async function POST(req) {
    try {
        const { user, body } = await authenticate(req);
        await connectDB();

        const data = await users.findOne({ _id: user.id }, { __v: 0, uid: 0 })
            .populate({
                path: 'zalo',
                select: 'name phone uid actionsUsedThisHour rateLimitPerHour task'
            })
            .lean();

        // Nếu không tìm thấy user thì trả về lỗi
        if (!data) {
            return NextResponse.json({ mes: 'Không tìm thấy người dùng.' }, { status: 404 });
        }

        // 2. Kiểm tra và lấy dữ liệu lịch trình nếu có
        if (data.zalo && data.zalo.task) {
            const taskId = data.zalo.task;
            const scheduledJobData = await ScheduledJob.findById(taskId).lean();

            // Gắn dữ liệu lịch trình đang chạy vào kết quả trả về
            data.runningJob = scheduledJobData || null;
        }

        return NextResponse.json({ data }, {
            status: 200,
            headers: {
                'Cache-Control': 'no-cache', // Dữ liệu user thường không nên cache
            },
        });

    } catch (error) {
        return NextResponse.json(
            { mes: 'Lỗi khi lấy dữ liệu người dùng.', error: error.message },
            { status: 500 }
        );
    }
}