"use client";

import React, { useTransition } from "react";
import styles from "../../admin.module.css";
import { useRouter } from "next/navigation";

import {
  deleteLabel,
  createOrUpdateLabel,
} from "@/app/actions/campaignActions";
import CampaignPanel from "../Panel/editLabelPanel";
import RunningCampaigns from "./runningCampaigns";

// Component này giờ quản lý cả RunningCampaigns và bảng Labels
export default function LabelManager({
  openPanel,
  closePanel,
  runningJobs,
  setRunningJobs,
  campaigns,
  setCampaigns,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSave = (data) => {
    startTransition(async () => {
      const result = await createOrUpdateLabel(data);
      if (result.error) {
        alert(`Lỗi: ${result.error}`);
      } else {
        // Dữ liệu mới trả về từ server
        const savedLabel = result.data;

        // Kiểm tra xem đây là tạo mới hay cập nhật
        if (data.id) {
          // CẬP NHẬT: Tìm và thay thế nhãn cũ trong mảng state
          setCampaigns((prev) =>
            prev.map((c) => (c._id === savedLabel._id ? savedLabel : c)),
          );
        } else {
          // TẠO MỚI: Thêm nhãn mới vào đầu mảng state
          setCampaigns((prev) => [savedLabel, ...prev]);
        }
      }
    });
  };

  const handleCreate = () => {
    const panelId = `label-new-${Date.now()}`;
    openPanel({
      id: panelId,
      title: "✨ Tạo Nhãn nội dung mới",
      component: CampaignPanel, // Dùng logic cũ, truyền thẳng component
      props: {
        onSave: handleSave,
        panelId: panelId, // Truyền panelId riêng
        closePanel: closePanel, // Truyền hàm closePanel gốc
      },
    });
  };

  const handleEdit = (label) => {
    const panelId = `label-edit-${label._id}`;
    openPanel({
      id: panelId,
      title: `✏️ Chỉnh sửa: ${label.title}`,
      component: CampaignPanel,
      props: {
        panelData: label,
        onSave: handleSave,
        panelId: panelId, // Truyền panelId riêng
        closePanel: closePanel, // Truyền hàm closePanel gốc
      },
    });
  };

  const handleDelete = (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa nhãn này không?")) {
      startTransition(async () => {
        await deleteLabel(id);
        setCampaigns((prev) => prev.filter((c) => c._id !== id));
      });
    }
  };

  return (
    <div>
      {/* 1. Hiển thị các chiến dịch đang chạy ở trên cùng */}
      <RunningCampaigns
        jobs={runningJobs}
        setJobs={setRunningJobs}
        openPanel={openPanel}
        closePanel={closePanel}
      />

      {/* 2. Hiển thị bảng quản lý Nhãn ở dưới */}
      <div className={styles.componentHeader} style={{ marginTop: "24px" }}>
        <h2>📝 Quản lý Nhãn (Mẫu nội dung)</h2>
        <button
          onClick={handleCreate}
          className={styles.createButton}
          disabled={isPending}
        >
          + Tạo mới
        </button>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Tên nhãn (Title)</th>
            <th>Mô tả (Description)</th>
            <th style={{ width: "150px" }}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {campaigns?.map((label) => (
            <tr key={label._id}>
              <td>{label.title}</td>
              <td>{label.desc || "..."}</td>
              <td className={styles.actionCell}>
                <button
                  onClick={() => handleEdit(label)}
                  className={styles.editButton}
                  disabled={isPending}
                >
                  Sửa
                </button>
                <button
                  onClick={() => handleDelete(label._id)}
                  className={styles.deleteButton}
                  disabled={isPending}
                >
                  Xóa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
