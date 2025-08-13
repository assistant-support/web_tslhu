// data/customer.js
"use server";

import connectDB from "@/config/connectDB";
import Client from "@/models/customer";
import Label from "@/models/label";
import Status from "@/models/status";
import User from "@/models/users";
import { revalidateTag } from "next/cache";
import ActionHistory from "@/models/history";

import { Types } from "mongoose";

export async function Data_Client(searchParams = {}) {
  try {
    await connectDB();

    const page = parseInt(searchParams.page) || 1;
    const limit = parseInt(searchParams.limit) || 50;
    const skip = (page - 1) * limit;
    const { query: searchQuery, status, uidStatus, zaloActive } = searchParams;

    // ** MODIFIED: Khởi tạo mảng $and để kết hợp các điều kiện
    const queryConditions = [];

    if (status) {
      if (status === "none") {
        queryConditions.push({ status: { $in: [null, undefined] } });
      } else {
        queryConditions.push({ status: new Types.ObjectId(status) });
      }
    }

    if (searchQuery) {
      const searchRegex = new RegExp(searchQuery, "i");
      queryConditions.push({
        $or: [{ name: searchRegex }, { phone: searchRegex }],
      });
    }

    // ** MODIFIED: Logic lọc UID hoàn toàn mới
    if (uidStatus) {
      if (zaloActive && Types.ObjectId.isValid(zaloActive)) {
        // --- Lọc khi có tài khoản Zalo active ---
        const zaloObjectId = new Types.ObjectId(zaloActive);
        switch (uidStatus) {
          case "found":
            queryConditions.push({
              uid: {
                $elemMatch: {
                  zaloId: zaloObjectId,
                  uid: { $regex: /^\d+$/ },
                },
              },
            });
            break;
          case "error":
            queryConditions.push({
              uid: {
                $elemMatch: {
                  zaloId: zaloObjectId,
                  uid: { $not: /^\d+$/ },
                },
              },
            });
            break;
          case "pending":
            // Tìm những khách hàng KHÔNG CÓ entry nào khớp với zaloId này
            queryConditions.push({ "uid.zaloId": { $ne: zaloObjectId } });
            break;
        }
      } else {
        // --- Trường hợp 2: Lọc TỔNG HỢP (không có Zalo active) ---
        switch (uidStatus) {
          case "found":
            // Có ít nhất MỘT entry là UID hợp lệ
            queryConditions.push({
              uid: { $elemMatch: { uid: { $regex: /^\d+$/ } } },
            });
            break;
          case "error":
            // Có ít nhất MỘT entry là lỗi VÀ KHÔNG có entry nào là UID hợp lệ
            queryConditions.push({
              uid: { $elemMatch: { uid: { $not: /^\d+$/ } } },
            });
            break;
          case "pending":
            // Mảng uid rỗng
            queryConditions.push({ uid: { $size: 0 } });
            break;
        }
      }
    }

    // ** MODIFIED: Xây dựng query cuối cùng từ mảng điều kiện
    const query = queryConditions.length > 0 ? { $and: queryConditions } : {};

    const clientsQuery = Client.find(query)
      .populate({ path: "status", model: Status, select: "name" })
      .populate({ path: "users", model: User, select: "name" })
      .populate({
        path: "comments.user",
        model: User,
        select: "name",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Thực thi cả hai truy vấn song song để tối ưu
    const [clientsFromDB, totalClients] = await Promise.all([
      clientsQuery,
      Client.countDocuments(query),
    ]);

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
    // ** MODIFIED: Bỏ logic sort cũ, chỉ lấy dữ liệu thô
    const statuses = await Status.find({}).lean();

    // ** MODIFIED: Thêm logic sắp xếp bằng JavaScript dựa trên tiền tố QTxx
    const sortedStatuses = statuses.sort((a, b) => {
      const matchA = a.name.match(/^QT(\d+)\|/);
      const matchB = b.name.match(/^QT(\d+)\|/);
      // Gán một số lớn cho những trạng thái không có định dạng để chúng xuống cuối
      const orderA = matchA ? parseInt(matchA[1], 10) : Infinity;
      const orderB = matchB ? parseInt(matchB[1], 10) : Infinity;

      // Sắp xếp theo số thứ tự trước
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      // Nếu số thứ tự bằng nhau, sắp xếp theo tên alphabet
      return a.name.localeCompare(b.name);
    });

    return { data: JSON.parse(JSON.stringify(sortedStatuses)) };
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
