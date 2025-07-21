// data/client.js
"use server";

import connectDB from "@/config/connectDB";
import Client from "@/models/customer";
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
export async function Data_Client(searchParams = {}) {
  try {
    await connectDB();

    // SỬA LỖI: Đọc dữ liệu từ `searchParams` được truyền vào
    const page = parseInt(searchParams.page) || 1;
    const limit = parseInt(searchParams.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};
    if (searchParams.status) {
      query.status = searchParams.status;
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

    const clientsQuery = Client.find(query)
      .populate({ path: "status", model: Status, select: "name" })
      .populate({ path: "users", model: User, select: "name" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const [clientsFromDB, totalClients] = await Promise.all([
      clientsQuery,
      Client.countDocuments(query),
    ]);

    const admissionDataMap = await fetchAdmissionDataForClients(clientsFromDB);
    const finalClients = clientsFromDB.map((client) => ({
      ...client,
      admissionData: admissionDataMap.get(client._id.toString()) || {
        TinhTrang: "Chưa tra cứu",
      },
    }));

    return {
      data: JSON.parse(JSON.stringify(finalClients)),
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
