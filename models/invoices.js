import { Schema, model, models } from 'mongoose'

const postInvoices = new Schema({
    studentId: { type: Schema.Types.ObjectId, required: true, ref: 'student' },
    courseId: { type: Schema.Types.ObjectId, required: true, ref: 'course' },
    amountInitial: { type: Number },
    amountPaid: { type: Number },
    paymentMethod: { type: Number, enum: [1, 2, 3], default: 1 },
    discount: { type: Number, default: 0 },
    createBy: { type: Schema.Types.ObjectId, required: true, ref: 'user' },
}, { timestamps: true })

const invoices = models.invoice || model('invoice', postInvoices)

export default invoices