// data/customer.js
"use server";

import connectDB from "@/config/connectDB";
import Client from "@/models/customer";
import Label from "@/models/label";
import Status from "@/models/status";
import User from "@/models/users"; // Import User để populate
import { revalidateTag } from "next/cache";

/**
 * Lấy một "lô" dữ liệu khách hàng từ DB cho trang client.
 * @param {object} searchParams - Các tham số tìm kiếm và phân trang từ URL.
 * @returns {Promise<object>} - Trả về object chứa data và thông tin phân trang.
 */
export async function Data_Client(searchParams = {}) {
  try {
    await connectDB();

    const page = parseInt(searchParams.page) || 1;
    const limit = parseInt(searchParams.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};

    if (searchParams.status) {
      // Nếu người dùng chọn bộ lọc "Chưa có"
      if (searchParams.status === "none") {
        // Tìm các document có trường `status` là null hoặc không tồn tại.
        // Trong Mongoose, `$in: [null]` thường bao gồm cả `undefined`.
        query.status = { $in: [null] };
      } else {
        // Giữ nguyên logic cũ cho các trạng thái khác
        query.status = searchParams.status;
      }
    }
    if (searchParams.query) {
      const searchRegex = new RegExp(searchParams.query, "i");
      query.$or = [{ name: searchRegex }, { phone: searchRegex }];
    }
    if (searchParams.uidStatus === "exists") {
      query.uid = { $exists: true, $ne: null, $ne: "" };
    } else if (searchParams.uidStatus === "missing") {
      query.uid = { $in: [null, ""] };
    }

    // --- CÂU TRUY VẤN ĐÃ ĐƯỢC CẬP NHẬT ---
    const clientsQuery = Client.find(query)
      // Populate trạng thái chăm sóc để lấy tên
      .populate({ path: "status", model: Status, select: "name" })
      // Populate nhân viên được gán để chăm sóc khách hàng này
      .populate({ path: "users", model: User, select: "name" })
      // START: THÊM LOGIC POPULATE CHO BÌNH LUẬN
      .populate({
        path: "comments.user", // Đường dẫn đến trường 'user' bên trong mảng 'comments'
        model: User,
        select: "name", // Chỉ lấy trường 'name' của user đã bình luận
      })
      // END: THÊM LOGIC POPULATE CHO BÌNH LUẬN
      .sort({ createdAt: -1 }) // Sắp xếp khách hàng mới nhất lên đầu
      .skip(skip)
      .limit(limit)
      .lean();

    const [clientsFromDB, totalClients] = await Promise.all([
      clientsQuery,
      Client.countDocuments(query),
    ]);

    // Sắp xếp lại comments trong từng customer để đảm bảo thứ tự mới nhất -> cũ nhất
    clientsFromDB.forEach((client) => {
      if (client.comments && Array.isArray(client.comments)) {
        client.comments.sort((a, b) => new Date(b.time) - new Date(a.time));
      }
    });

    return {
      data: JSON.parse(JSON.stringify(clientsFromDB)),
      pagination: {
        page,
        limit,
        total: totalClients,
        totalPages: Math.ceil(totalClients / limit),
      },
    };
  } catch (error) {
    console.error("Lỗi trong Data_Client:", error);
    return {
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    };
  }
}

/**
 * Lấy tất cả các nhãn (labels) từ DB.
 */
export async function Data_Label() {
  try {
    await connectDB();
    const labels = await Label.find({}).lean();
    return { data: JSON.parse(JSON.stringify(labels)) };
  } catch (error) {
    console.error("Lỗi trong Data_Label:", error);
    return { data: [] };
  }
}

/**
 * Lấy tất cả các trạng thái (statuses) từ DB.
 */
export async function Data_Status() {
  try {
    await connectDB();
    const statuses = await Status.find({}).sort({ order: 1 }).lean();
    return { data: JSON.parse(JSON.stringify(statuses)) };
  } catch (error) {
    console.error("Lỗi trong Data_Status:", error);
    return { data: [] };
  }
}

/**
 * Làm mới cache cho dữ liệu khách hàng.
 */
export async function Re_data_client() {
  revalidateTag("data_client");
}

export async function Re_Label() {
  revalidateTag("data_label");
}
