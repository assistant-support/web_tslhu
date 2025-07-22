// scripts/migrate-db.js

/**
 * KỊCH BẢN DI CHUYỂN DỮ LIỆU
 * Chạy file này một lần duy nhất để cập nhật cấu trúc DB sang phiên bản mới.
 * Lệnh chạy: node scripts/migrate-db.js
 */

const mongoose = require("mongoose");
require("dotenv").config({ path: "./.env.local" });
const { Schema } = mongoose;

// =============================================================================
// === BƯỚC 1: CẤU HÌNH SCRIPT ===
// =============================================================================

// !!! QUAN TRỌNG: Hãy thay thế giá trị này bằng một ID của user có vai trò Admin
// trong database của bạn. Nó sẽ được dùng để gán cho các comment cũ.
const DEFAULT_ADMIN_ID = "6865fe3ccdec836f29fabe4f"; // <--- THAY THẾ ID NÀY

// --- ĐỊNH NGHĨA LẠI CÁC SCHEMA MỚI ---
// (Dán các schema đã được cập nhật của bạn vào đây)

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    iduser: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ["Admin", "Employee"], default: "Employee" },
    zaloActive: {
      type: Schema.Types.ObjectId,
      ref: "zaloaccount",
      default: null,
    },
  },
  { timestamps: true },
);

const CommentSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "user", required: true },
  stage: { type: Number, required: true },
  detail: { type: String, required: true },
  time: { type: Date, default: Date.now },
});

const CustomerSchema = new Schema(
  {
    name: { type: String },
    phone: { type: String, required: true },
    uid: { type: String },
    status: { type: Schema.Types.ObjectId, ref: "status" },
    stageLevel: { type: Number, default: 0 },
    comments: [CommentSchema],
    users: [{ type: Schema.Types.ObjectId, ref: "user" }],
  },
  { timestamps: true, strict: false },
);

const ActiveSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "user", required: true },
    activatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ZaloAccountSchema = new Schema(
  {
    uid: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    avt: { type: String },
    rateLimitPerHour: { type: Number, required: true, default: 50 },
    users: [{ type: Schema.Types.ObjectId, ref: "user" }],
    activeSession: { type: ActiveSessionSchema, default: null },
    isLocked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// --- ĐĂNG KÝ MODEL ---
const User = mongoose.models.user || mongoose.model("user", UserSchema);
const Customer =
  mongoose.models.customer || mongoose.model("customer", CustomerSchema);
const ZaloAccount =
  mongoose.models.zaloaccount ||
  mongoose.model("zaloaccount", ZaloAccountSchema);

// =============================================================================
// === BƯỚC 2: CÁC HÀM DI CHUYỂN DỮ LIỆU ===
// =============================================================================

async function migrateUsers() {
  console.log("\n[1/3] Bắt đầu di chuyển collection 'users'...");
  const roleMigrationLogic = {
    $cond: {
      if: { $isArray: "$role" },
      then: { $ifNull: [{ $arrayElemAt: ["$role", 0] }, "Employee"] },
      else: "$role",
    },
  };
  const result = await User.updateMany({}, [
    {
      $set: { password: "$uid", zaloActive: "$zalo", role: roleMigrationLogic },
    },
    { $unset: ["uid", "zalo", "address", "avt"] },
  ]);
  console.log(`Hoàn tất: Đã xử lý ${result.matchedCount} users.`);
}

/**
 * Di chuyển collection 'customers' bằng Aggregation Pipeline.
 * Đã sửa lỗi không thêm comment rỗng và thêm logic gán thời gian.
 */
async function migrateCustomers() {
  console.log("\n[2/3] Bắt đầu di chuyển collection 'customers'...");

  // Ghi lại thời điểm bắt đầu di chuyển để gán cho các comment cũ
  const migrationTime = new Date();

  const createCommentIfNotEmpty = (noteField) => ({
    $cond: {
      if: {
        $and: [
          { $ne: [`$${noteField}`, null] },
          { $ne: [`$${noteField}`, ""] },
        ],
      },
      then: [
        {
          user: { $ifNull: [{ $arrayElemAt: ["$auth", 0] }, DEFAULT_ADMIN_ID] },
          stage: { $ifNull: ["$stageLevel", 0] },
          detail: `$${noteField}`,
          // START: THÊM DÒNG NÀY
          time: migrationTime, // Gán thời điểm chạy script cho comment
          // END: THÊM DÒNG NÀY
        },
      ],
      else: [],
    },
  });

  const commentsPipeline = {
    $concatArrays: [
      { $ifNull: ["$comments", []] },
      createCommentIfNotEmpty("careNote"),
      createCommentIfNotEmpty("studyTryNote"),
      createCommentIfNotEmpty("studyNote"),
    ],
  };

  const result = await Customer.updateMany({}, [
    {
      $set: {
        users: { $ifNull: ["$auth", "$users"] },
        comments: commentsPipeline,
      },
    },
    {
      $unset: ["auth", "careNote", "studyTryNote", "studyNote"],
    },
  ]);

  console.log(`Hoàn tất: Đã xử lý ${result.matchedCount} customers.`);
}

async function migrateZaloAccounts() {
  console.log("\n[3/3] Bắt đầu di chuyển collection 'zaloaccounts'...");

  // SỬA LỖI: Sử dụng điều kiện tìm kiếm linh hoạt hơn.
  // Nó sẽ tìm tất cả các document có trường 'user' (dấu hiệu của dữ liệu cũ)
  // và chưa có trường 'users' (dấu hiệu chưa được di chuyển).
  const result = await ZaloAccount.updateMany(
    { user: { $exists: true }, users: { $exists: false } },
    [
      {
        $set: {
          users: ["$user"], // Chuyển user thành một mảng chứa chính nó
          activeSession: null,
        },
      },
      {
        $unset: ["user"], // Xóa trường 'user' cũ
      },
    ],
  );
  console.log(`Hoàn tất: Đã xử lý ${result.matchedCount} zaloaccounts.`);
}

// =============================================================================
// === BƯỚC 3: HÀM CHẠY CHÍNH ===
// =============================================================================
async function runMigration() {
  if (!process.env.MONGODB_URI) {
    throw new Error(
      "Lỗi: Không tìm thấy biến MONGODB_URI trong file .env.local",
    );
  }
  if (DEFAULT_ADMIN_ID === "YOUR_REAL_ADMIN_ID_HERE") {
    throw new Error(
      "Lỗi: Vui lòng cập nhật DEFAULT_ADMIN_ID trong script trước khi chạy.",
    );
  }
  console.log("Đang kết nối đến cơ sở dữ liệu...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Kết nối thành công!");

  // await migrateUsers();
  // await migrateCustomers();
  // await migrateZaloAccounts();

  console.log("\n🎉 Quá trình di chuyển dữ liệu đã hoàn tất thành công!");
  await mongoose.connection.close();
}

runMigration().catch((error) => {
  console.error("\n❌ Đã xảy ra lỗi trong quá trình di chuyển:", error);
  mongoose.connection.close();
  process.exit(1);
});
