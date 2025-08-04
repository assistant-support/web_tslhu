// ++ ADDED: Toàn bộ file này là mới
"use client";
import React, { useState, useEffect, useTransition, useCallback } from "react";
import styles from "./StatusManagement.module.css";
import { usePanels } from "@/contexts/PanelContext";
import {
  getStatuses,
  createOrUpdateStatus,
  deleteStatus,
} from "@/app/actions/statusActions";
import StatusEditorPanel from "../Panel/StatusEditorPanel";
import LoadingSpinner from "../shared/LoadingSpinner";
import PaginationControls from "../shared/PaginationControls";

// Component con để hiển thị một dòng trạng thái
const StatusRow = ({ status, onEdit, onDelete }) => (
  <div className={styles.row}>
    <div className={styles.info}>
      <span className={styles.title}>{status.name}</span>
      <span className={styles.desc}>
        {status.description || "Không có mô tả"}
      </span>
    </div>
    <div className={styles.actions}>
      <button
        className={`${styles.btn} ${styles.btnEdit}`}
        onClick={() => onEdit(status)}
      >
        ✏️ Sửa
      </button>
      <button
        className={`${styles.btn} ${styles.btnDelete}`}
        onClick={() => onDelete(status._id)}
      >
        🗑️ Xóa
      </button>
    </div>
  </div>
);

// Component chính
export default function StatusManagement() {
  const { openPanel, closePanel } = usePanels();
  const [pagination, setPagination] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [statuses, setStatuses] = useState([]);
  const [isPending, startTransition] = useTransition();
  const fetchData = useCallback(async (page = 1, limit = 10) => {
    setIsLoading(true);
    const result = await getStatuses({ page, limit });
    if (result.success) {
      setStatuses(result.data);
      setPagination(result.pagination);
    } else {
      alert(`Lỗi khi tải dữ liệu: ${result.error}`);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (data) => {
    let savedData = null; // Biến để trả về cho panel

    // Bọc trong startTransition để quản lý trạng thái loading
    startTransition(async () => {
      const result = await createOrUpdateStatus(data);

      if (result.error) {
        alert(`Lỗi: ${result.error}`);
      } else {
        savedData = result.data;
        console.log("Lưu thành công, đang làm mới dữ liệu...");
        // Gọi lại fetchData để cập nhật lại danh sách với trang hiện tại
        fetchData(pagination.page, pagination.limit);
      }
    });

    // Trả về kết quả để panel biết và tự đóng
    return savedData;
  };

  const handleDelete = (id) => {
    if (
      confirm(
        "Bạn có chắc muốn xóa trạng thái này? Hành động này sẽ gỡ trạng thái khỏi tất cả các khách hàng liên quan.",
      )
    ) {
      startTransition(async () => {
        const result = await deleteStatus(id);
        if (result.error) {
          alert(`Lỗi: ${result.error}`);
        } else {
          console.log("Xóa thành công, đang làm mới dữ liệu...");
          // Gọi lại fetchData để cập nhật lại danh sách
          fetchData(pagination.page, pagination.limit);
        }
      });
    }
  };

  const handleOpenEditor = (status = null) => {
    const panelId = status ? `edit-status-${status._id}` : `create-status`;
    openPanel({
      id: panelId,
      title: status ? "Chỉnh sửa Trạng thái" : "Tạo Trạng thái Mới",
      component: StatusEditorPanel,
      props: {
        initialData: status,
        onSave: handleSave,
        isSubmitting: isPending,
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

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className={styles.listContainer}>
          {(statuses || []).map((status) => (
            <StatusRow
              key={status._id}
              status={status}
              onEdit={handleOpenEditor}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <PaginationControls pagination={pagination} onPageChange={fetchData} />
    </div>
  );
}
