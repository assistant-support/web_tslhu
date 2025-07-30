// data/customer.js
"use server";

import connectDB from "@/config/connectDB";
import Client from "@/models/customer";
import Label from "@/models/label";
import Status from "@/models/status";
import User from "@/models/users";
import { revalidateTag } from "next/cache";

export async function Data_Client(searchParams = {}) {
  try {
    await connectDB();

    const page = parseInt(searchParams.page) || 1;
    const limit = parseInt(searchParams.limit) || 100;
    const skip = (page - 1) * limit;

    const query = {};

    if (searchParams.status) {
      if (searchParams.status === "none") {
        query.status = { $in: [null] };
      } else {
        query.status = searchParams.status;
      }
    }

    if (searchParams.query) {
      const searchRegex = new RegExp(searchParams.query, "i");
      query.$or = [{ name: searchRegex }, { phone: searchRegex }];
    }

    if (searchParams.uidStatus) {
      switch (searchParams.uidStatus) {
        case "found":
          query.uid = { $regex: /^\d+$/ };
          break;
        case "pending":
          query.uid = { $in: [null, ""] };
          break;
        case "error":
          query.uid = { $type: "string", $ne: "", $not: /^\d+$/ };
          break;
      }
    }

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
      Client.countDocuments(query), // Đảm bảo count cũng dùng chung query
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
