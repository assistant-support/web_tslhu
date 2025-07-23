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

// Hợp nhất logic "biến thể" vào hàm exec
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
  console.log("Kết quả từ script:", j); // Giữ lại log để debug nếu cần

  if (!r.ok || j.status === "error") {
    throw new Error(j.message || "script error");
  }
  return j.data;
};

const archiveAndRemoveJob = async (jobId) => {
  const finishedJob = await ScheduledJob.findById(jobId).lean();
  if (!finishedJob) return;

  await ArchivedJob.create({
    _id: finishedJob._id,
    jobName: finishedJob.jobName,
    status: "completed",
    actionType: finishedJob.actionType,
    zaloAccount: finishedJob.zaloAccount,
    config: finishedJob.config,
    statistics: finishedJob.statistics,
    createdAt: finishedJob.createdAt,
    completedAt: new Date(),
    estimatedCompletionTime: finishedJob.estimatedCompletionTime,
    createdBy: finishedJob.createdBy,
  });

  await ScheduledJob.findByIdAndDelete(jobId);
};

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
          bot: 1,
          task: "$tasks",
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

      const jobAfterUpdate = await ScheduledJob.findById(jobId).lean();
      if (jobAfterUpdate && jobAfterUpdate.tasks.length === 0) {
        await archiveAndRemoveJob(jobId);
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
