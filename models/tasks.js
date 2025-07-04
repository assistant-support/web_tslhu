import { Schema, model, models } from 'mongoose';

// Schema cho từng người trong danh sách của lịch trình
const TaskSchema = new Schema({
    person: {
        type: {
            name: String,
            phone: String,
        },
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    processedAt: {
        type: Date,
    },
    resultMessage: {
        type: String,
    },
}, { _id: false });

// Schema chính cho một lịch trình
const ScheduledJobSchema = new Schema({
    jobName: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['scheduled', 'processing', 'completed', 'failed', 'paused'],
        default: 'scheduled',
    },
    actionType: {
        type: String,
        enum: ['sendMessage', 'addFriend', 'findUid'],
        required: true,
    },

    // --- Liên kết với tài khoản Zalo sẽ thực thi ---
    zaloAccount: {
        type: Schema.Types.ObjectId,
        ref: 'ZaloAccount',
        required: true,
    },
    tasks: [TaskSchema],

    config: {
        messageTemplate: String,
    },
    statistics: {
        total: { type: Number, default: 0 },
        completed: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
    },
    estimatedCompletionTime: {
        type: Date,
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, {
    timestamps: true, 
});

const ScheduledJob = models.ScheduledJob || model('ScheduledJob', ScheduledJobSchema);

export default ScheduledJob;