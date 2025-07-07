import { Schema, model, models } from 'mongoose';

const CustomerSchema = new Schema(
    {
        name: { type: String },
        phone: { type: String, required: true },
        uid: { type: String },
        status: { type: String },
        label: [{ type: Schema.Types.ObjectId, ref: 'label' }]
    },
    { timestamps: true }
);

const Customer = models.customer || model('customer', CustomerSchema);

export default Customer;