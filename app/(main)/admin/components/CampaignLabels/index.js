// app/(main)/admin/components/CampaignLabels/index.js
"use client";

import React, { useState } from "react";
import styles from "./CampaignLabels.module.css";
import {
  createOrUpdateLabel,
  deleteLabel,
} from "@/app/actions/campaignActions";
import LabelEditorPanel from "../Panel/LabelEditorPanel";

// --- Component Row cho mỗi Nhãn ---
const LabelRow = ({ label, onEdit, onDelete }) => (
  <div className={styles.row}>
    <div className={styles.info}>
      <span className={styles.title}>{label.title}</span>
      <span className={styles.desc}>{label.desc || "Không có mô tả"}</span>
    </div>
    <div className={styles.actions}>
      <button
        className={`${styles.btn} ${styles.btnEdit}`}
        onClick={() => onEdit(label)}
      >
        ✏️ Sửa
      </button>
      <button
        className={`${styles.btn} ${styles.btnDelete}`}
        onClick={() => onDelete(label._id)}
      >
        🗑️ Xóa
      </button>
    </div>
  </div>
);

// --- Component Chính ---
export default function CampaignLabels({
  campaigns,
  setCampaigns,
  openPanel,
  closePanel,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (data) => {
    setIsSubmitting(true);
    const result = await createOrUpdateLabel(data);
    setIsSubmitting(false);

    if (result.error) {
      alert(`Lỗi: ${result.error}`);
      return null;
    }

    if (data.id) {
      // Cập nhật
      setCampaigns(campaigns.map((c) => (c._id === data.id ? result.data : c)));
    } else {
      // Tạo mới
      setCampaigns([result.data, ...campaigns]);
    }
    return result.data; // Trả về để panel có thể đóng
  };

  const handleDelete = async (id) => {
    if (confirm("Bạn có chắc muốn xóa nhãn này không?")) {
      await deleteLabel(id);
      setCampaigns(campaigns.filter((c) => c._id !== id));
    }
  };

  const handleOpenEditor = (label = null) => {
    const panelId = label ? `edit-label-${label._id}` : `create-label`;
    openPanel({
      id: panelId,
      title: label ? "Chỉnh sửa Nhãn" : "Tạo Nhãn Mới",
      component: LabelEditorPanel,
      props: {
        initialData: label,
        onSave: handleSave,
        isSubmitting: isSubmitting,
        closePanel: () => closePanel(panelId),
      },
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.mainTitle}>Quản lý Nhãn & Mẫu tin</h2>
        <button className={styles.btnAdd} onClick={() => handleOpenEditor()}>
          + Tạo mới
        </button>
      </div>
      <div className={styles.listContainer}>
        {campaigns.map((label) => (
          <LabelRow
            key={label._id}
            label={label}
            onEdit={handleOpenEditor}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
