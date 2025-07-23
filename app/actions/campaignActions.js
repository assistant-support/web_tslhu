// File: app/actions/campaignActions.js
"use server";

import connectDB from "@/config/connectDB";
import Label from "@/models/label";
import { revalidatePath } from "next/cache";
import ScheduledJob from "@/models/schedule";
import { getCurrentUser } from "@/lib/session";
import { logDeleteScheduleTask } from "./historyActions";

/**
 * Lấy tất cả các chiến dịch (labels) từ database.
 * @returns {Promise<Array>} Mảng các chiến dịch.
 */
export async function getLabel() {
  try {
    await connectDB();
    const campaigns = await Label.find({}).sort({ createdAt: -1 }).lean();
    return JSON.parse(JSON.stringify(campaigns));
  } catch (error) {
    console.error("Lỗi khi lấy danh sách chiến dịch:", error);
    return [];
  }
}

/**
 * Tạo hoặc cập nhật một Nhãn (Label).
 * Sửa đổi: Giờ đây sẽ trả về document đã được tạo/cập nhật.
 */
export async function createOrUpdateLabel(data) {
  try {
    await connectDB();
    const { id, title, desc, content } = data; // Thêm `desc`

    if (!title) {
      throw new Error("Tên nhãn là bắt buộc.");
    }

    let savedLabel;
    if (id) {
      // Cập nhật và trả về document mới
      savedLabel = await Label.findByIdAndUpdate(
        id,
        { title, desc, content },
        { new: true }, // {new: true} để trả về bản ghi sau khi cập nhật
      ).lean();
    } else {
      // Tạo mới và trả về document mới
      savedLabel = await Label.create({ title, desc, content });
      savedLabel = savedLabel.toObject(); // Chuyển sang object thuần
    }

    revalidatePath("/admin");
    // Trả về dữ liệu đã được lưu dưới dạng object JSON
    return { success: true, data: JSON.parse(JSON.stringify(savedLabel)) };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Xóa một chiến dịch dựa trên ID.
 * @param {string} id - ID của chiến dịch cần xóa.
 * @returns {Promise<object>} Kết quả { success: true } hoặc { error: '...' }.
 */
export async function deleteLabel(id) {
  try {
    await connectDB();
    await Label.findByIdAndDelete(id);
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Lấy tất cả các chiến dịch (jobs) đang có trạng thái 'processing' hoặc 'scheduled'.
 * Hàm này dành cho trang Admin.
 * @returns {Promise<Array>} - Mảng các object job đang chạy.
 */
export async function getRunningJobs() {
  try {
    await connectDB();
    const runningJobs = await ScheduledJob.find({
      status: { $in: ["processing", "scheduled"] },
    })
      .sort({ createdAt: -1 }) // Ưu tiên hiển thị job mới nhất
      .lean(); // .lean() để tăng tốc độ truy vấn, chỉ trả về object thuần túy

    return JSON.parse(JSON.stringify(runningJobs));
  } catch (error) {
    console.error("Lỗi trong getRunningJobs:", error);
    return []; // Luôn trả về một mảng rỗng nếu có lỗi
  }
}

/**
 * Dừng và xóa hoàn toàn một lịch trình đang chạy.
 * @param {string} scheduleId - ID của lịch trình cần dừng.
 * @returns {Promise<object>} - Kết quả thực thi.
 */
export async function stopSchedule(scheduleId) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    await connectDB();

    // Bước 1: Tìm lịch trình để lấy thông tin trước khi xóa
    const jobToStop = await ScheduledJob.findById(scheduleId).lean();
    if (!jobToStop) {
      return { error: "Không tìm thấy lịch trình để dừng." };
    }

    // Bước 2: Xóa lịch trình khỏi DB
    await ScheduledJob.findByIdAndDelete(scheduleId);

    // Bước 3: Lặp qua danh sách khách hàng đã bị ảnh hưởng để ghi log
    for (const task of jobToStop.tasks) {
      await logDeleteScheduleTask(user, jobToStop, task);
    }

    revalidatePath("/admin");
    return { success: true, message: "Lịch trình đã được dừng thành công." };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Xóa một người nhận (task) ra khỏi một lịch trình đang chạy.
 * @param {string} scheduleId - ID của lịch trình.
 * @param {string} taskId - ID của task cần xóa.
 * @returns {Promise<object>} - Kết quả thực thi.
 */
export async function removeTaskFromSchedule(scheduleId, taskId) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    await connectDB();

    const schedule = await ScheduledJob.findById(scheduleId);
    if (!schedule) return { error: "Không tìm thấy lịch trình." };

    const removedTask = schedule.tasks.find((t) => t._id.toString() === taskId);
    if (!removedTask)
      return { error: "Không tìm thấy người nhận trong lịch trình." };

    // Ghi log cho hành động xóa task này
    await logDeleteScheduleTask(user, schedule, removedTask);

    // Cập nhật lại DB
    await ScheduledJob.findByIdAndUpdate(scheduleId, {
      $pull: { tasks: { _id: taskId } },
      $inc: { "statistics.total": -1 },
    });

    revalidatePath("/admin");
    return { success: true, message: "Đã xóa người nhận khỏi lịch trình." };
  } catch (error) {
    return { error: error.message };
  }
}
