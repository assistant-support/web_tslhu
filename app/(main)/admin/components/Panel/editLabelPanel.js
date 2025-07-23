"use client";

import React, { useState } from "react";
// CSS dùng chung với các component admin khác
import styles from "./editLabelPanel.module.css";

export default function EditLabelPanel({
  panelData,
  closePanel,
  onSave,
  panelId,
}) {
  const isEditing = panelData && panelData._id;

  // State để quản lý dữ liệu form
  const [title, setTitle] = useState(panelData?.title || "");
  const [desc, setDesc] = useState(panelData?.desc || "");
  const [content, setContent] = useState(panelData?.content || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    // Kiểm tra xem hàm onSave có được truyền vào không
    if (typeof onSave === "function") {
      // Gọi hàm onSave đã được truyền từ cha, gửi đi dữ liệu form
      onSave({
        id: isEditing ? panelData._id : undefined,
        title,
        desc,
        content,
      });
    }
    closePanel(); // Luôn đóng panel sau khi submit
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
        <label htmlFor="content">Nội dung chi tiết</label>
        <textarea
          id="content"
          name="content"
          rows="8"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        ></textarea>
      </div>
      <div className={styles.panelFooter}>
        <button
          type="button"
          onClick={closePanel}
          className={styles.cancelButton}
        >
          Hủy
        </button>
        <button type="submit" className={styles.saveButton}>
          {isEditing ? "Lưu thay đổi" : "Tạo Nhãn"}
        </button>
      </div>
    </form>
  );
}
