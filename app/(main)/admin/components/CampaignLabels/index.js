// app/(main)/admin/components/CampaignLabels/index.js
"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import styles from "./CampaignLabels.module.css";
import { usePanels } from "@/contexts/PanelContext";
import {
  getLabel, // ++ ADDED: Import hàm lấy dữ liệu mới
  createOrUpdateLabel,
  deleteLabel,
} from "@/app/actions/campaignActions";
import LabelEditorPanel from "../Panel/LabelEditorPanel";
import LoadingSpinner from "../shared/LoadingSpinner";
import PaginationControls from "../shared/PaginationControls";

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
export default function CampaignLabels({}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { openPanel, closePanel } = usePanels();
  // ++ ADDED: State mới để quản lý dữ liệu, phân trang và loading
  const [labels, setLabels] = useState([]);
  const [pagination, setPagination] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // ++ ADDED: Hàm lấy dữ liệu từ server, có thể tái sử dụng
  const fetchData = useCallback(async (page = 1, limit = 10) => {
    setIsLoading(true);
    const result = await getLabel({ page, limit });
    if (result.success) {
      setLabels(result.data);
      setPagination(result.pagination);
    } else {
      alert(`Lỗi khi tải dữ liệu: ${result.error}`);
    }
    setIsLoading(false);
  }, []);

  // ++ ADDED: Tự động gọi fetchData khi component được mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (data) => {
    let savedData = null;
    setIsSubmitting(true);
    const result = await createOrUpdateLabel(data);
    setIsSubmitting(false);

    if (result.error) {
      alert(`Lỗi: ${result.error}`);
    } else {
      savedData = result.data;
      // ** MODIFIED: Gọi lại fetchData để làm mới danh sách
      fetchData(pagination.page, pagination.limit);
    }
    return savedData;
  };

  const handleDelete = async (id) => {
    if (confirm("Bạn có chắc muốn xóa nhãn này không?")) {
      startTransition(async () => {
        const result = await deleteLabel(id);
        if (result.success) {
          // ** MODIFIED: Gọi lại fetchData để làm mới danh sách
          fetchData(pagination.page, pagination.limit);
        } else {
          alert(`Lỗi: ${result.error}`);
        }
      });
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
        <div />
        <button className={styles.btnAdd} onClick={() => handleOpenEditor()}>
          + Tạo mới
        </button>
      </div>

      {/* ** MODIFIED: Thêm logic hiển thị loading */}
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className={styles.listContainer}>
          {(labels || []).map((label) => (
            <LabelRow
              key={label._id}
              label={label}
              onEdit={handleOpenEditor}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ++ ADDED: Thêm thanh phân trang */}
      <PaginationControls pagination={pagination} onPageChange={fetchData} />
    </div>
  );
}
