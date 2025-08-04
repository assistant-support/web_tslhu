import { NextResponse } from "next/server";
import connectDB from "@/config/connectDB";
import Customer from "@/models/customer";
import ScheduledJob from "@/models/schedule";
import ArchivedJob from "@/models/archivedJob";
import Variant from "@/models/variant";
import { revalidateTag } from "next/cache";
import {
  logExecuteScheduleTask,
  logAutoCancelTask, // ++ ADDED
} from "@/app/actions/historyActions";
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
 * Lưu trữ, dọn dẹp và xóa một Job đã hoàn thành.
 * @param {object} jobToFinish - Document của job sắp hoàn thành.
 */
// ** MODIFIED: Hàm này giờ nhận vào cả document của job để lấy danh sách khách hàng
const archiveAndCleanupJob = async (jobToFinish) => {
  if (!jobToFinish) return;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // ++ ADDED: Bước 1 - Dọn dẹp Customer.action
    const customerIds = jobToFinish.tasks.map((task) => task.person._id);
    if (customerIds.length > 0) {
      await Customer.updateMany(
        { _id: { $in: customerIds } },
        { $pull: { action: { job: jobToFinish._id } } },
        { session },
      );
    }

    // Bước 2: Lưu trữ job
    const archiveData = {
      ...jobToFinish.toObject(),
      _id: jobToFinish._id,
      status: "completed",
      completedAt: new Date(),
    };
    delete archiveData.tasks;
    await ArchivedJob.create([archiveData], { session });

    // Bước 3: Xóa job khỏi collection đang chạy
    await ScheduledJob.findByIdAndDelete(jobToFinish._id, { session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    console.error(
      `[ARCHIVE FAILED] Lỗi khi lưu trữ Job ${jobToFinish._id}:`,
      error,
    );
  } finally {
    session.endSession();
  }
};

export const GET = async () => {
  try {
    await connectDB();
    const now = new Date();

    // ++ ADDED: BƯỚC 1 - CƠ CHẾ TỰ CHỮA LỖI (SELF-HEALING)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    await ScheduledJob.updateMany(
      {
        "tasks.status": "processing",
        "tasks.processedAt": { $lt: fiveMinutesAgo },
      },
      {
        $set: {
          "tasks.$[elem].status": "failed",
          "tasks.$[elem].resultMessage":
            "Task timed out and was automatically failed.",
        },
        $inc: { "statistics.failed": 1 },
      },
      {
        arrayFilters: [
          {
            "elem.status": "processing",
            "elem.processedAt": { $lt: fiveMinutesAgo },
          },
        ],
      },
    );

    let processedCount = 0;
    const allVariants = await Variant.find().lean();

    while (true) {
      const cronProcessId = new mongoose.Types.ObjectId().toString(); // Tạo ID mới cho mỗi lần tìm
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
      const originalJobStateBeforeUpdate = await ScheduledJob.findById(
        jobWithLockedTask._id,
      ).lean();
      const jobInfo = jobWithLockedTask; // Đã populate sẵn
      const bot = jobInfo.zaloAccount;

      let executionResult;

      try {
        const scriptResponse = await executeExternalScript(
          jobWithLockedTask.actionType,
          jobWithLockedTask.zaloAccount,
          taskToProcess.person,
          jobWithLockedTask.config,
          allVariants,
        );
        executionResult = {
          ...scriptResponse.scriptResult,
          finalMessage: scriptResponse.finalMessage,
        };
      } catch (e) {
        executionResult = { actionStatus: "error", actionMessage: e.message };
      }

      const statusName =
        executionResult.actionStatus === "success" ? "SUCCESS" : "FAILED";
      const customerUpdatePayload = {};

      // ** MODIFIED: Tái cấu trúc logic xử lý kết quả
      const { uidStatus, targetUid, actionMessage } = executionResult;
      if (uidStatus === "found_new" && targetUid) {
        customerUpdatePayload.uid = targetUid;
      } else if (uidStatus === "provided" && statusName === "FAILED") {
        customerUpdatePayload.uid = null;
      } else if (
        uidStatus === "not_found" ||
        (jobWithLockedTask.actionType === "findUid" && statusName === "FAILED")
      ) {
        customerUpdatePayload.uid = actionMessage || "Lỗi không xác định";
      }

      logStatus = executionStatus === "completed" ? "SUCCESS" : "FAILED";

      // Thực hiện ghi log và cập nhật UID song song
      await Promise.all([
        logExecuteScheduleTask({
          jobInfo: jobWithLockedTask,
          task: taskToProcess,
          customerId: taskToProcess.person._id,
          statusName,
          executionResult,
          finalMessage: executionResult.finalMessage,
        }),
        Object.keys(customerUpdatePayload).length > 0
          ? Customer.updateOne(
              { _id: taskToProcess.person._id },
              { $set: customerUpdatePayload },
            )
          : Promise.resolve(),
        Customer.updateOne(
          // Dọn dẹp tham chiếu action
          { _id: taskToProcess.person._id },
          { $pull: { action: { job: jobWithLockedTask._id } } },
        ),
      ]);

      // ++ ADDED: XỬ LÝ LỖI GIỚI HẠN SAU KHI ĐÃ LOG TASK GỐC
      if (statusName === "FAILED") {
        const errorMessage = executionResult.actionMessage || "";
        let cancelScope = null;
        if (errorMessage.includes("trong 1 giờ")) cancelScope = "hour";
        else if (errorMessage.includes("trong 1 ngày")) cancelScope = "day";

        if (cancelScope) {
          const startTime = new Date(now);
          const endTime = new Date(now);
          if (cancelScope === "hour") {
            startTime.setMinutes(0, 0, 0);
            endTime.setMinutes(59, 59, 999);
          } else {
            // day
            startTime.setHours(0, 0, 0, 0);
            endTime.setHours(23, 59, 59, 999);
          }

          // Tìm các task pending trong phạm vi thời gian
          const tasksToCancel = (
            originalJobStateBeforeUpdate.tasks || []
          ).filter(
            (t) =>
              t.status === "pending" && new Date(t.scheduledFor) <= endTime,
          );

          if (tasksToCancel.length > 0) {
            console.log(
              `⚠️  Phát hiện lỗi giới hạn ${cancelScope}, đang hủy ${tasksToCancel.length} task...`,
            );

            for (const task of tasksToCancel) {
              await logAutoCancelTask(
                originalJobStateBeforeUpdate,
                task,
                cancelScope,
              );
            }

            const taskIdsToCancel = tasksToCancel.map((t) => t._id);
            const customerIdsToClean = tasksToCancel.map((t) => t.person._id);

            // Hủy hàng loạt và dọn dẹp Customer
            await Promise.all([
              ScheduledJob.updateOne(
                { _id: jobWithLockedTask._id },
                {
                  $set: {
                    "tasks.$[elem].status": "failed",
                    "tasks.$[elem].resultMessage": `Tự động hủy do đạt giới hạn ${cancelScope}`,
                  },
                  $inc: { "statistics.failed": taskIdsToCancel.length },
                },
                { arrayFilters: [{ "elem._id": { $in: taskIdsToCancel } }] },
              ),
              Customer.updateMany(
                { _id: { $in: customerIdsToClean } },
                { $pull: { action: { job: jobWithLockedTask._id } } },
              ),
            ]);
            console.log(
              `✅  Đã hủy và dọn dẹp thành công ${tasksToCancel.length} task.`,
            );
          }
        }
      }

      const updatedJob = await ScheduledJob.findByIdAndUpdate(
        jobWithLockedTask._id,
        {
          $pull: { tasks: { _id: taskToProcess._id } },
          $inc: {
            [statusName === "SUCCESS"
              ? "statistics.completed"
              : "statistics.failed"]: 1,
          },
        },
        { new: true }, // Trả về document sau khi đã cập nhật
      );

      processedCount++;

      if (updatedJob && updatedJob.tasks.length === 0) {
        await archiveAndCleanupJob(originalJobStateBeforeUpdate);
      }
    }

    if (processedCount > 0) {
      revalidateTag("customer_data");
      revalidateTag("running_jobs");
    }

    return NextResponse.json({
      headers: cors,
      message: `Cron job đã chạy. Xử lý ${processedCount} tác vụ.`,
    });
  } catch (err) {
    console.error("CRON JOB FAILED:", err);
    return NextResponse.json(
      { message: "Lỗi nghiêm trọng trong CRON job.", error: err.message },
      { status: 500 },
    );
  }
};
