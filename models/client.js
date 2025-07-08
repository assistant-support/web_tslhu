import { Schema, model, models } from 'mongoose';

const ActionRefSchema = new Schema(
    {
        job: { type: Schema.Types.ObjectId, ref: 'scheduledjob', required: true },
        zaloAccount: { type: Schema.Types.ObjectId, ref: 'zaloaccount', required: true },
        actionType: { type: String, enum: ['sendMessage', 'addFriend', 'findUid'], required: true },
        status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' }
    },
    { _id: false }         
);


const CustomerSchema = new Schema(
    {
        name: { type: String },
        phone: { type: String, required: true },
        uid: { type: String },
        status: { type: String },
        label: [{ type: Schema.Types.ObjectId, ref: 'label' }],
        action: { type: [ActionRefSchema], default: [] },
    },
    { timestamps: true }
);

const Customer = models.customer || model('customer', CustomerSchema);

export default Customer;