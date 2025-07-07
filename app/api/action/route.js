import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectToDatabase from '@/config/connectDB';
import Customer from '@/models/client'; // Import Customer model
import ZaloAccount from '@/models/zalo';
import ScheduledJob from '@/models/tasks';
import SendHistory from '@/models/historyClient';
import { Re_acc, Re_user } from '@/data/users';
import { Re_History, Re_History_User } from '@/data/client';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS(request) {
    return new NextResponse(null, { headers: corsHeaders });
}

async function executeActionViaAppsScript(actionType, zaloAccount, person, config) {
    const payload = {
        uid: zaloAccount.uid,
        phone: person.phone,
        uidPerson: person.uid || '',
        actionType: actionType,
        message: config.messageTemplate || ''
    };
    const response = await fetch(zaloAccount.action, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        cache: 'no-store'
    });
    const result = await response.json();
    if (!response.ok || result.status === 'error') {
        throw new Error(result.message || 'Lỗi không xác định từ Apps Script.');
    }
    return result.data;
}

export async function GET(request) {
    try {
        await connectToDatabase();
        const now = new Date();
        const dueTasks = await ScheduledJob.aggregate([
            { $match: { status: 'processing' } },
            { $unwind: '$tasks' },
            { $match: { 'tasks.status': 'pending', 'tasks.scheduledFor': { $lte: now } } },
            { $lookup: { from: 'zaloaccounts', localField: 'zaloAccount', foreignField: '_id', as: 'zaloAccountInfo' } },
            { $unwind: '$zaloAccountInfo' }
        ]);

        if (dueTasks.length === 0) {
            return NextResponse.json({ message: 'Không có tác vụ nào đến hạn.' }, { headers: corsHeaders });
        }

        let processedCount = 0;

        for (const taskData of dueTasks) {
            const { zaloAccountInfo: zaloAccount, tasks: task, _id: jobId, createdBy, jobName, actionType, config } = taskData;

            const currentZaloAccount = await ZaloAccount.findById(zaloAccount._id);
            if (!currentZaloAccount || currentZaloAccount.actionsUsedThisHour >= currentZaloAccount.rateLimitPerHour) {
                continue;
            }

            let result;
            try {
                result = await executeActionViaAppsScript(actionType, currentZaloAccount, task.person, config);
            } catch (apiError) {
                result = {
                    uidStatus: 'unknown',
                    targetUid: null,
                    actionStatus: 'error',
                    actionMessage: apiError.message
                };
            }

            const promises = [];

            // 1. Cập nhật UID của Customer nếu tìm được UID mới
            if (result.uidStatus === 'found_new' && result.targetUid) {
                const updateCustomerPromise = Customer.updateOne(
                    { phone: task.person.phone },
                    { $set: { uid: result.targetUid } }
                );
                promises.push(updateCustomerPromise);
            }

            // 2. Cập nhật trạng thái của task trong ScheduledJob
            const newStatus = result.actionStatus === 'success' ? 'completed' : 'failed';
            const updateJobPromise = ScheduledJob.updateOne(
                { _id: jobId, 'tasks._id': task._id },
                {
                    $set: {
                        'tasks.$.status': newStatus,
                        'tasks.$.resultMessage': result.actionMessage,
                        'tasks.$.processedAt': new Date(),
                    },
                    $inc: {
                        [result.actionStatus === 'success' ? 'statistics.completed' : 'statistics.failed']: 1,
                    }
                }
            );
            promises.push(updateJobPromise);

            // 3. Tăng số hành động đã dùng của tài khoản Zalo
            const updateZaloPromise = ZaloAccount.findByIdAndUpdate(zaloAccount._id, { $inc: { actionsUsedThisHour: 1 } });
            promises.push(updateZaloPromise);

            // 4. Ghi nhận lịch sử chi tiết vào SendHistory
            const historyLogPromise = SendHistory.findOneAndUpdate(
                { jobId: jobId },
                {
                    $push: {
                        recipients: {
                            phone: task.person.phone,
                            name: task.person.name,
                            status: result.actionStatus === 'success' ? 'success' : 'failed',
                            details: result.actionMessage
                        }
                    },
                    $setOnInsert: {
                        jobId: jobId,
                        jobName: jobName,
                        actionType: actionType,
                        sentBy: createdBy,
                        message: config.messageTemplate || '',
                    }
                },
                { upsert: true, new: true }
            );
            promises.push(historyLogPromise);
            await Promise.all(promises);

            processedCount++;
            Re_History_User(task.person.phone);
            const updatedJob = await ScheduledJob.findById(jobId);
            if (updatedJob) {
                const { completed, failed, total } = updatedJob.statistics;
                if (completed + failed >= total) {
                    await finalizeJob(jobId, zaloAccount._id);
                }
            }
        }

        if (processedCount > 0) {
            Re_user();
            Re_acc();
            Re_History();
        }

        return NextResponse.json({ message: `Cron job đã chạy. Đã xử lý ${processedCount} tác vụ.` }, { headers: corsHeaders });

    } catch (error) {
        return NextResponse.json(
            { message: 'Lỗi trong quá trình xử lý cron job.', error: error.message },
            { status: 500, headers: corsHeaders }
        );
    }
}

async function finalizeJob(jobId, zaloAccountId) {
    await ScheduledJob.findByIdAndUpdate(jobId, {
        $set: { status: 'completed', completedAt: new Date() }
    });
    await ZaloAccount.findByIdAndUpdate(zaloAccountId, {
        $set: { isLocked: false, task: null }
    });
}