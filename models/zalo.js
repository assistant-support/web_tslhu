import { Schema, model, models } from 'mongoose';

const TaskRefSchema = new Schema(
    {
        id: { type: Schema.Types.ObjectId, ref: 'scheduledjob', required: true },
        actionType: {
            type: String,
            enum: ['sendMessage', 'addFriend', 'findUid'],
            required: true,
        },
    },
    { _id: false }
);

const ZaloAccountSchema = new Schema({
    uid: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    name: { type: String, required: true, trim: true, },
    phone: { type: String, required: true },
    avt: { type: String },
    rateLimitPerHour: {
        type: Number,
        required: true,
        default: 50,
    },
    actionsUsedThisHour: { type: Number, default: 0 },
    rateLimitHourStart: { type: Date, default: Date.now },
    task: { type: [TaskRefSchema], default: [] },
    isLocked: { type: Boolean, default: false },
    user: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    action: { type: String }
}, {
    timestamps: true,
});

const ZaloAccount = models.zaloaccount || model('zaloaccount', ZaloAccountSchema);

export default ZaloAccount;