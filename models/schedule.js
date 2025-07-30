import { Schema, model, models } from "mongoose";

const TaskSchema = new Schema({
  person: {
    type: {
      name: String,
      phone: String,
      uid: String,
    },
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending",
  },
  processingId: {
    type: String, // Lưu một ID duy nhất của tiến trình CRON
    default: null,
    index: true, // Đánh index để tối ưu việc tìm kiếm
  },
  processedAt: {
    type: Date,
  },
  resultMessage: {
    type: String,
  },
  scheduledFor: { type: Date, required: true },
});

const ScheduledJobSchema = new Schema(
  {
    jobName: {
      type: String,
      required: [true, "Vui lòng nhập tên lịch trình."],
      trim: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "processing", "completed", "failed", "paused"],
      default: "scheduled",
    },
    actionType: {
      type: String,
      enum: ["sendMessage", "addFriend", "findUid"],
      required: true,
    },
    zaloAccount: {
      type: Schema.Types.ObjectId,
      ref: "zaloaccount",
      required: true,
    },

    config: {
      messageTemplate: String,
      actionsPerHour: {
        type: Number,
        required: true,
        min: 1,
      },
    },

    tasks: [TaskSchema],

    statistics: {
      total: { type: Number, default: 0 },
      completed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    estimatedCompletionTime: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const ScheduledJob =
  models.scheduledjob || model("scheduledjob", ScheduledJobSchema);

export default ScheduledJob;
