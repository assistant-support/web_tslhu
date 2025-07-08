import { Schema, model, models } from "mongoose";

// const CustomerSchema = new Schema(
//     {
//         name: { type: String },
//         phone: { type: String, required: true },
//         uid: { type: String },
//         status: { type: String },
//         label: [{ type: Schema.Types.ObjectId, ref: 'label' }]
//     },
//     { timestamps: true }
// );

const ActionRefSchema = new Schema(
  {
    job: { type: Schema.Types.ObjectId, ref: "scheduledjob", required: true },
    zaloAccount: {
      type: Schema.Types.ObjectId,
      ref: "zaloaccount",
      required: true,
    },
    actionType: {
      type: String,
      enum: ["sendMessage", "addFriend", "findUid"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
  },
  { _id: false },
);

const CustomerSchema = new Schema(
  {
    name: { type: String },
    phone: { type: String, required: true },
    uid: { type: String },
    // status: { type: String },
    label: [{ type: Schema.Types.ObjectId, ref: "label" }],
    stageLevel: { type: Number, default: 0 }, // 0: Mới, 1: Care, 2: OTP, 3: Nhập học
    careNote: { type: String },
    studyTryNote: { type: String },
    studyNote: { type: String },
  },
  {
    timestamps: true,
    // Thêm dòng này để Mongoose không báo lỗi khi bạn cập nhật các trường không có trong schema
    strict: false,
  },
);

const Customer = models.customer || model("customer", CustomerSchema);
export default Customer;
