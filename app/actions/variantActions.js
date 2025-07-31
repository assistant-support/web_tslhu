// web_tslhu/app/actions/variantActions.js
// -------------------- START: THAY THẾ TOÀN BỘ FILE --------------------
// Chú thích: Bổ sung đầy đủ các hàm CRUD cho biến thể.
"use server";

import connectDB from "@/config/connectDB";
import Variant from "@/models/variant";
import { revalidatePath } from "next/cache";
import { revalidateAndBroadcast } from "@/lib/revalidation";

/**
 * Lấy tất cả các biến thể từ database.
 */
export async function getVariants() {
  try {
    await connectDB();
    const variants = await Variant.find({}).sort({ name: 1 }).lean();
    return JSON.parse(JSON.stringify(variants));
  } catch (error) {
    console.error("Lỗi khi lấy danh sách biến thể:", error);
    return [];
  }
}

/**
 * Tạo hoặc cập nhật một biến thể.
 * @param {object} data - Dữ liệu biến thể.
 * @param {string} [data.id] - ID nếu là cập nhật.
 * @param {string} data.name - Tên biến thể (placeholder).
 * @param {string} data.description - Mô tả.
 * @param {string} data.wordsString - Các từ, mỗi từ trên một dòng.
 */
export async function createOrUpdateVariant(data) {
  try {
    await connectDB();
    const { id, name, description, wordsString } = data;

    if (!name) {
      throw new Error("Tên biến thể là bắt buộc.");
    }

    // Chuyển chuỗi thành mảng các từ, loại bỏ dòng trống và khoảng trắng thừa
    const words = wordsString
      .split("\n")
      .map((word) => word.trim())
      .filter((word) => word);

    const variantData = {
      name: name.toLowerCase().trim(),
      description,
      words,
    };

    let savedVariant;
    if (id) {
      savedVariant = await Variant.findByIdAndUpdate(id, variantData, {
        new: true,
      }).lean();
    } else {
      savedVariant = await Variant.create(variantData);
    }

    revalidateAndBroadcast("variants");
    return { success: true, data: JSON.parse(JSON.stringify(savedVariant)) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Xóa một biến thể.
 * @param {string} id - ID của biến thể cần xóa.
 */
export async function deleteVariant(id) {
  try {
    await connectDB();
    await Variant.findByIdAndDelete(id);
    revalidateAndBroadcast("variants");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
