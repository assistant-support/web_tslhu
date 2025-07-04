import { Schema, model, models } from 'mongoose';

const ZaloAccountSchema = new Schema({
    uid: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    phone: {
        type: String,
        required: true,
    },
    avt: {
        type: String,
    },
    rateLimitPerHour: {
        type: Number,
        required: true,
        default: 50,
    },
    actionsUsedThisHour: {
        type: Number,
        default: 0, 
    },
    rateLimitHourStart: {
        type: Date,
        default: Date.now, 
    },
    isLocked: {
        type: Boolean,
        default: false, 
    }
}, {
    timestamps: true,
});

const ZaloAccount = models.ZaloAccount || model('ZaloAccount', ZaloAccountSchema);

export default ZaloAccount;