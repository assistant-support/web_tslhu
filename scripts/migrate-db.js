// scripts/migrate-db.js

/**
 * KỊCH BẢN DI CHUYỂN DỮ LIỆU
 * Chạy file này một lần duy nhất để cập nhật cấu trúc DB.
 * Lệnh chạy: node scripts/migrate-db.js
 */

const mongoose = require("mongoose");
require("dotenv").config({ path: "./.env.local" }); // Đảm bảo đọc file .env

// --- ĐỊNH NGHĨA LẠI CÁC SCHEMA MỚI ---
// (Copy-paste các model đã được cập nhật của bạn vào đây)

// Model User MỚI
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    iduser: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ["Admin", "Employee"], default: "Employee" },
    zaloActive: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "zaloaccount",
      default: null,
    },
  },
  { timestamps: true },
);
const User = mongoose.models.user || mongoose.model("user", UserSchema);

// Model Customer MỚI
const CommentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    stage: { type: Number, required: true },
    detail: { type: String, required: true },
    time: { type: Date, default: Date.now },
  },
  { _id: false },
);

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String },
    phone: { type: String, required: true },
    uid: { type: String },
    status: { type: mongoose.Schema.Types.ObjectId, ref: "status" },
    stageLevel: { type: Number, default: 0 },
    comments: [CommentSchema],
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
  },
  { timestamps: true, strict: false },
);
const Customer =
  mongoose.models.customer || mongoose.model("customer", CustomerSchema);

// --- HÀM THỰC THI DI CHUYỂN ---
async function runMigration() {
  if (!process.env.MONGODB_URI) {
    console.error("Lỗi: Không tìm thấy biến MONGODB_URI trong file .env.local");
    return;
  }

  console.log("Đang kết nối đến cơ sở dữ liệu...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Kết nối thành công!");

  // --- 1. Di chuyển Collection 'users' ---
  console.log("\nBắt đầu di chuyển collection 'users'...");
  const allUsers = await User.find({});
  let usersUpdated = 0;

  for (const user of allUsers) {
    let needsSave = false;

    // Đổi tên uid -> password
    if (user.uid) {
      user.password = user.uid;
      user.uid = undefined; // Xóa trường cũ
      needsSave = true;
    }

    // Đổi tên zalo -> zaloActive
    if (user.zalo) {
      user.zaloActive = user.zalo;
      user.zalo = undefined;
      needsSave = true;
    }

    // Chuyển role từ mảng sang string
    if (Array.isArray(user.role) && user.role.length > 0) {
      user.role = user.role[0]; // Lấy phần tử đầu tiên
      needsSave = true;
    }

    // Xóa address và avt
    if (user.address !== undefined) {
      user.address = undefined;
      needsSave = true;
    }
    if (user.avt !== undefined) {
      user.avt = undefined;
      needsSave = true;
    }

    if (needsSave) {
      await user.save();
      usersUpdated++;
    }
  }
  console.log(
    `Hoàn tất: Đã cập nhật ${usersUpdated} / ${allUsers.length} users.`,
  );

  // --- 2. Di chuyển Collection 'customers' ---
  console.log("\nBắt đầu di chuyển collection 'customers'...");
  const allCustomers = await Customer.find({});
  let customersUpdated = 0;

  for (const customer of allCustomers) {
    let needsSave = false;

    // Đổi tên auth -> users
    if (customer.auth) {
      customer.users = customer.auth;
      customer.auth = undefined;
      needsSave = true;
    }

    // Gộp các trường Note vào comments
    const newComments = [];
    // Giả định rằng không thể biết user nào đã ghi chú cũ, nên ta có thể gán cho một admin mặc định
    // LƯU Ý: Bạn cần thay 'ADMIN_USER_ID_HERE' bằng ID của một user admin thực tế trong DB của bạn.
    const defaultUserId = "ADMIN_USER_ID_HERE";

    if (customer.careNote) {
      newComments.push({
        user: defaultUserId,
        stage: customer.stageLevel || 0,
        detail: customer.careNote,
      });
      customer.careNote = undefined;
      needsSave = true;
    }
    if (customer.studyTryNote) {
      newComments.push({
        user: defaultUserId,
        stage: customer.stageLevel || 0,
        detail: customer.studyTryNote,
      });
      customer.studyTryNote = undefined;
      needsSave = true;
    }
    if (customer.studyNote) {
      newComments.push({
        user: defaultUserId,
        stage: customer.stageLevel || 0,
        detail: customer.studyNote,
      });
      customer.studyNote = undefined;
      needsSave = true;
    }

    if (newComments.length > 0) {
      customer.comments = [...(customer.comments || []), ...newComments];
    }

    // Xóa trường action
    if (customer.action) {
      customer.action = undefined;
      needsSave = true;
    }

    if (needsSave) {
      await customer.save();
      customersUpdated++;
    }
  }
  console.log(
    `Hoàn tất: Đã cập nhật ${customersUpdated} / ${allCustomers.length} customers.`,
  );

  console.log("\nQuá trình di chuyển dữ liệu đã hoàn tất!");
  await mongoose.connection.close();
}

// Chạy hàm
runMigration().catch(console.error);
