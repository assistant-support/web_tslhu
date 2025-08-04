// ++ ADDED: Toàn bộ file này là mới
"use client";

import React, { useState } from "react";
import styles from "./LabelEditorPanel.module.css"; // Tái sử dụng style của Label Editor

export default function StatusEditorPanel({
  initialData,
  onSave,
  closePanel,
  isSubmitting,
}) {
  const isEditing = initialData && initialData._id;

  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (typeof onSave === "function") {
      const result = await onSave({
        id: isEditing ? initialData._id : undefined,
        name,
        description,
      });
      if (result) {
        closePanel();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.panelBody}>
      <div className={styles.formGroup}>
        <label htmlFor="name">Tên trạng thái (Định dạng: QTxx| Tên)</label>
        <input
          type="text"
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ví dụ: QT01| Đã liên hệ"
          required
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="description">Mô tả (không bắt buộc)</label>
        <input
          type="text"
          id="description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className={styles.panelFooter}>
        <button
          type="button"
          onClick={closePanel}
          className={styles.cancelButton}
          disabled={isSubmitting}
        >
          Hủy
        </button>
        <button
          type="submit"
          className={styles.saveButton}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Đang lưu..."
            : isEditing
            ? "Lưu thay đổi"
            : "Tạo Trạng thái"}
        </button>
      </div>
    </form>
  );
}
