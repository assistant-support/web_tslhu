"use client";
import React, { useState, useEffect } from "react";
import styles from "./PaginationControls.module.css";

export default function PaginationControls({ pagination, onPageChange }) {
  const [pageInput, setPageInput] = useState(pagination.page);

  useEffect(() => {
    setPageInput(pagination.page);
  }, [pagination.page]);

  const handleGoToPage = (e) => {
    if (e.key === "Enter") {
      const pageNum = parseInt(pageInput, 10);
      if (pageNum >= 1 && pageNum <= pagination.totalPages) {
        onPageChange(pageNum, pagination.limit);
      } else {
        setPageInput(pagination.page);
      }
    }
  };

  const handleLimitChange = (e) => {
    if (e.key === "Enter") {
      const newLimit = parseInt(e.target.value, 10);
      if (newLimit > 0) {
        onPageChange(1, newLimit); // Reset về trang 1 khi đổi limit
      } else {
        e.target.value = pagination.limit;
      }
    }
  };

  if (pagination.totalPages <= 1) return null;

  return (
    <div className={styles.pagination}>
      <div className={styles.paginationInfo}>
        <div className={styles.limitControl}>
          <label htmlFor="limitInput">Số dòng/trang:</label>
          <input
            id="limitInput"
            type="number"
            defaultValue={pagination.limit}
            onKeyDown={handleLimitChange}
            className={styles.pageInput}
          />
        </div>
      </div>
      <div className={styles.pageNavGroup}>
        <button
          onClick={() => onPageChange(pagination.page - 1, pagination.limit)}
          className={styles.pageBtn}
          disabled={pagination.page <= 1}
        >
          &laquo;
        </button>
        <span>
          Trang
          <input
            type="number"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={handleGoToPage}
            className={styles.pageInput}
          />
          / {pagination.totalPages}
        </span>
        <button
          onClick={() => onPageChange(pagination.page + 1, pagination.limit)}
          className={styles.pageBtn}
          disabled={pagination.page >= pagination.totalPages}
        >
          &raquo;
        </button>
      </div>
      <div>
        <span>(Tổng cộng {pagination.total} mục)</span>
      </div>
    </div>
  );
}
