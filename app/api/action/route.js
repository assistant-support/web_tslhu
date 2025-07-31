import { NextResponse } from "next/server";
import connectDB from "@/config/connectDB";
import Customer from "@/models/customer";
import ScheduledJob from "@/models/schedule";
import ArchivedJob from "@/models/archivedJob";
import Variant from "@/models/variant";
import { revalidateTag } from "next/cache";
import { logExecuteScheduleTask } from "@/app/actions/historyActions";
import crypto from "crypto";
import mongoose from "mongoose";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPTIONS = () => new NextResponse(null, { headers: cors });

/**
 * Sinh tin nhắn cuối cùng từ template và các biến thể trong DB.
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

/**
 * Cập nhật dữ liệu cho Customer sau khi task được thực thi.
 */
const updateDataAfterExecution = async ({
  actionType,
  apiResult,
  customerId,
}) => {
  const customer = await Customer.findById(customerId).select("uid").lean();
  if (!customer) return;

  const updatePayload = {};
  const { uidStatus, targetUid, actionMessage, actionStatus } = apiResult;

  if (actionType === "findUid" || (actionType === "sendMessage" && uidStatus)) {
    if (uidStatus === "found_new" && targetUid) {
      updatePayload.uid = targetUid;
    } else if (uidStatus === "provided" && actionStatus === "error") {
      updatePayload.uid = null;
    } else if (uidStatus === "not_found") {
      if (actionMessage && actionMessage.includes("quá nhiều lần")) {
        if (!customer.uid || !/^\d+$/.test(customer.uid)) {
          updatePayload.uid = null;
        }
      } else {
        updatePayload.uid = actionMessage || "Lỗi không xác định";
      }
    } else if (actionType === "findUid" && actionStatus === "error") {
      updatePayload.uid = actionMessage || "Lỗi thực thi script";
    }
  }

  if (Object.keys(updatePayload).length > 0) {
    await Customer.updateOne({ _id: customerId }, { $set: updatePayload });
  }
};

/**
 * Lưu trữ và xóa một Job đã hoàn thành.
 */
const archiveAndRemoveJob = async (jobId) => {
  try {
    const jobToArchive = await ScheduledJob.findById(jobId).lean();
    if (!jobToArchive) return;

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
    const cronProcessId = new mongoose.Types.ObjectId().toString();

    while (true) {
      const jobWithLockedTask = await ScheduledJob.findOneAndUpdate(
        {
          status: { $in: ["scheduled", "processing"] },
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
            "tasks.$.processedAt": now,
          },
        },
        {
          new: true,
          sort: { "tasks.scheduledFor": 1 },
        },
      ).populate("zaloAccount createdBy"); // Populated createdBy

      if (!jobWithLockedTask) {
        break; // Không còn task nào để xử lý
      }

      const taskToProcess = jobWithLockedTask.tasks.find(
        (t) => t.processingId === cronProcessId,
      );

      if (!taskToProcess) {
        continue; // Lỗi logic hiếm gặp, bỏ qua để vòng lặp tiếp tục
      }

      const jobInfo = jobWithLockedTask; // Đã populate sẵn
      const bot = jobInfo.zaloAccount;

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

      // Thực hiện ghi log và cập nhật UID song song
      await Promise.all([
        logExecuteScheduleTask({
          jobInfo: {
            jobId: jobInfo._id.toString(),
            jobName: jobInfo.jobName,
            actionType: jobInfo.actionType,
            createdBy: jobInfo.createdBy._id,
            zaloAccountId: bot._id,
            config: jobInfo.config,
          },
          task: taskToProcess,
          customerId: taskToProcess.person._id,
          statusName: logStatus,
          executionResult,
          finalMessage,
        }),
        updateDataAfterExecution({
          actionType: jobInfo.actionType,
          apiResult: executionResult,
          customerId: taskToProcess.person._id,
        }),
      ]);

      // ** MODIFIED: Thay thế logic update & check bằng một lệnh duy nhất
      // Kéo task đã xử lý ra khỏi mảng và cập nhật thống kê cùng lúc
      const updatedJob = await ScheduledJob.findByIdAndUpdate(
        jobInfo._id,
        {
          $pull: { tasks: { _id: taskToProcess._id } },
          $inc: {
            [executionStatus === "completed"
              ? "statistics.completed"
              : "statistics.failed"]: 1,
          },
        },
        { new: true }, // Trả về document sau khi đã cập nhật
      );

      processedCount++;

      // ** MODIFIED: Kiểm tra job hoàn thành dựa trên kết quả trả về
      // Nếu mảng tasks rỗng, job đã xong
      if (updatedJob && updatedJob.tasks.length === 0) {
        await archiveAndRemoveJob(updatedJob._id);
      }
    }

    if (processedCount > 0) {
      revalidateTag("customer_data");
    }

    return NextResponse.json({
      headers: cors,
      message: `Cron job đã chạy. Xử lý ${processedCount} tác vụ.`,
    });
  } catch (err) {
    console.error("CRON JOB FAILED:", err);
    return NextResponse.json(
      { message: "Lỗi nghiêm trọng trong CRON job.", error: err.message },
      { status: 500, headers: cors },
    );
  }
};
