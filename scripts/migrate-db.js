// migrate_zalo_accounts.js

const mongoose = require("mongoose");
require("dotenv").config({ path: ".env" });

// --- Định nghĩa lại Schema của ZaloAccount để script hiểu ---
const ZaloAccountSchema = new mongoose.Schema(
  {
    // Chúng ta không cần định nghĩa lại toàn bộ, chỉ cần các trường liên quan
    rateLimitPerDay: { type: Number, default: 200 },
    actionsUsedThisDay: { type: Number, default: 0 },
    rateLimitDayStart: { type: Date, default: () => new Date() },
  },
  { strict: false },
); // strict: false để Mongoose không xóa các trường không được định nghĩa

const ZaloAccount =
  mongoose.models.zaloaccount ||
  mongoose.model("zaloaccount", ZaloAccountSchema);

// --- Hàm chính để chạy di trú ---
async function runMigration() {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error("❌ Lỗi: Biến môi trường MONGODB_URI chưa được thiết lập.");
    return;
  }

  try {
    console.log("🔄 Đang kết nối đến MongoDB...");
    await mongoose.connect(mongoURI);
    console.log("✅ Kết nối thành công!");

    // Tìm tất cả các tài khoản Zalo chưa có trường `rateLimitPerDay`
    const accountsToUpdate = await ZaloAccount.find({
      rateLimitPerDay: { $exists: false },
    });

    if (accountsToUpdate.length === 0) {
      console.log(
        "✅ Tất cả các tài khoản Zalo đã được cập nhật. Không cần di trú.",
      );
      return;
    }

    console.log(
      `🔍 Tìm thấy ${accountsToUpdate.length} tài khoản cần cập nhật...`,
    );

    // Thực hiện cập nhật hàng loạt
    const result = await ZaloAccount.updateMany(
      { rateLimitPerDay: { $exists: false } }, // Điều kiện: chỉ cập nhật những document thiếu trường này
      {
        $set: {
          rateLimitPerDay: 200,
          actionsUsedThisDay: 0,
          rateLimitDayStart: new Date(),
        },
      },
    );

    console.log(`✨ Cập nhật thành công ${result.modifiedCount} tài khoản!`);
  } catch (error) {
    console.error("❌ Đã xảy ra lỗi trong quá trình di trú:", error);
  } finally {
    // Đảm bảo luôn đóng kết nối
    await mongoose.disconnect();
    console.log("🔌 Đã ngắt kết nối khỏi MongoDB.");
  }
}

// Chạy hàm
runMigration();
