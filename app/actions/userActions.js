// ++ ADDED: File hoàn toàn mới để quản lý các action liên quan đến User
"use server";

import { connectToDB } from "@/lib/mongoose";
import History from "@/lib/models/history.js";
import User from "@/lib/models/user.js";
import Customer from "@/lib/models/customer.js";
import { unstable_noStore as noStore } from "next/cache";

const getLatestActionAggregation = (matchConditions = {}) => [
  { $match: matchConditions },
  { $sort: { createdAt: -1 } },
  {
    $lookup: {
      from: "histories",
      localField: "_id",
      foreignField: "user",
      as: "actions",
      pipeline: [{ $sort: { createdAt: -1 } }, { $limit: 1 }],
    },
  },
  { $unwind: { path: "$actions", preserveNullAndEmptyArrays: true } },
  {
    $lookup: {
      from: "customers",
      localField: "actions.customer",
      foreignField: "_id",
      as: "customerInfo",
    },
  },
  { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      _id: 1,
      name: 1,
      phone: 1,
      email: 1,
      role: 1,
      latestAction: {
        type: "$actions.type",
        time: "$actions.createdAt",
      },
      customer: {
        _id: "$customerInfo._id",
        name: "$customerInfo.name",
        phone: "$customerInfo.phone",
      },
    },
  },
];

export async function getUsersWithDetails({ page = 1, limit = 10 }) {
  noStore();
  try {
    await connectToDB();

    const skip = (page - 1) * limit;

    const aggregationPipeline = getLatestActionAggregation();

    const users = await User.aggregate(aggregationPipeline)
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments();

    return {
      data: JSON.parse(JSON.stringify(users)),
      totalPages: Math.ceil(totalUsers / limit),
    };
  } catch (error) {
    console.error("Error fetching users with details:", error);
    return { data: [], totalPages: 0 };
  }
}

export async function getUserDetails(userId) {
  noStore();
  try {
    await connectToDB();
    const user = await User.findById(userId).populate("zaloAccounts");
    if (!user) return null;
    return JSON.parse(JSON.stringify(user));
  } catch (error) {
    console.error("Error fetching user details:", error);
    return null;
  }
}
