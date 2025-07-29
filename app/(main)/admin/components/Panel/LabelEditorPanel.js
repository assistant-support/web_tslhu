// web_tslhu/app/(main)/admin/components/Panel/LabelEditorPanel.js

"use client";

import React, { useState } from "react";
import styles from "./LabelEditorPanel.module.css"; // Sẽ tạo file CSS này

export default function LabelEditorPanel({
  initialData, // Đổi tên từ panelData
  onSave,
  closePanel,
  isSubmitting, // Nhận prop này từ cha
}) {
  const isEditing = initialData && initialData._id;

  const [title, setTitle] = useState(initialData?.title || "");
  const [desc, setDesc] = useState(initialData?.desc || "");
  const [content, setContent] = useState(initialData?.content || "");

  //<-----------------THAY ĐỔI: Xử lý submit bất đồng bộ----------------->
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (typeof onSave === "function") {
      const result = await onSave({
        id: isEditing ? initialData._id : undefined,
        title,
        desc,
        content,
      });
      // Chỉ đóng panel nếu lưu thành công (result không phải là null)
      if (result) {
        closePanel();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.panelBody}>
      <div className={styles.formGroup}>
        <label htmlFor="title">Tên nhãn (Tiêu đề)</label>
        <input
          type="text"
          id="title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="desc">Mô tả ngắn</label>
        <input
          type="text"
          id="desc"
          name="desc"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="content">Nội dung chi tiết (Mẫu tin)</label>
        <textarea
          id="content"
          name="content"
          rows="10"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        ></textarea>
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
            : "Tạo Nhãn"}
        </button>
      </div>
    </form>
  );
}
