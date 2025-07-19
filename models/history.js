// models/history.js
import { Schema, model, models } from "mongoose";

/**
 * Schema để ghi lại lịch sử hành động của người dùng trong hệ thống.
 */
const ActionHistorySchema = new Schema(
  {
    // Mô tả ngắn gọn về hành động (ví dụ: 'USER_LOGIN', 'CREATE_SCHEDULE').
    action: { type: String, required: true },
    // Người dùng đã thực hiện hành động.
    user: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    // Trạng thái của hành động (thành công, thất bại...).
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED", "PENDING"],
      required: true,
    },
    // (Tùy chọn) Đối tượng khách hàng bị tác động.
    target: {
      type: Schema.Types.ObjectId,
      ref: "customer",
    },
    // (Tùy chọn) Tài khoản Zalo được sử dụng khi thực hiện hành động.
    zaloActive: {
      type: Schema.Types.ObjectId,
      ref: "zaloaccount",
    },
    // (Tùy chọn) Chứa các chi tiết bổ sung về hành động dưới dạng JSON.
    actionDetail: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: { createdAt: "time" } }, // Đổi tên trường createdAt thành 'time'
);

const ActionHistory =
  models.actionhistory || model("actionhistory", ActionHistorySchema);

export default ActionHistory;
