const mongoose = require("mongoose");
// Đảm bảo file .env.local của bạn có biến MongoDB_URI
require("dotenv").config({ path: ".env" });

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
async function migrateStatuses() {
  console.log("\n--- BẮT ĐẦU DI TRÚ TRẠNG THÁI ---");
  // Tìm tất cả các trạng thái CHƯA có định dạng QTxx|
  const statusesToMigrate = await Status.find({ name: { $not: /^QT\d+\|/ } })
    .sort({ createdAt: 1 })
    .lean();

  if (statusesToMigrate.length === 0) {
    console.log("✅ Không có trạng thái nào cần di trú. Dữ liệu đã chuẩn.");
    return;
  }

  console.log(
    `🔍 Tìm thấy ${statusesToMigrate.length} trạng thái cần chuyển đổi...`,
  );

  const bulkOperations = statusesToMigrate.map((status, index) => {
    // Tạo số thứ tự, ví dụ: 1 -> "01", 10 -> "10"
    const order = String(index + 1).padStart(2, "0");
    const newName = `QT${order}| ${status.name.trim()}`;
    console.log(`  -> Chuyển đổi "${status.name}" thành "${newName}"`);

    return {
      updateOne: {
        filter: { _id: status._id },
        update: { $set: { name: newName } },
      },
    };
  });

  const result = await Status.bulkWrite(bulkOperations);
  console.log(`✨ Cập nhật thành công ${result.modifiedCount} trạng thái!`);
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
    // await migrateStatuses();

    // Chạy logic di trú cho collection 'zaloaccounts'
    // await migrateZaloAccounts();
    await migrateScheduleIds(); // ++ ADDED: Chạy logic mới
  } catch (error) {
    console.error("❌ Đã xảy ra lỗi trong quá trình di trú:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Đã ngắt kết nối khỏi MongoDB.");
  }
}

// Chạy hàm di trú chính
runMigration();
