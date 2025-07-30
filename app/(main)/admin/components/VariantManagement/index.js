// web_tslhu/app/(main)/admin/components/VariantManagement/index.js
"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import styles from "./VariantManagement.module.css";
import { getVariants, deleteVariant } from "@/app/actions/variantActions";
import { usePanels } from "@/contexts/PanelContext";
import VariantEditorPanel from "../Panel/VariantEditorPanel";

export default function VariantManagement() {
  const [variants, setVariants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { openPanel, closePanel } = usePanels();

  useEffect(() => {
    const fetchVariants = async () => {
      setIsLoading(true);
      const data = await getVariants();
      setVariants(data);
      setIsLoading(false);
    };
    fetchVariants();
  }, []);

  const handleVariantUpdate = useCallback((updatedVariant) => {
    setVariants((prev) => {
      const index = prev.findIndex((v) => v._id === updatedVariant._id);
      if (index > -1) {
        // Cập nhật
        const newVariants = [...prev];
        newVariants[index] = updatedVariant;
        return newVariants;
      } else {
        // Thêm mới
        return [...prev, updatedVariant].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
      }
    });
  }, []);

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
          setVariants((prev) => prev.filter((v) => v._id !== variant._id));
        } else {
          alert(`Lỗi: ${result.error}`);
        }
      });
    }
  };

  if (isLoading) return <p>Đang tải danh sách biến thể...</p>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Danh sách Biến thể</h2>
        <button className={styles.addButton} onClick={() => handleOpenPanel()}>
          + Tạo mới
        </button>
      </div>
      <div className={styles.grid}>
        <div className={styles.gridHeader}>Tên (Placeholder)</div>
        <div className={styles.gridHeader}>Mô tả</div>
        <div className={styles.gridHeader}>Số lượng từ</div>
        <div className={styles.gridHeader}>Hành động</div>

        {variants.map((variant) => (
          <React.Fragment key={variant._id}>
            <div className={styles.gridCell}>
              <strong>{`{${variant.name}}`}</strong>
            </div>
            <div className={styles.gridCell}>{variant.description}</div>
            <div className={styles.gridCell}>{variant.words.length}</div>
            <div className={styles.gridCellActions}>
              <button
                className={styles.actionButton}
                onClick={() => handleOpenPanel(variant)}
              >
                Sửa
              </button>
              <button
                className={`${styles.actionButton} ${styles.deleteButton}`}
                onClick={() => handleDelete(variant)}
                disabled={isPending}
              >
                Xóa
              </button>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
