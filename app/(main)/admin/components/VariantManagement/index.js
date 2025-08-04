// web_tslhu/app/(main)/admin/components/VariantManagement/index.js
"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import styles from "./VariantManagement.module.css";
import { getVariants, deleteVariant } from "@/app/actions/variantActions";
import { usePanels } from "@/contexts/PanelContext";
import VariantEditorPanel from "../Panel/VariantEditorPanel";
// ++ ADDED: Import các component tái sử dụng
import LoadingSpinner from "../shared/LoadingSpinner";
import PaginationControls from "../shared/PaginationControls";

export default function VariantManagement() {
  const [variants, setVariants] = useState([]);
  const [pagination, setPagination] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { openPanel, closePanel } = usePanels();

  const fetchData = useCallback(async (page = 1, limit = 10) => {
    setIsLoading(true);
    const result = await getVariants({ page, limit });
    if (result.success) {
      setVariants(result.data);
      setPagination(result.pagination);
    } else {
      alert(`Lỗi: ${result.error}`);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVariantUpdate = useCallback(() => {
    fetchData(pagination.page, pagination.limit);
  }, [fetchData, pagination]);

  const handleOpenPanel = (variant = null) => {
    const panelId = `variant-editor-${variant?._id || "new"}`;
    openPanel({
      id: panelId,
      title: variant ? `Chỉnh sửa: {${variant.name}}` : "Tạo Biến thể mới",
      component: VariantEditorPanel,
      props: {
        panelData: variant,
        onVariantUpdate: handleVariantUpdate,
        closePanel: () => closePanel(panelId),
      },
    });
  };

  const handleDelete = (variant) => {
    if (
      confirm(
        `Bạn có chắc muốn xóa vĩnh viễn biến thể {${variant.name}} không?`,
      )
    ) {
      startTransition(async () => {
        const result = await deleteVariant(variant._id);
        if (result.success) {
          fetchData(pagination.page, pagination.limit);
        } else {
          alert(`Lỗi: ${result.error}`);
        }
      });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div />
        <button className={styles.btnAdd} onClick={() => handleOpenPanel()}>
          + Tạo mới
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className={styles.listContainer}>
            {/* Header của bảng */}
            <div className={`${styles.row} ${styles.gridHeader}`}>
              <div>Tên (Placeholder)</div>
              <div>Mô tả</div>
              <div>Số lượng từ</div>
              <div>Hành động</div>
            </div>

            {(variants || []).map((variant) => (
              <div key={variant._id} className={styles.row}>
                <div>
                  <strong>{`{${variant.name}}`}</strong>
                </div>
                <div>{variant.description}</div>
                <div>{variant.words.length}</div>
                <div className={styles.actions}>
                  <button
                    className={`${styles.btn} ${styles.btnEdit}`}
                    onClick={() => handleOpenPanel(variant)}
                  >
                    Sửa
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnDelete}`}
                    onClick={() => handleDelete(variant)}
                    disabled={isPending}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
          <PaginationControls
            pagination={pagination}
            onPageChange={fetchData}
          />
        </>
      )}
    </div>
  );
}
