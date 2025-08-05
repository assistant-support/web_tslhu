// ++ ADDED: Component DataTable mới, sử dụng CSS Modules
import React from "react";
import styles from "./DataTable.module.css";
import { Svg_Plus, Svg_Trash } from "@/components/(icon)/svg";
import TableFooter from "./TableFooter";

const DataTable = ({
  columns,
  data,
  onRowDoubleClick,
  onDeleteItem,
  onAddItem,
  showActions = false,
  pagination, // ++ ADDED: Nhận prop pagination
  onPageChange,
  activeRowId,
}) => {
  // Xác định các cột cho grid layout dựa trên cấu hình
  const gridTemplateColumns = columns
    .map((col) => col.width || "1fr")
    .join(" ");
  const finalGridTemplate = showActions
    ? `${gridTemplateColumns} 50px`
    : gridTemplateColumns;

  return (
    <div className={styles.tableWrapper}>
      {/* Table Header */}
      <div
        className={styles.tableHeader}
        style={{ gridTemplateColumns: finalGridTemplate }}
      >
        {columns.map((col) => (
          <div key={col.accessor} className={styles.headerCell}>
            {col.header}
          </div>
        ))}
        {showActions && (
          <div className={`${styles.headerCell} ${styles.actionCell}`}>
            <button
              onClick={onAddItem}
              className={styles.addButton}
              aria-label="Thêm mới"
            >
              <Svg_Plus w={18} h={18} c="currentColor" />
            </button>
          </div>
        )}
      </div>

      {/* Table Body */}
      <div className={styles.tableBody}>
        {data && data.length > 0 ? (
          data.map((item) => {
            const isActive = activeRowId === item._id;
            return (
              <div
                key={item._id}
                className={`${styles.tableRow} ${
                  isActive ? styles.activeRow : ""
                }`}
                style={{ gridTemplateColumns: finalGridTemplate }}
                onDoubleClick={() => onRowDoubleClick(item)}
              >
                {columns.map((col) => (
                  <div key={col.accessor} className={styles.cell}>
                    {col.cell ? col.cell(item) : item[col.accessor]}
                  </div>
                ))}
                {showActions && (
                  <div className={`${styles.cell} ${styles.actionCell}`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Ngăn double click
                        onDeleteItem(item._id);
                      }}
                      className={styles.deleteButton}
                      aria-label="Xóa"
                    >
                      <Svg_Trash w={16} h={16} c="currentColor" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className={styles.noData}>
            <p>Không có dữ liệu để hiển thị.</p>
          </div>
        )}
      </div>
      <div className={styles.tableFooterContainer}>
        <TableFooter pagination={pagination} onPageChange={onPageChange} />
      </div>
    </div>
  );
};

export default DataTable;
