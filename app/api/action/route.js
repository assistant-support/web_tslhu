import { NextResponse } from "next/server";
import connectDB from "@/config/connectDB";
import Customer from "@/models/customer";
import ZaloAccount from "@/models/zalo";
import ScheduledJob from "@/models/schedule";
import ArchivedJob from "@/models/archivedJob";
import Variant from "@/models/variant";
import { revalidateTag } from "next/cache";
import { logExecuteScheduleTask } from "@/app/actions/historyActions";

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

/**
 * Cập nhật Customer và ZaloAccount dựa trên kết quả.
 * @param {object} context - Dữ liệu cần thiết để cập nhật.
 */
const updateDataAfterExecution = async ({
  actionType,
  apiResult,
  customerId,
  zaloAccountId,
  task,
}) => {
  const updatePayload = {};

  // 1. Xử lý cập nhật UID
  if (apiResult.uidStatus === "found_new" && apiResult.targetUid) {
    updatePayload.uid = apiResult.targetUid;
  } else if (apiResult.uidStatus === "not_found") {
    // Chỉ cập nhật UID nếu không phải lỗi do rate limit
    if (!apiResult.actionMessage.includes("quá nhiều lần")) {
      updatePayload.uid = apiResult.actionMessage;
    }
  } else if (
    apiResult.uidStatus === "provided" &&
    apiResult.actionStatus === "error"
  ) {
    // UID cũ không hợp lệ -> Xóa
    updatePayload.uid = null;
  }

  if (Object.keys(updatePayload).length > 0) {
    await Customer.updateOne({ _id: customerId }, { $set: updatePayload });
  }

  // 2. Cập nhật Rate Limit (chỉ cho findUid và addFriend)
  if (actionType === "findUid" || actionType === "addFriend") {
    let actionsToConsume = 1;
    // Nếu gửi tin cho người chưa có UID, thực chất đã tốn 1 lượt findUid
    if (actionType === "sendMessage" && !task.person.uid) {
      actionsToConsume = 1;
    }

    await ZaloAccount.findByIdAndUpdate(zaloAccountId, {
      $inc: {
        actionsUsedThisHour: actionsToConsume,
        actionsUsedThisDay: actionsToConsume,
      },
    });
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
    const allVariants = await Variant.find().lean();
    const dueJobs = await ScheduledJob.aggregate([
      { $match: { status: { $in: ["scheduled", "processing"] } } },
      { $unwind: "$tasks" },
      {
        $match: {
          "tasks.status": "pending",
          "tasks.scheduledFor": { $lte: now },
        },
      },
      {
        $lookup: {
          from: "zaloaccounts",
          localField: "zaloAccount",
          foreignField: "_id",
          as: "bot",
        },
      },
      { $unwind: "$bot" },
      {
        $project: {
          jobId: "$_id",
          jobName: 1,
          status: 1,
          actionType: 1,
          config: 1,
          createdBy: 1,
          bot: 1, // Vẫn lấy cả object bot
          task: "$tasks",
          createdAt: 1,
          estimatedCompletionTime: 1,
        },
      },
    ]);

    if (!dueJobs.length) {
      return NextResponse.json(
        { message: "Không có tác vụ nào đến hạn." },
        { headers: cors },
      );
    }

    let processedCount = 0;

    for (const item of dueJobs) {
      const { bot, task, jobId, ...jobInfo } = item;

      // 1. Kiểm tra và Reset Rate Limit
      const nowMs = now.getTime();
      const hourStartMs = bot.rateLimitHourStart?.getTime() || 0;
      const dayStartMs = bot.rateLimitDayStart?.getTime() || 0;

      const updates = {};
      if (nowMs - hourStartMs >= 3_600_000) {
        updates.actionsUsedThisHour = 0;
        updates.rateLimitHourStart = now;
      }
      if (nowMs - dayStartMs >= 86_400_000) {
        updates.actionsUsedThisDay = 0;
        updates.rateLimitDayStart = now;
      }
      if (Object.keys(updates).length > 0) {
        await ZaloAccount.findByIdAndUpdate(bot._id, { $set: updates });
        // Tải lại thông tin bot sau khi reset
        Object.assign(bot, updates);
      }

      // 2. Kiểm tra trước khi thực thi
      if (
        (jobInfo.actionType !== "sendMessage" &&
          bot.actionsUsedThisHour >= bot.rateLimitPerHour) ||
        (jobInfo.actionType !== "sendMessage" &&
          bot.actionsUsedThisDay >= bot.rateLimitPerDay)
      ) {
        continue; // Bỏ qua nếu đạt giới hạn (trừ gửi tin)
      }
      if (item.status === "scheduled") {
        await ScheduledJob.findByIdAndUpdate(jobId, { status: "processing" });
      }

      let executionResult, finalMessage, logStatus, executionStatus;

      try {
        const { scriptResult, finalMessage: msg } = await executeExternalScript(
          jobInfo.actionType,
          bot,
          task.person,
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
      const customer = await Customer.findOne({ phone: task.person.phone })
        .select("_id")
        .lean();
      if (!customer) continue; // Bỏ qua nếu không tìm thấy KH

      // 4. Ghi log và Cập nhật dữ liệu
      await Promise.all([
        logExecuteScheduleTask({
          jobInfo: { ...jobInfo, jobId, zaloAccountId: bot._id },
          task,
          customerId: customer._id,
          statusName: logStatus,
          executionResult,
          finalMessage,
        }),
        updateDataAfterExecution({
          actionType: jobInfo.actionType,
          apiResult: executionResult,
          customerId: customer._id,
          zaloAccountId: bot._id,
          task: task,
        }),
        ScheduledJob.updateOne(
          { _id: jobId },
          {
            $inc: { [`statistics.${executionStatus}`]: 1 },
            $pull: { tasks: { _id: task._id } },
          },
        ),
      ]);

      processedCount++;

      // 5. Lưu trữ job nếu hoàn thành
      const jobAfterUpdate = await ScheduledJob.findById(jobId)
        .select("tasks")
        .lean();
      if (jobAfterUpdate && jobAfterUpdate.tasks.length === 0) {
        await archiveAndRemoveJob(item);
      }
    }

    if (processedCount > 0) revalidateTag("customer_data");
    return NextResponse.json(
      { message: `Cron job đã chạy. Xử lý ${processedCount} tác vụ.` },
      { headers: cors },
    );
  } catch (err) {
    console.error("CRON JOB FAILED:", err);
    return NextResponse.json(
      { message: "Lỗi nghiêm trọng trong CRON job.", error: err.message },
      { status: 500, headers: cors },
    );
  }
};
