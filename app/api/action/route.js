import { NextResponse } from 'next/server'
import connectDB from '@/config/connectDB'
import Customer from '@/models/client'
import Zalo from '@/models/zalo'
import Job from '@/models/tasks'
import History from '@/models/historyClient'
import { Re_acc, Re_user } from '@/data/users'
import { Re_History, Re_History_User } from '@/data/client'
import { revalidateTag } from 'next/cache'

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

export const OPTIONS = () => new NextResponse(null, { headers: cors })

const exec = async (type, acc, person, cfg) => {
    const wordList = [
        'chứ', 'chớ', 'mừ', 'mờ', 'cơ', 'dzậy', 'hăm', 'lắm á', 'luôn á',
        'luôn nhen', 'à nghen', 'ơi', 'ớ', 'đi ha', 'nha', 'nà', 'nhé', 'nhá',
        'nhen', 'nghen', 'đó', 'á', 'à', 'ha'
    ];
    let message;
    if (type == 'sendMessage') {
        message = cfg.messageTemplate;
        if (message.includes('{bienthe1}')) {
            const randomIndex = Math.floor(Math.random() * wordList.length);
            const randomWord = wordList[randomIndex];
            message = message.replace('{bienthe1}', randomWord);
        }
    }
    const r = await fetch(acc.action, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            uid: acc.uid,
            phone: person.phone,
            uidPerson: person.uid || null,
            actionType: type,
            message: message || ''
        }),
        cache: 'no-store'
    })

    const j = await r.json()
    console.log(j);
    
    if (!r.ok || j.status === 'error') throw new Error(j.message || 'script error')
    return j.data
}

const detachJobRef = (zaloId, jobId) =>
    Zalo.findByIdAndUpdate(zaloId, { $pull: { task: { id: jobId } } })

const removeJobCompletely = (jobId, zaloId) =>
    Promise.all([Job.deleteOne({ _id: jobId }), detachJobRef(zaloId, jobId)])

export const GET = async () => {
    try {
        await connectDB()

        const now = new Date()
        const due = await Job.aggregate([
            { $match: { status: 'processing' } },
            { $unwind: '$tasks' },
            { $match: { 'tasks.status': 'pending', 'tasks.scheduledFor': { $lte: now } } },
            { $lookup: { from: 'zaloaccounts', localField: 'zaloAccount', foreignField: '_id', as: 'bot' } },
            { $unwind: '$bot' }
        ])

        if (!due.length)
            return NextResponse.json({ message: 'Không có tác vụ nào đến hạn.' }, { headers: cors })

        let processed = 0

        for (const item of due) {
            const {
                bot,
                tasks: task,
                _id: jobId,
                createdBy,
                jobName,
                actionType,
                config
            } = item

            const acc = await Zalo.findById(bot._id)
            if (
                !acc ||
                (Date.now() - acc.rateLimitHourStart >= 3_600_000
                    ? ((acc.actionsUsedThisHour = 0),
                        (acc.rateLimitHourStart = new Date()),
                        await acc.save(),
                        false)
                    : acc.actionsUsedThisHour >= acc.rateLimitPerHour)
            )
                continue

            let api
            try {
                api = await exec(actionType, acc, task.person, config)
            } catch (e) {
                api = { actionStatus: 'error', actionMessage: e.message }
            }

            const status = api.actionStatus === 'success' ? 'completed' : 'failed'

            await Promise.all([
                Customer.updateOne(
                    { phone: task.person.phone },
                    {
                        $set: {
                            uid:
                                api.uidStatus === 'found_new' && api.targetUid
                                    ? api.targetUid
                                    : 'Lỗi tìm kiếm'
                        }
                    }
                ),
                Job.updateOne(
                    { _id: jobId },
                    {
                        $inc: { [`statistics.${status}`]: 1 },
                        $pull: { tasks: { _id: task._id } }
                    }
                ),
                Customer.updateOne(
                    { phone: task.person.phone },
                    { $pull: { action: { job: jobId } } }
                ),
                Zalo.findByIdAndUpdate(acc._id, { $inc: { actionsUsedThisHour: 1 } }),
                History.findOneAndUpdate(
                    { jobId },
                    {
                        $push: {
                            recipients: {
                                phone: task.person.phone,
                                name: task.person.name,
                                status,
                                details: api.actionMessage,
                                processedAt: new Date()
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
                    { upsert: true }
                )
            ])

            processed++
            Re_History_User(task.person.phone)

            const left = await Job.findById(jobId, { tasks: 1 }).lean()
            if (!left || !left.tasks.length)
                await removeJobCompletely(jobId, acc._id)
        }

        if (processed) {
            Re_user()
            Re_acc()
            Re_History()
            revalidateTag('customer_data')
        }

        return NextResponse.json(
            { message: `Cron job đã chạy • Xử lý ${processed} tác vụ.` },
            { headers: cors }
        )
    } catch (err) {
        console.log('Cron job error:', err);

        return NextResponse.json(
            { message: 'Lỗi xử lý cron job.', error: err.message },
            { status: 500, headers: cors }
        )
    }
}
