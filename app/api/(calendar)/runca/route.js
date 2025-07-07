import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/config/connectDB';
import '@/models/users';
import ZaloAccount from '@/models/zalo';
import ScheduledJob from '@/models/tasks';
import authenticate from '@/utils/authenticate';
import { Re_acc, Re_user } from '@/data/users';

export async function POST(request) {
    let lockedAccountId = null;
    try {
        await connectToDatabase();

        const { user, body } = await authenticate(request);
        if (!user) {
            return NextResponse.json({ status: 1, mes: 'Xác thực không thành công.', data: null }, { status: 401 });
        }

        const { jobName, actionType, config, zaloAccountId, tasks } = body;

        if (!zaloAccountId || !tasks || !Array.isArray(tasks) || tasks.length === 0 || !actionType) {
            return NextResponse.json({ status: 1, mes: 'Vui lòng cung cấp đủ thông tin: zaloAccountId, tasks, actionType.' }, { status: 400 });
        }

        const accountToLock = await ZaloAccount.findOneAndUpdate(
            { _id: zaloAccountId, isLocked: false },
            { $set: { isLocked: true } },
            { new: true }
        );

        if (!accountToLock) {
            return NextResponse.json({ status: 1, mes: 'Tài khoản Zalo này đang bận thực hiện một lịch trình khác.' }, { status: 409 });
        }
        lockedAccountId = accountToLock._id;

        const totalTasks = tasks.length;
        const actionsPerHour = config.actionsPerHour || accountToLock.rateLimitPerHour;
        const delayBetweenTasksInMillis = (3600 / actionsPerHour) * 1000;

        let currentTime = new Date();
        let actionsInCurrentHour = 0;

        // ----- THAY ĐỔI CHÍNH Ở ĐÂY -----
        // Vòng lặp map giờ sẽ xử lý mỗi task có dạng { person: { ... } }
        const tasksWithSchedule = tasks.map(task => {
            if (actionsInCurrentHour >= actionsPerHour) {
                currentTime.setHours(currentTime.getHours() + 1, 0, 0, 0);
                actionsInCurrentHour = 0;
            }

            // Tạo một task mới, giữ nguyên đối tượng person và thêm các thông tin lịch trình
            const scheduledTask = {
                person: task.person, // Lấy đúng đối tượng person từ input
                status: 'pending',
                scheduledFor: new Date(currentTime.getTime()),
            };

            currentTime.setTime(currentTime.getTime() + delayBetweenTasksInMillis);
            actionsInCurrentHour++;
            return scheduledTask;
        });

        const estimatedCompletionTime = tasksWithSchedule[tasksWithSchedule.length - 1].scheduledFor;

        const newJob = new ScheduledJob({
            jobName: jobName || `Lịch trình ${actionType} cho ${totalTasks} người`,
            status: 'processing',
            actionType,
            zaloAccount: zaloAccountId,
            tasks: tasksWithSchedule,
            config,
            statistics: { total: totalTasks, completed: 0, failed: 0 },
            estimatedCompletionTime,
            createdBy: user.id,
        });

        const savedJob = await newJob.save();

        await ZaloAccount.findByIdAndUpdate(
            zaloAccountId,
            { $set: { task: savedJob._id } }
        );

        Re_acc();
        Re_user();
        
        return NextResponse.json({
            status: 2,
            mes: 'Đặt lịch trình thành công!',
            data: savedJob,
        });

    } catch (error) {
        if (lockedAccountId) {
            await ZaloAccount.findByIdAndUpdate(lockedAccountId, { $set: { isLocked: false, task: null } });
        }
        return NextResponse.json(
            { status: 0, mes: 'Lỗi khi tạo lịch trình.', data: error.message },
            { status: 500 }
        );
    }
}