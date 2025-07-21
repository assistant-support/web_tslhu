// models/history.js
import { Schema, model, models } from "mongoose";

/**
 * Schema con để lưu trữ chi tiết về trạng thái của một hành động.
 */
const StatusDetailSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED", "PENDING", "PROCESSING", "CANCELLED"],
      required: true,
    },
    detail: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false },
);

/**
 * Schema để ghi lại lịch sử các hành động của người dùng trong hệ thống.
 */
const ActionHistorySchema = new Schema(
  {
    action: {
      type: String,
      enum: [
        "USER_LOGIN",
        "USER_LOGOUT",
        "CREATE_ZALO_ACTION_FIND_UID",
        "CREATE_ZALO_ACTION_ADD_FRIEND",
        "CREATE_ZALO_ACTION_SEND_MESSAGE",
        "DO_ZALO_ACTION_FIND_UID",
        "DO_ZALO_ACTION_ADD_FRIEND",
        "DO_ZALO_ACTION_SEND_MESSAGE",
        "UPDATE_NAME_CUSTOMER",
        "UPDATE_STAGE_CUSTOMER",
        "UPDATE_STATUS_CUSTOMER",
        "UPDATE_ADMISSION_INFORMATION_CUSTOMER",
        "ADD_COMMENT_CUSTOMER",
        "CHOSE_ZALO_ACCOUNT",
      ],
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    status: {
      type: StatusDetailSchema,
      required: true,
    },
    // (Tùy chọn) Đối tượng khách hàng bị tác động.
    customer: {
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
  { timestamps: { createdAt: "time" } },
);

const ActionHistory =
  models.actionhistory || model("actionhistory", ActionHistorySchema);

export default ActionHistory;

/**
 * @typedef {object} ActionHistory
 * @description Ghi lại một sự kiện hoặc hành động quan trọng xảy ra trong hệ thống.
 * * --- CÁC TRƯỜNG LUÔN CÓ ---
 * @property {string} action - (Bắt buộc) Tên định danh của hành động. Xem danh sách chi tiết bên dưới.
 * @property {mongoose.Schema.Types.ObjectId} user - (Bắt buộc) Người dùng đã thực hiện hành động.
 * @property {object} status - (Bắt buộc) Ghi lại trạng thái và chi tiết kết quả của hành động.
 * @property {'SUCCESS'|'FAILED'|'PENDING'|'PROCESSING'|'CANCELLED'} status.status - (Bắt buộc) Tên trạng thái.
 * @property {object} [status.detail] - (Tùy chọn) Chi tiết bổ sung về trạng thái (ví dụ: thông báo lỗi).
 * @property {Date} time - (Bắt buộc, tự động) Thời điểm hành động được ghi lại.
 *
 * --- CÁC TRƯỜNG TÙY CHỌN (Tùy thuộc vào hành động) ---
 * @property {mongoose.Schema.Types.ObjectId} [customer] - (Có khi tác động đến khách hàng) Khách hàng là đối tượng của hành động.
 * @property {mongoose.Schema.Types.ObjectId} [zaloActive] - (Có khi dùng Zalo) Tài khoản Zalo được sử dụng trong hành động.
 * @property {object} [actionDetail] - (Có với hầu hết hành động) Chi tiết cụ thể của hành động. Cấu trúc của nó được quy định bên dưới.
 *
 * * =================================================================================
 * === QUY ĐỊNH CẤU TRÚC `actionDetail` CHO TỪNG LOẠI `action` ===
 * =================================================================================
 * *
 * @action USER_LOGIN
 * @property {object} actionDetail - (Bắt buộc)
 * @property {string} actionDetail.ipAddress - (Bắt buộc) Địa chỉ IP.
 * @property {string} actionDetail.userAgent - (Bắt buộc) Thông tin trình duyệt.
 *
 * @action USER_LOGOUT
 * @property {object} actionDetail - (Bắt buộc)
 * @property {string} actionDetail.ipAddress - (Bắt buộc) Địa chỉ IP.
 * @property {string} actionDetail.userAgent - (Bắt buộc) Thông tin trình duyệt.
 * @property {string} actionDetail.sessionDuration - (Bắt buộc) Thời gian phiên làm việc.
 *
 * @action CREATE_ZALO_ACTION_FIND_UID
 * CREATE_ZALO_ACTION_ADD_FRIEND
 * CREATE_ZALO_ACTION_SEND_MESSAGE
 * DO_ZALO_ACTION_FIND_UID
 * DO_ZALO_ACTION_ADD_FRIEND
 * DO_ZALO_ACTION_SEND_MESSAGE
 * @property {object} customer - (Bắt buộc)
 * @property {object} zaloActive - (Bắt buộc)
 * @property {object} actionDetail - (Bắt buộc)
 * -> CREATE_ZALO_ACTION_FIND_UID | CREATE_ZALO_ACTION_ADD_FRIEND
 * @property {sting} actionDetail.detail - (tùy chọn) Chi tiết về hành động.
 * -> CREATE_ZALO_ACTION_SEND_MESSAGE
 * @property {sting} actionDetail.mes -(bắc buộc) Nội dung tin nhắn gửi đi.
 * -> DO_ZALO_ACTION_FIND_UID | DO_ZALO_ACTION_ADD_FRIEND | DO_ZALO_ACTION_SEND_MESSAGE
 * @property {object} actionDetail.schedule - (Bắt buộc) Thời gian được lên lịch cho hành động.
 *
 * @action UPDATE_NAME_CUSTOMER
 * @property {object} customer - (Bắt buộc)
 * @property {object} actionDetail - (Bắt buộc)
 * @property {string} actionDetail.oldName - (Bắt buộc) Tên cũ của khách hàng.
 * @property {string} actionDetail.newName - (Bắt buộc) Tên mới của khách hàng.
 *
 * @action UPDATE_STAGE_CUSTOMER
 * @property {object} customer - (Bắt buộc)
 * @property {object} actionDetail - (Bắt buộc)
 * @property {string} actionDetail.oldStage - (Bắt buộc) Giai đoạn cũ của khách hàng.
 * @property {string} actionDetail.newStage - (Bắt buộc) Giai đoạn mới của khách hàng.
 *
 * @action UPDATE_STATUS_CUSTOMER
 * @property {object} customer - (Bắt buộc)
 * @property {object} actionDetail - (Bắt buộc)
 * @property {string} actionDetail.oldStatus - (Bắt buộc) Trạng thái cũ của khách hàng.
 * @property {string} actionDetail.newStatus - (Bắt buộc) Trạng thái mới của khách hàng.
 *
 * @action UPDATE_ADMISSION_INFORMATION_CUSTOMER
 * @property {object} customer - (Bắt buộc)
 * @property {object} actionDetail - (Bắt buộc)
 * @property {string} actionDetail.oldAdmissionInfo - (Bắt buộc) Thông tin nhập học cũ của khách hàng.
 * @property {string} actionDetail.newAdmissionInfo - (Bắt buộc) Thông tin nhập học mới của khách hàng.
 *
 * @action ADD_COMMENT_CUSTOMER
 * @property {object} customer - (Bắt buộc)
 * @property {object} actionDetail - (Bắt buộc)
 * @property {mongoose.Schema.Types.ObjectId} actionDetail.commentId - (Bắt buộc) ID của bình luận vừa được tạo trong mảng `comments` của khách hàng.
 *
 * @action CHOSE_ZALO_ACCOUNT
 * @property {object} zaloActive - (tùy chọn) nếu đã chọn tk zalo trước đó.
 * @property {object} actionDetail - (Bắt buộc)
 * @property {mongoose.Schema.Types.ObjectId} actionDetail.zaloAccountIdBefore - (Bắt buộc) ID của tài khoản Zalo được chọn trước đó (nếu có).
 * @property {mongoose.Schema.Types.ObjectId} actionDetail.zaloAccountIdAfter - (Bắt buộc) ID của tài khoản Zalo được chọn mới.
 * */
