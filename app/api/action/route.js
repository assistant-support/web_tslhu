import { NextResponse } from "next/server";
import connectDB from "@/config/connectDB";
import Customer from "@/models/customer";
import ZaloAccount from "@/models/zalo";
import ScheduledJob from "@/models/schedule";
import ArchivedJob from "@/models/archivedJob";
import Variant from "@/models/variant";
import { revalidateTag } from "next/cache";
import { logExecuteScheduleTask } from "@/app/actions/historyActions";
import crypto from "crypto";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPTIONS = () => new NextResponse(null, { headers: cors });

/**
 * Sinh tin nhắn cuối cùng từ template và các biến thể trong DB.
 * @param {string} messageTemplate - Tin nhắn gốc chứa placeholder.
 * @param {Array} variants - Mảng các document biến thể từ DB.
 * @returns {string} Tin nhắn cuối cùng.
 */
const generateFinalMessage = (messageTemplate, variants) => {
  if (!messageTemplate || !variants.length) {
    return messageTemplate;
  }
  let finalMessage = messageTemplate;
  const placeholders = messageTemplate.match(/{\w+}/g) || [];

  for (const placeholder of placeholders) {
    const variantName = placeholder.slice(1, -1).toLowerCase();
    const variant = variants.find((v) => v.name === variantName);
    if (variant && variant.words.length > 0) {
      const randomWord =
        variant.words[Math.floor(Math.random() * variant.words.length)];
      finalMessage = finalMessage.replace(placeholder, randomWord);
    }
  }
  return finalMessage;
};

/**
 * Gửi yêu cầu đến script bên ngoài.
 * @returns {object} { finalMessage, scriptResult }
 */
const executeExternalScript = async (type, acc, person, cfg, variants) => {
  let finalMessage = null;
  if (type === "sendMessage" && cfg.messageTemplate) {
    finalMessage = generateFinalMessage(cfg.messageTemplate, variants);
  }

  const response = await fetch(acc.action, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      uid: acc.uid,
      phone: person.phone,
      uidPerson: person.uid || null,
      actionType: type,
      message: finalMessage || "",
    }),
    cache: "no-store",
  });

  const jsonResponse = await response.json();
  if (!response.ok || jsonResponse.status === "error") {
    throw new Error(jsonResponse.message || "Lỗi không xác định từ script");
  }
  return { finalMessage, scriptResult: jsonResponse.data };
};

const updateDataAfterExecution = async ({
  actionType,
  apiResult,
  customerId,
}) => {
  const customer = await Customer.findById(customerId).select("uid").lean();
  if (!customer) return;

  const updatePayload = {};
  const { uidStatus, targetUid, actionMessage, actionStatus } = apiResult;

  // Chỉ thực hiện logic cập nhật UID nếu hành động là 'findUid',
  // hoặc là 'sendMessage' và script đã phải tự tìm UID.
  if (actionType === "findUid" || (actionType === "sendMessage" && uidStatus)) {
    // Kịch bản 1: Tìm thấy UID mới thành công
    if (uidStatus === "found_new" && targetUid) {
      updatePayload.uid = targetUid;
    }
    // Kịch bản 2: UID cung cấp bị lỗi, không hợp lệ
    else if (uidStatus === "provided" && actionStatus === "error") {
      updatePayload.uid = null;
    }
    // Kịch bản 3: Không tìm thấy UID (do rate limit hoặc lỗi khác)
    else if (uidStatus === "not_found") {
      if (actionMessage && actionMessage.includes("quá nhiều lần")) {
        if (!customer.uid || !/^\d+$/.test(customer.uid)) {
          updatePayload.uid = null;
        }
      } else {
        updatePayload.uid = actionMessage || "Lỗi không xác định";
      }
    }
    // Kịch bản 4 (Catch-all): Bắt các lỗi không có uidStatus (vd: fetch failed)
    // chỉ khi hành động là 'findUid'.
    else if (actionType === "findUid" && actionStatus === "error") {
      updatePayload.uid = actionMessage || "Lỗi thực thi script";
    }
  }

  if (Object.keys(updatePayload).length > 0) {
    await Customer.updateOne({ _id: customerId }, { $set: updatePayload });
  }
};

/**
 * Hàm lưu trữ giờ đây nhận vào object job đầy đủ từ vòng lặp CRON.
 * @param {object} jobData - Object job từ pipeline aggregate.
 */
const archiveAndRemoveJob = async (jobData) => {
  // Chỉ cần một truy vấn cuối cùng để lấy statistics mới nhất.
  const finalJobState = await ScheduledJob.findById(jobData.jobId)
    .select("statistics")
    .lean();

  // Nếu job đã bị xóa bởi một tiến trình khác, dừng lại.
  if (!finalJobState) return;

  await ArchivedJob.create({
    _id: jobData.jobId,
    jobName: jobData.jobName,
    status: "completed",
    actionType: jobData.actionType,
    zaloAccount: jobData.bot._id, // Lấy ID từ object bot đã được populate
    config: jobData.config,
    statistics: finalJobState.statistics, // Sử dụng statistics mới nhất
    createdAt: jobData.createdAt,
    completedAt: new Date(),
    estimatedCompletionTime: jobData.estimatedCompletionTime,
    createdBy: jobData.createdBy,
  });

  await ScheduledJob.findByIdAndDelete(jobData.jobId);
};

export const GET = async () => {
  try {
    await connectDB();
    const now = new Date();
    let processedCount = 0;
    const allVariants = await Variant.find().lean();
    const cronProcessId = crypto.randomBytes(16).toString("hex"); // Tạo ID định danh cho lần chạy CRON này

    while (true) {
      // PHA 1: TÌM VÀ "KHÓA" MỘT TÁC VỤ DUY NHẤT
      // Lệnh này sẽ tìm một job có task thỏa mãn điều kiện,
      // và cập nhật nguyên tử status của task đó sang 'processing' và gán processingId.
      const jobWithLockedTask = await ScheduledJob.findOneAndUpdate(
        {
          status: { $in: ["scheduled", "processing"] },
          "tasks.status": "pending",
          "tasks.scheduledFor": { $lte: now },
        },
        {
          $set: {
            status: "processing",
            "tasks.$.status": "processing",
            "tasks.$.processingId": cronProcessId,
          },
        },
        {
          new: true, // Trả về document sau khi đã cập nhật
          sort: { "tasks.scheduledFor": 1 }, // Ưu tiên task cũ nhất
        },
      ).populate("zaloAccount");

      // Nếu không tìm thấy tác vụ nào nữa, thoát khỏi vòng lặp
      if (!jobWithLockedTask) {
        break;
      }

      // Lấy ra đúng tác vụ vừa được khóa bởi tiến trình CRON này
      const taskToProcess = jobWithLockedTask.tasks.find(
        (t) => t.processingId === cronProcessId,
      );

      // Nếu vì một lý do nào đó không tìm thấy task (rất hiếm), bỏ qua
      if (!taskToProcess) {
        continue;
      }

      const {
        zaloAccount: bot,
        _id: jobId,
        ...jobInfo
      } = JSON.parse(JSON.stringify(jobWithLockedTask));

      // PHA 2: THỰC THI TÁC VỤ ĐÃ ĐƯỢC KHÓA AN TOÀN
      let executionResult, finalMessage, logStatus, executionStatus;

      try {
        const { scriptResult, finalMessage: msg } = await executeExternalScript(
          jobInfo.actionType,
          bot,
          taskToProcess.person,
          jobInfo.config,
          allVariants,
        );
        executionResult = scriptResult;
        finalMessage = msg;
        executionStatus =
          executionResult.actionStatus === "success" ? "completed" : "failed";
      } catch (e) {
        executionResult = { actionStatus: "error", actionMessage: e.message };
        executionStatus = "failed";
      }

      logStatus = executionStatus === "completed" ? "SUCCESS" : "FAILED";
      const customer = await Customer.findById(taskToProcess.person._id)
        .select("_id")
        .lean();
      if (!customer) continue;

      // PHA 3: GHI LOG VÀ CẬP NHẬT TRẠNG THÁI
      await Promise.all([
        logExecuteScheduleTask({
          jobInfo: { ...jobInfo, jobId, zaloAccountId: bot._id },
          task: taskToProcess,
          customerId: customer._id,
          statusName: logStatus,
          executionResult,
          finalMessage,
        }),
        updateDataAfterExecution({
          // Truyền actionType vào
          actionType: jobInfo.actionType,
          apiResult: executionResult,
          customerId: customer._id,
        }),
        // Cập nhật trạng thái của task con và tăng chỉ số thống kê
        ScheduledJob.updateOne(
          { _id: jobId, "tasks._id": taskToProcess._id },
          {
            $set: {
              "tasks.$.status": executionStatus,
              "tasks.$.processedAt": new Date(),
              "tasks.$.resultMessage": executionResult.actionMessage,
            },
            $inc: { [`statistics.${executionStatus}`]: 1 },
          },
        ),
      ]);

      processedCount++;

      // Kiểm tra và lưu trữ job nếu đã hoàn thành (tất cả các task đều không còn ở trạng thái pending)
      const remainingTasks = await ScheduledJob.countDocuments({
        _id: jobId,
        "tasks.status": "pending",
      });
      if (remainingTasks === 0) {
        await archiveAndRemoveJob(jobId);
      }
    }

    if (processedCount > 0) {
      revalidateTag("customer_data");
    }

    return NextResponse.json({
      message: `Cron job đã chạy. Xử lý an toàn ${processedCount} tác vụ.`,
    });
  } catch (err) {
    console.error("CRON JOB FAILED:", err);
    return NextResponse.json(
      { message: "Lỗi nghiêm trọng trong CRON job.", error: err.message },
      { status: 500 },
    );
  }
};
