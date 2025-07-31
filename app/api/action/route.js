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

const archiveAndRemoveJob = async (jobId) => {
  try {
    // Tự truy vấn tất cả thông tin cần thiết của job đã hoàn thành
    const jobToArchive = await ScheduledJob.findById(jobId).lean();

    if (!jobToArchive) {
      console.log(`[ARCHIVE] Job ${jobId} không còn tồn tại để lưu trữ.`);
      return;
    }

    await ArchivedJob.create({
      _id: jobToArchive._id,
      jobName: jobToArchive.jobName,
      status: "completed",
      actionType: jobToArchive.actionType,
      zaloAccount: jobToArchive.zaloAccount,
      config: jobToArchive.config,
      statistics: jobToArchive.statistics,
      createdAt: jobToArchive.createdAt,
      completedAt: new Date(),
      estimatedCompletionTime: jobToArchive.estimatedCompletionTime,
      createdBy: jobToArchive.createdBy,
    });

    await ScheduledJob.findByIdAndDelete(jobId);
    // console.log(`[ARCHIVE] Đã lưu trữ và xóa thành công Job ${jobId}.`);
  } catch (error) {
    console.error(`[ARCHIVE FAILED] Lỗi khi lưu trữ Job ${jobId}:`, error);
  }
};

export const GET = async () => {
  try {
    await connectDB();
    const now = new Date();
    let processedCount = 0;
    const allVariants = await Variant.find().lean();
    const cronProcessId = crypto.randomBytes(16).toString("hex");

    while (true) {
      //<-----------------THAY ĐỔI: Sử dụng $elemMatch để truy vấn chính xác----------------->
      const jobWithLockedTask = await ScheduledJob.findOneAndUpdate(
        {
          status: { $in: ["scheduled", "processing"] },
          // Điều kiện này đảm bảo chỉ tìm job có một task ĐỒNG THỜI pending VÀ đã đến hạn
          tasks: {
            $elemMatch: {
              status: "pending",
              scheduledFor: { $lte: now },
            },
          },
        },
        {
          $set: {
            status: "processing",
            "tasks.$.status": "processing",
            "tasks.$.processingId": cronProcessId,
          },
        },
        {
          new: true,
          sort: { "tasks.scheduledFor": 1 },
        },
      ).populate("zaloAccount");

      if (!jobWithLockedTask) {
        break;
      }

      const taskToProcess = jobWithLockedTask.tasks.find(
        (t) => t.processingId === cronProcessId,
      );
      if (!taskToProcess) {
        continue;
      }

      const jobIdString = jobWithLockedTask._id.toString();
      const bot = jobWithLockedTask.zaloAccount;
      const jobInfo = jobWithLockedTask.toObject();

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

      await Promise.all([
        logExecuteScheduleTask({
          jobInfo: { ...jobInfo, jobId: jobIdString, zaloAccountId: bot._id },
          task: taskToProcess,
          customerId: customer._id,
          statusName: logStatus,
          executionResult,
          finalMessage,
        }),
        updateDataAfterExecution({
          actionType: jobInfo.actionType,
          apiResult: executionResult,
          customerId: customer._id,
        }),
        ScheduledJob.updateOne(
          { "tasks._id": taskToProcess._id }, // Cập nhật chính xác task con
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

      const remainingPendingTasks = await ScheduledJob.countDocuments({
        _id: jobWithLockedTask._id,
        "tasks.status": "pending",
      });
      if (remainingPendingTasks === 0) {
        await archiveAndRemoveJob(jobWithLockedTask._id);
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
