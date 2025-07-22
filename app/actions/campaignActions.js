// File: app/actions/campaignActions.js
"use server";

import connectDB from "@/config/connectDB";
import Label from "@/models/label";
import { revalidatePath } from "next/cache";

/**
 * Lấy tất cả các chiến dịch (labels) từ database.
 * @returns {Promise<Array>} Mảng các chiến dịch.
 */
export async function getCampaigns() {
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
 * Tạo hoặc cập nhật một chiến dịch.
 * Nếu có `id`, hàm sẽ cập nhật. Nếu không, hàm sẽ tạo mới.
 * @param {object} data - Dữ liệu của chiến dịch.
 * @param {string} [data.id] - ID của chiến dịch cần cập nhật (tùy chọn).
 * @param {string} data.title - Tên chiến dịch.
 * @param {string} data.content - Nội dung mẫu của chiến dịch.
 * @returns {Promise<object>} Kết quả { success: true } hoặc { error: '...' }.
 */
export async function createOrUpdateCampaign(data) {
  try {
    await connectDB();
    const { id, title, content } = data;

    if (!title) {
      throw new Error("Tên chiến dịch là bắt buộc.");
    }

    if (id) {
      // Cập nhật
      await Label.findByIdAndUpdate(id, { title, content });
    } else {
      // Tạo mới
      await Label.create({ title, content });
    }

    revalidatePath("/admin"); // Yêu cầu Next.js làm mới dữ liệu trang admin
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Xóa một chiến dịch dựa trên ID.
 * @param {string} id - ID của chiến dịch cần xóa.
 * @returns {Promise<object>} Kết quả { success: true } hoặc { error: '...' }.
 */
export async function deleteCampaign(id) {
  try {
    await connectDB();
    await Label.findByIdAndDelete(id);
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}
