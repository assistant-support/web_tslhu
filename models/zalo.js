// models/zalo.js
import { Schema, model, models } from "mongoose";

/**
 * Schema con để lưu trữ thông tin về phiên làm việc đang hoạt động.
 */
const ActiveSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "user", required: true },
    activatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

/**
 * Schema cho một tài khoản Zalo.
 */
const ZaloAccountSchema = new Schema(
  {
    uid: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    avt: { type: String },
    rateLimitPerHour: { type: Number, required: true, default: 50 },
    actionsUsedThisHour: { type: Number, default: 0 },
    users: [{ type: Schema.Types.ObjectId, ref: "user" }],
    activeSession: { type: ActiveSessionSchema, default: null },
    isLocked: { type: Boolean, default: false },
    action: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

const ZaloAccount =
  models.zaloaccount || model("zaloaccount", ZaloAccountSchema);

export default ZaloAccount;
