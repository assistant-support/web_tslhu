const mongoose = require("mongoose");
// Đảm bảo file .env.local của bạn có biến MongoDB_URI
require("dotenv").config({ path: ".env" });

const ScheduledJob =
  mongoose.models.scheduledjob ||
  mongoose.model("scheduledjob", new mongoose.Schema({}, { strict: false }));

const ArchivedJob =
  mongoose.models.archivedjob ||
  mongoose.model("archivedjob", new mongoose.Schema({}, { strict: false }));

const Customer =
  mongoose.models.customer ||
  mongoose.model("customer", new mongoose.Schema({}, { strict: false }));

// --- START: Định nghĩa Schema cho các collection cần di trú ---

const ZaloAccountSchema = new mongoose.Schema(
  {
    rateLimitPerHour: { type: Number, default: 30 },
    actionsUsedThisHour: { type: Number, default: 0 },
    rateLimitHourStart: { type: Date, default: () => new Date() },
    rateLimitPerDay: { type: Number, default: 200 },
    actionsUsedThisDay: { type: Number, default: 0 },
    rateLimitDayStart: { type: Date, default: () => new Date() },
    isLocked: { type: Boolean, default: false },
  },
  { strict: false }, // Dùng strict: false để Mongoose không báo lỗi với các trường đã có sẵn
);

const StatusSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
  },
  { strict: false },
);
const ActionHistorySchema = new mongoose.Schema(
  {
    "actionDetail.scheduleId": { type: mongoose.Schema.Types.Mixed }, // Cho phép đọc cả String và ObjectId
  },
  { strict: false },
);
// --- END: Định nghĩa Schema ---

// --- START: Khai báo Models ---

const ZaloAccount =
  mongoose.models.zaloaccount ||
  mongoose.model("zaloaccount", ZaloAccountSchema);

const Status = mongoose.models.status || mongoose.model("status", StatusSchema);
const ActionHistory =
  mongoose.models.actionhistory ||
  mongoose.model("actionhistory", ActionHistorySchema);
// --- END: Khai báo Models ---

/**
 * Logic để di trú dữ liệu cho collection 'zaloaccounts'.
 * Thêm các trường còn thiếu và sửa các giá trị mặc định bị sai.
 */
async function migrateZaloAccounts() {
  console.log("\n--- BẮT ĐẦU DI TRÚ TÀI KHOẢN ZALO ---");

  // Logic cũ để tìm và sửa các tài khoản Zalo
  const query = {
    $or: [
      { rateLimitPerDay: { $exists: false } },
      { actionsUsedThisDay: { $exists: false } },
      { rateLimitDayStart: { $exists: false } },
    ],
  };
  const count = await ZaloAccount.countDocuments(query);

  if (count === 0) {
    console.log(
      "✅ Tất cả các tài khoản Zalo đã được đồng bộ. Không cần di trú.",
    );
    return;
  }

  console.log(`🔍 Tìm thấy ${count} tài khoản Zalo cần được cập nhật...`);
  const updateOperation = {
    $set: {
      rateLimitPerDay: 200,
      actionsUsedThisDay: 0,
      rateLimitDayStart: new Date(),
    },
  };
  const result = await ZaloAccount.updateMany(query, updateOperation);
  console.log(`✨ Cập nhật thành công ${result.modifiedCount} tài khoản Zalo!`);
}

/**
 * Logic để di trú dữ liệu cho collection 'statuses'.
 * Tự động định dạng lại tên các trạng thái theo chuẩn QTxx| <tên>.
 */
// ** MODIFIED: Cập nhật toàn bộ hàm migrateStatuses
async function migrateStatuses() {
  console.log("\n--- BẮT ĐẦU DI TRÚ TRẠNG THÁI ---");

  // Bước 1: Tìm tất cả các trạng thái CHƯA có định dạng chuẩn (QTxx|)
  const statusesToMigrate = await Status.find({
    name: { $not: /^QT\d+\|/ },
  }).lean();

  if (statusesToMigrate.length === 0) {
    console.log("✅ Không có trạng thái nào cần di trú. Dữ liệu đã chuẩn.");
    return;
  }

  console.log(
    `🔍 Tìm thấy ${statusesToMigrate.length} trạng thái cần xử lý...`,
  );

  // Bước 2: Tìm số thứ tự QT lớn nhất đã tồn tại trong DB (để đánh số cho các trạng thái mới)
  const allStatuses = await Status.find({ name: /^QT\d+\|/ }).lean();
  let maxOrder = 0;
  allStatuses.forEach((status) => {
    const match = status.name.match(/^QT(\d+)\|/);
    if (match) {
      const order = parseInt(match[1], 10);
      if (order > maxOrder) {
        maxOrder = order;
      }
    }
  });

  console.log(`📈 Số thứ tự QT lớn nhất hiện tại là: ${maxOrder}`);

  // Bước 3: Chuẩn bị các lệnh cập nhật hàng loạt
  const bulkOperations = statusesToMigrate.map((status) => {
    let newName = "";
    const oldName = status.name.trim();

    // Regex để tìm định dạng cũ, ví dụ: "QT1: Ten trang thai"
    const oldFormatMatch = oldName.match(/^QT(\d+):\s*(.*)/);

    if (oldFormatMatch) {
      // TRƯỜNG HỢP 1: Chuyển đổi từ định dạng cũ
      const orderNumber = parseInt(oldFormatMatch[1], 10);
      const cleanName = oldFormatMatch[2].trim();

      // Đảm bảo số thứ tự luôn có 2 chữ số (01, 02, ..., 11)
      const paddedOrder = String(orderNumber).padStart(2, "0");
      newName = `QT${paddedOrder}| ${cleanName}`;

      console.log(`  -> CHUYỂN ĐỔI: "${oldName}"  ==>  "${newName}"`);
    } else {
      // TRƯỜNG HỢP 2: Thêm mới tiền tố cho trạng thái chưa có
      maxOrder++; // Tăng số thứ tự lên cho trạng thái mới
      const paddedOrder = String(maxOrder).padStart(2, "0");
      newName = `QT${paddedOrder}| ${oldName}`;

      console.log(`  -> THÊM MỚI:   "${oldName}"  ==>  "${newName}"`);
    }

    return {
      updateOne: {
        filter: { _id: status._id },
        update: { $set: { name: newName } },
      },
    };
  });

  // Bước 4: Thực thi lệnh
  if (bulkOperations.length > 0) {
    const result = await Status.bulkWrite(bulkOperations);
    console.log(`✨ Cập nhật thành công ${result.modifiedCount} trạng thái!`);
  }
}

async function migrateScheduleIds() {
  console.log("\n--- BẮT ĐẦU DI TRÚ SCHEDULE ID ---");
  // Tìm tất cả các bản ghi có actionDetail.scheduleId là kiểu STRING
  const query = { "actionDetail.scheduleId": { $type: "string" } };

  const historiesToMigrate = await ActionHistory.find(query).lean();

  if (historiesToMigrate.length === 0) {
    console.log("✅ Không có scheduleId nào cần di trú. Dữ liệu đã chuẩn.");
    return;
  }

  console.log(
    `🔍 Tìm thấy ${historiesToMigrate.length} bản ghi lịch sử cần chuyển đổi scheduleId...`,
  );

  const bulkOperations = historiesToMigrate
    .map((history) => {
      // Chỉ thực hiện nếu chuỗi là một ObjectId hợp lệ
      if (mongoose.Types.ObjectId.isValid(history.actionDetail.scheduleId)) {
        return {
          updateOne: {
            filter: { _id: history._id },
            update: {
              $set: {
                "actionDetail.scheduleId": new mongoose.Types.ObjectId(
                  history.actionDetail.scheduleId,
                ),
              },
            },
          },
        };
      }
      return null; // Bỏ qua các chuỗi không hợp lệ
    })
    .filter(Boolean); // Lọc ra các giá trị null

  if (bulkOperations.length > 0) {
    const result = await ActionHistory.bulkWrite(bulkOperations);
    console.log(
      `✨ Chuyển đổi thành công ${result.modifiedCount} scheduleId từ String sang ObjectId!`,
    );
  } else {
    console.log("✅ Không có scheduleId hợp lệ nào để chuyển đổi.");
  }
}

// ++ ADDED: Hàm di trú và dọn dẹp các job bị treo
async function migrateAndCleanupHungJobs() {
  console.log(
    "\n--- BẮT ĐẦU DI TRÚ & DỌN DẸP JOB BỊ TREO (PHIÊN BẢN HOÀN THIỆN) ---",
  );

  // --- Bước 1: Quét và thu thập dữ liệu từ các job bị treo ---
  const hungJobs = await ScheduledJob.find({}).lean();

  if (hungJobs.length === 0) {
    console.log("✅ Không tìm thấy job nào bị treo trong 'scheduledjobs'.");
    return;
  }

  console.log(`🔍 Tìm thấy ${hungJobs.length} job bị treo cần xử lý...`);

  const jobsToArchive = [];
  const allHungJobIds = hungJobs.map((job) => job._id);

  // --- Bước 2: Tính toán lại Thông số & Chuẩn bị Di trú ---
  for (const job of hungJobs) {
    console.log(`  -> Đang xử lý Job: "${job.jobName}" (${job._id})`);

    const stats = job.statistics || { total: 0, completed: 0, failed: 0 };

    // Đếm số task chưa hoàn thành (bị treo)
    const pendingOrProcessingTasks = (job.tasks || []).filter(
      (task) => task.status === "pending" || task.status === "processing",
    ).length;

    // Tính toán lại thống kê một cách chính xác
    const recalculatedStats = {
      total: stats.total || (job.tasks || []).length,
      completed: stats.completed || 0,
      // **LOGIC CHUẨN**: failed mới = failed cũ + số lượng bị treo
      failed: (stats.failed || 0) + pendingOrProcessingTasks,
    };

    const archiveData = {
      ...job,
      _id: job._id,
      status: "failed", // Coi như toàn bộ job đã thất bại do bị dừng
      statistics: recalculatedStats,
      completedAt: new Date(),
    };
    delete archiveData.tasks;

    jobsToArchive.push(archiveData);
    console.log(
      `     - Thống kê cũ:      Completed: ${stats.completed}, Failed: ${stats.failed}`,
    );
    console.log(`     - Task bị treo:     ${pendingOrProcessingTasks}`);
    console.log(
      `     - Thống kê MỚI:     Completed: ${recalculatedStats.completed}, Failed: ${recalculatedStats.failed}`,
    );
  }

  // --- Bước 3: Dọn dẹp và Di trú ---
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    console.log("\n🔄 Bắt đầu giao dịch di trú và dọn dẹp...");

    // 1. Di trú các job đã chuẩn hóa
    if (jobsToArchive.length > 0) {
      await ArchivedJob.insertMany(jobsToArchive, { session });
      console.log(
        `  [1/3] ✅ Đã di trú ${jobsToArchive.length} job sang 'archivedjobs'.`,
      );
    }

    // 2. **LOGIC CHUẨN**: Dọn dẹp TOÀN BỘ tham chiếu action liên quan đến các job bị treo
    const customerUpdateResult = await Customer.updateMany(
      { "action.job": { $in: allHungJobIds } }, // Tìm tất cả customer có action liên quan
      { $pull: { action: { job: { $in: allHungJobIds } } } },
      { session },
    );
    console.log(
      `  [2/3] ✅ Đã dọn dẹp tham chiếu 'action' cho ${customerUpdateResult.modifiedCount} khách hàng.`,
    );

    // 3. Xóa các job gốc
    const deleteResult = await ScheduledJob.deleteMany(
      { _id: { $in: allHungJobIds } },
      { session },
    );
    console.log(
      `  [3/3] ✅ Đã xóa ${deleteResult.deletedCount} job gốc khỏi 'scheduledjobs'.`,
    );

    await session.commitTransaction();
    console.log("\n✨ Giao dịch hoàn tất! Dữ liệu đã được xử lý chính xác.");
  } catch (error) {
    await session.abortTransaction();
    console.error(
      "\n❌ Đã xảy ra lỗi trong giao dịch! Dữ liệu đã được khôi phục.",
      error,
    );
  } finally {
    session.endSession();
  }
}
/**
 * Hàm chính để chạy toàn bộ quá trình di trú.
 */
async function runMigration() {
  const mongoURI = process.env.MongoDB_URI;
  if (!mongoURI) {
    console.error("❌ Lỗi: Biến môi trường 'MongoDB_URI' chưa được thiết lập.");
    return;
  }

  try {
    console.log("🔄 Đang kết nối đến MongoDB...");
    await mongoose.connect(mongoURI);
    console.log("✅ Kết nối thành công!");

    // --- CHỌN LOGIC CẦN CHẠY ---
    // Bỏ comment dòng tương ứng để chạy logic di trú bạn muốn.
    // Nên chạy từng cái một để dễ kiểm soát.

    // Chạy logic di trú cho collection 'statuses'
    await migrateStatuses();

    // Chạy logic di trú cho collection 'zaloaccounts'
    await migrateZaloAccounts();
    await migrateScheduleIds(); // ++ ADDED: Chạy logic mới
    // ++ ADDED: Chạy logic di trú và dọn dẹp job bị treo
    await migrateAndCleanupHungJobs();
  } catch (error) {
    console.error("❌ Đã xảy ra lỗi trong quá trình di trú:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Đã ngắt kết nối khỏi MongoDB.");
  }
}

// Chạy hàm di trú chính
runMigration();
