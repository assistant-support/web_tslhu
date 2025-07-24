import { NextResponse } from "next/server";
import connectDB from "@/config/connectDB";
import Customer from "@/models/customer";
import ZaloAccount from "@/models/zalo";
import ScheduledJob from "@/models/schedule";
import ArchivedJob from "@/models/archivedJob";
import { revalidateTag } from "next/cache";
import { logExecuteScheduleTask } from "@/app/actions/historyActions";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const OPTIONS = () => new NextResponse(null, { headers: cors });

const exec = async (type, acc, person, cfg) => {
  const wordList = [
    "chứ",
    "chớ",
    "mừ",
    "mờ",
    "cơ",
    "dzậy",
    "hăm",
    "lắm á",
    "luôn á",
    "luôn nhen",
    "à nghen",
    "ơi",
    "ớ",
    "đi ha",
    "nha",
    "nà",
    "nhé",
    "nhá",
    "nhen",
    "nghen",
    "đó",
    "á",
    "à",
    "ha",
  ];
  let message;

  if (type === "sendMessage" && cfg.messageTemplate) {
    message = cfg.messageTemplate;
    if (message.includes("{bienthe1}")) {
      const randomIndex = Math.floor(Math.random() * wordList.length);
      const randomWord = wordList[randomIndex];
      message = message.replace("{bienthe1}", randomWord);
    }
  }

  const r = await fetch(acc.action, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      uid: acc.uid,
      phone: person.phone,
      uidPerson: person.uid || null,
      actionType: type,
      message: message || "",
    }),
    cache: "no-store",
  });

  const j = await r.json();
  console.log("Kết quả từ script:", j);

  if (!r.ok || j.status === "error") {
    throw new Error(j.message || "script error");
  }
  return j.data;
};

// ================= START: SỬA LỖI LOGIC =================
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
// =================  END: SỬA LỖI LOGIC  =================

export const GET = async () => {
  try {
    await connectDB();
    const now = new Date();
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
      const { bot, task, jobId, createdBy, jobName, actionType, config } = item;
      if (item.status === "scheduled") {
        await ScheduledJob.findByIdAndUpdate(jobId, { status: "processing" });
      }

      const acc = await ZaloAccount.findById(bot._id);
      if (
        !acc ||
        (Date.now() - (acc.rateLimitHourStart || 0) >= 3600000
          ? ((acc.actionsUsedThisHour = 0),
            (acc.rateLimitHourStart = new Date()),
            await acc.save(),
            false)
          : acc.actionsUsedThisHour >= acc.rateLimitPerHour)
      ) {
        continue;
      }

      let apiResult;
      try {
        apiResult = await exec(actionType, acc, task.person, config);
      } catch (e) {
        apiResult = { actionStatus: "error", actionMessage: e.message };
      }

      const executionStatus =
        apiResult.actionStatus === "success" ? "completed" : "failed";
      const logStatus = executionStatus === "completed" ? "SUCCESS" : "FAILED";
      const customer = await Customer.findOne({ phone: task.person.phone })
        .select("_id")
        .lean();

      if (!customer) {
        console.warn(
          `Không tìm thấy khách hàng với SĐT: ${task.person.phone}. Bỏ qua task.`,
        );
        await ScheduledJob.updateOne(
          { _id: jobId },
          { $pull: { tasks: { _id: task._id } } },
        );
        continue;
      }

      await logExecuteScheduleTask(
        { jobId, jobName, actionType, createdBy, zaloAccountId: acc._id },
        task,
        customer._id,
        logStatus,
        apiResult,
      );

      await Promise.all([
        actionType === "findUid" &&
          apiResult.uidStatus === "found_new" &&
          apiResult.targetUid &&
          Customer.updateOne(
            { _id: customer._id },
            { $set: { uid: apiResult.targetUid } },
          ),
        ScheduledJob.updateOne(
          { _id: jobId },
          {
            $inc: { [`statistics.${executionStatus}`]: 1 },
            $pull: { tasks: { _id: task._id } },
          },
        ),
        Customer.updateOne(
          { _id: customer._id },
          { $pull: { action: { job: jobId } } },
        ),
        ZaloAccount.findByIdAndUpdate(acc._id, {
          $inc: { actionsUsedThisHour: 1 },
        }),
      ]);

      processedCount++;

      const jobAfterUpdate = await ScheduledJob.findById(jobId)
        .select("tasks")
        .lean();
      if (jobAfterUpdate && jobAfterUpdate.tasks.length === 0) {
        // Truyền toàn bộ object `item` đã được làm giàu dữ liệu
        await archiveAndRemoveJob(item);
      }
    }

    if (processedCount > 0) {
      revalidateTag("customer_data");
      revalidateTag("running_jobs");
    }

    return NextResponse.json(
      { message: `Cron job đã chạy. Xử lý ${processedCount} tác vụ.` },
      { headers: cors },
    );
  } catch (err) {
    console.error("CRON JOB FAILED:", err);
    return NextResponse.json(
      {
        message: "Lỗi nghiêm trọng trong quá trình xử lý cron job.",
        error: err.message,
      },
      { status: 500, headers: cors },
    );
  }
};
