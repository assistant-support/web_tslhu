// web_tslhu/app/(main)/admin/components/Panel/VariantEditorPanel.js
"use client";

import React, { useState, useTransition } from "react";
import styles from "./LabelEditorPanel.module.css"; // Tái sử dụng style của Label Editor
import { createOrUpdateVariant } from "@/app/actions/variantActions";

export default function VariantEditorPanel({
  panelData,
  onVariantUpdate,
  closePanel,
}) {
  const [name, setName] = useState(panelData?.name || "");
  const [description, setDescription] = useState(panelData?.description || "");
  // Chuyển mảng words thành một chuỗi, mỗi từ một dòng để hiển thị trong textarea
  const [wordsString, setWordsString] = useState(
    panelData?.words?.join("\n") || "",
  );

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!name) {
      setError("Tên biến thể (placeholder) là bắt buộc.");
      return;
    }

    startTransition(async () => {
      const result = await createOrUpdateVariant({
        id: panelData?._id,
        name,
        description,
        wordsString,
      });

      if (result.success) {
        onVariantUpdate(result.data); // Callback để cập nhật lại danh sách
        closePanel();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className={styles.container}>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.formGroup}>
        <label htmlFor="variantName">
          Tên Biến thể (ví dụ: `ngu_khi`, `chao_hoi`)
        </label>
        <input
          id="variantName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Không dấu, không khoảng trắng, không ký tự đặc biệt..."
          className={styles.input}
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="variantDesc">Mô tả (không bắt buộc)</label>
        <input
          id="variantDesc"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả công dụng của biến thể này"
          className={styles.input}
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="variantWords">Danh sách từ (mỗi từ một dòng)</label>
        <textarea
          id="variantWords"
          value={wordsString}
          onChange={(e) => setWordsString(e.target.value)}
          rows="10"
          placeholder="ví dụ:&#10;nha&#10;nhé&#10;nhen&#10;ạ"
          className={styles.textarea}
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={isPending}
        className={styles.saveButton}
      >
        {isPending ? "Đang lưu..." : "Lưu biến thể"}
      </button>
    </div>
  );
}
