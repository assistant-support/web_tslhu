import { NextResponse } from 'next/server'
import connectToDatabase from '@/config/connectDB'
import Customer from '@/models/client'
import ZaloAccount from '@/models/zalo'
import ScheduledJob from '@/models/tasks'
import SendHistory from '@/models/historyClient'
import { Re_acc, Re_user } from '@/data/users'
import { Re_History, Re_History_User } from '@/data/client'
import { revalidateTag } from 'next/cache';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

export async function OPTIONS() {
    return new NextResponse(null, { headers: corsHeaders })
}

async function executeActionViaAppsScript(actionType, zaloAcc, person, config) {
    const payload = {
        uid: zaloAcc.uid,
        phone: person.phone,
        uidPerson: person.uid || '',
        actionType,
        message: config.messageTemplate || ''
    }
    const res = await fetch(zaloAcc.action, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        cache: 'no-store'
    })
    const json = await res.json()
    if (!res.ok || json.status === 'error') throw new Error(json.message || 'Apps Script error')
    return json.data
}

function updateCustomerAction(person, jobId, zaloId, actionType, status, message) {
    return Customer.updateOne(
        {
            phone: person.phone,
            'action.job': jobId,
            'action.zaloAccount': zaloId,
            'action.actionType': actionType
        },
        {
            $set: {
                'action.$.status': status,
                'action.$.details': message,
                'action.$.processedAt': new Date()
            }
        }
    )
}

function detachJobFromZalo(zaloId, jobId) {
    return ZaloAccount.findByIdAndUpdate(zaloId, { $pull: { task: { id: jobId } } })
}

export async function GET() {
    try {
        await connectToDatabase()
        const now = new Date()
        const due = await ScheduledJob.aggregate([
            { $match: { status: 'processing' } },
            { $unwind: '$tasks' },
            { $match: { 'tasks.status': 'pending', 'tasks.scheduledFor': { $lte: now } } },
            { $lookup: { from: 'zaloaccounts', localField: 'zaloAccount', foreignField: '_id', as: 'zaloAccountInfo' } },
            { $unwind: '$zaloAccountInfo' }
        ])
        if (!due.length) return NextResponse.json({ message: 'Không có tác vụ nào đến hạn.' }, { headers: corsHeaders })
        let processed = 0
        for (const d of due) {
            const { zaloAccountInfo, tasks: task, _id: jobId, createdBy, jobName, actionType, config } = d
            const acc = await ZaloAccount.findById(zaloAccountInfo._id)
            if (!acc) continue
            if (Date.now() - acc.rateLimitHourStart.getTime() >= 3600000) {
                acc.actionsUsedThisHour = 0
                acc.rateLimitHourStart = new Date()
                await acc.save()
            }
            if (acc.actionsUsedThisHour >= acc.rateLimitPerHour) continue
            let apiData
            try {
                apiData = await executeActionViaAppsScript(actionType, acc, task.person, config)
            } catch (e) {
                apiData = { uidStatus: 'unknown', targetUid: null, actionStatus: 'error', actionMessage: e.message }
            }
            const taskStatus = apiData.actionStatus === 'success' ? 'completed' : 'failed'
            const promises = []
            if (actionType === 'findUid') {
                const uidValue = apiData.uidStatus === 'found_new' && apiData.targetUid ? apiData.targetUid : 'Lỗi tìm kiếm'
                promises.push(Customer.updateOne({ phone: task.person.phone }, { $set: { uid: uidValue } }))
            }
            promises.push(
                ScheduledJob.updateOne(
                    { _id: jobId, 'tasks._id': task._id },
                    {
                        $set: {
                            'tasks.$.status': taskStatus,
                            'tasks.$.resultMessage': apiData.actionMessage,
                            'tasks.$.processedAt': new Date()
                        },
                        $inc: {
                            [taskStatus === 'completed' ? 'statistics.completed' : 'statistics.failed']: 1
                        }
                    }
                )
            )
            promises.push(updateCustomerAction(task.person, jobId, acc._id, actionType, taskStatus, apiData.actionMessage))
            promises.push(ZaloAccount.findByIdAndUpdate(acc._id, { $inc: { actionsUsedThisHour: 1 } }))
            promises.push(
                SendHistory.findOneAndUpdate(
                    { jobId },
                    {
                        $push: {
                            recipients: {
                                phone: task.person.phone,
                                name: task.person.name,
                                status: taskStatus,
                                details: apiData.actionMessage
                            }
                        },
                        $setOnInsert: {
                            jobId,
                            jobName,
                            actionType,
                            sentBy: createdBy,
                            message: config.messageTemplate || ''
                        }
                    },
                    { upsert: true, new: true }
                )
            )
            await Promise.all(promises)
            processed++
            Re_History_User(task.person.phone)
            const j = await ScheduledJob.findById(jobId).lean()
            if (j && j.statistics.completed + j.statistics.failed >= j.statistics.total) await finalizeJob(jobId, acc._id)
        }
        if (processed) {
            Re_user()
            Re_acc()
            Re_History()
            revalidateTag('customer_data');
        }
        return NextResponse.json({ message: `Cron job đã chạy • Xử lý ${processed} tác vụ.` }, { headers: corsHeaders })
    } catch (err) {
        return NextResponse.json({ message: 'Lỗi xử lý cron job.', error: err.message }, { status: 500, headers: corsHeaders })
    }
}

async function finalizeJob(jobId, zaloId) {
    await ScheduledJob.findByIdAndUpdate(jobId, { $set: { status: 'completed', completedAt: new Date() } })
    await detachJobFromZalo(zaloId, jobId)
}
