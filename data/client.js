// data/client.js
"use server";

import connectDB from "@/config/connectDB";
import Client from "@/models/client";
import Label from "@/models/label";
import Status from "@/models/status";
import User from "@/models/users"; // Import User để populate
import { revalidateTag } from "next/cache";

/**
 * [Hàm nội bộ] Lấy dữ liệu xét tuyển từ API bên ngoài cho một danh sách khách hàng.
 * @param {Array<object>} clients - Mảng khách hàng lấy từ DB.
 * @returns {Promise<Map<string, object>>} - Trả về một Map với key là ID khách hàng và value là dữ liệu xét tuyển.
 */
async function fetchAdmissionDataForClients(clients) {
  const admissionDataMap = new Map();

  const fetchPromises = clients.map(async (client) => {
    if (!client.phone) return;

    try {
      const res = await fetch(
        "https://tapi.lhu.edu.vn/TS/AUTH/XetTuyen_TraCuu",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: client.phone }),
          cache: "no-store",
        },
      );
      if (!res.ok) {
        admissionDataMap.set(client._id.toString(), {
          TinhTrang: "Lỗi tra cứu",
        });
        return;
      }
      const raw = await res.json();
      const data = (Array.isArray(raw) ? raw[0] : raw?.data?.[0]) || {
        TinhTrang: "Không có thông tin",
      };
      admissionDataMap.set(client._id.toString(), data);
    } catch (error) {
      admissionDataMap.set(client._id.toString(), { TinhTrang: "Lỗi kết nối" });
    }
  });

  await Promise.all(fetchPromises);
  return admissionDataMap;
}

/**
 * Lấy một "lô" dữ liệu khách hàng từ DB, hỗ trợ logic "Tải thêm",
 * và làm giàu với dữ liệu xét tuyển từ API bên ngoài.
 * @param {object} options - Các tùy chọn truy vấn.
 * @param {number} options.limit - Số lượng khách hàng cần lấy.
 * @param {number} options.skip - Số lượng khách hàng cần bỏ qua (dựa trên số lượng đã có ở client).
 * @param {object} [options.filters] - (Tùy chọn) Object chứa các bộ lọc (status, query, uidStatus).
 * @returns {Promise<object>} - Trả về object chứa data và thông tin phân trang.
 */
export async function Data_Client({ limit = 10, skip = 0, filters = {} }) {
  try {
    await connectDB();

    // --- KHỐI XÂY DỰNG QUERY ĐỘNG TỪ FILTERS ---
    const query = {};

    // 1. Lọc theo Trạng thái (Status)
    if (filters.status) {
      query.status = filters.status;
    }

    // 2. Lọc theo Từ khóa Tìm kiếm (Tên hoặc SĐT)
    if (filters.query) {
      const searchRegex = new RegExp(filters.query, "i");
      query.$or = [{ name: searchRegex }, { phone: searchRegex }];
    }

    // 3. Lọc theo Trạng thái UID
    if (filters.uidStatus === "exists") {
      query.uid = { $exists: true, $ne: null, $ne: "" };
    } else if (filters.uidStatus === "missing") {
      query.uid = { $in: [null, ""] };
    }

    // --- KẾT THÚC KHỐI XÂY DỰNG QUERY ---

    // Bước 1: Lấy dữ liệu khách hàng cơ bản từ DB
    const clientsFromDB = await Client.find(query)
      .populate({ path: "status", model: Status, select: "name" })
      .populate({ path: "users", model: User, select: "name" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Bước 2: Lấy dữ liệu xét tuyển từ API bên ngoài
    const admissionDataMap = await fetchAdmissionDataForClients(clientsFromDB);

    // Bước 3: Gộp hai nguồn dữ liệu lại
    const finalClients = clientsFromDB.map((client) => ({
      ...client,
      // Nhét dữ liệu xét tuyển vào một object riêng
      admissionData: admissionDataMap.get(client._id.toString()) || {
        TinhTrang: "Chưa tra cứu",
      },
    }));

    // Lấy tổng số lượng khách hàng khớp với bộ lọc (không bị ảnh hưởng bởi limit/skip)
    const totalClients = await Client.countDocuments(query);

    return {
      data: JSON.parse(JSON.stringify(finalClients)),
      // Trả về thông tin để client biết còn dữ liệu để tải thêm hay không
      pagination: {
        total: totalClients,
        hasMore: skip + finalClients.length < totalClients,
      },
    };
  } catch (error) {
    console.error("Lỗi trong Data_Client:", error);
    return { data: [], pagination: { total: 0, hasMore: false } };
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
