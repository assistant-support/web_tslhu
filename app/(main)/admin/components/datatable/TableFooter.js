import React from "react";
import styles from "./DataTable.module.css";
import { Svg_Left, Svg_ArowRight } from "@/components/(icon)/svg";

const TableFooter = ({ pagination, onPageChange }) => {
  if (!pagination) return <div className={styles.footerPlaceholder}></div>;

  const { page, totalPages, limit, total } = pagination;

  return (
    <div className={styles.tableFooter}>
      <div className={styles.footerInfo}>
        Tổng số: <strong>{total || 0}</strong>
      </div>
      <div className={styles.pageNav}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!page || page <= 1}
          className={styles.navButton}
        >
          <Svg_Left w={16} h={16} c="currentColor" />
        </button>
        <span className={styles.pageIndicator}>
          Trang {page || 1} / {totalPages || 1}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!totalPages || page >= totalPages}
          className={styles.navButton}
        >
          <Svg_ArowRight w={16} h={16} c="currentColor" />
        </button>
      </div>
    </div>
  );
};

export default TableFooter;
