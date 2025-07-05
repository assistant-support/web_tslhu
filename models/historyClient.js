import { Schema, model, models } from 'mongoose';

const recipientStatusSchema = new Schema({
    phone: { type: String, required: true },
    name: { type: String },
    status: { type: String, required: true, enum: ['success', 'failed'] },
    details: { type: String, default: '' },
    processedAt: { type: Date, default: Date.now },
}, { _id: false });

const sendHistorySchema = new Schema({
    // --- TRƯỜNG QUAN TRỌNG ĐỂ LIÊN KẾT ---
    jobId: {
        type: Schema.Types.ObjectId,
        ref: 'scheduledjob',
        required: true,
        unique: true // Mỗi job chỉ có một bản ghi lịch sử duy nhất
    },

    // --- Các thông tin chung của Job ---
    jobName: { type: String },
    actionType: { type: String },
    sentBy: { type: Schema.Types.ObjectId, ref: 'user' },
    message: { type: String }, // Chỉ có giá trị nếu là hành động sendMessage

    // --- Danh sách kết quả ---
    recipients: { type: [recipientStatusSchema], default: [] },
}, {
    timestamps: true // Tự động thêm createdAt và updatedAt
});

sendHistorySchema.index({ jobId: 1 });
sendHistorySchema.index({ sentBy: 1, createdAt: -1 });

const SendHistory = models.SendHistory || model('SendHistory', sendHistorySchema);
export default SendHistory;