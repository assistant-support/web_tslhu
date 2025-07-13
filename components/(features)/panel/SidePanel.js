"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./SidePanel.module.css";
import { Svg_Close } from "@/components/(icon)/svg"; // Import icon đóng

/**
 * Component SidePanel quy chuẩn, có thể tái sử dụng
 * @param {object} props
 * @param {boolean} props.isOpen - Trạng thái mở hoặc đóng của panel
 * @param {function} props.onClose - Hàm sẽ được gọi khi người dùng đóng panel
 * @param {string} props.title - Tiêu đề của panel
 * @param {React.ReactNode} props.children - Nội dung sẽ được hiển thị bên trong panel
 */
const SidePanel = ({ isOpen, onClose, title, children }) => {
  // useEffect để xử lý việc khóa cuộn trang chính khi panel mở
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    // Cleanup function để đảm bảo overflow được reset khi component bị hủy
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  // Nếu panel không mở, không render gì cả
  if (!isOpen) {
    return null;
  }

  // Dùng React Portal để render panel ra ngoài cấu trúc DOM hiện tại,
  // giúp tránh các vấn đề về z-index và overflow.
  return createPortal(
    <div className={styles.container}>
      {/* Lớp phủ mờ phía sau */}
      <div className={styles.backdrop} onClick={onClose}></div>

      {/* Phần panel chính, có hiệu ứng trượt */}
      <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ""}`}>
        {/* Header của panel */}
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{title || "Bảng điều khiển"}</h3>
          <button onClick={onClose} className={styles.closeButton}>
            <Svg_Close w={24} h={24} />
          </button>
        </div>

        {/* Khu vực nội dung chính, có thể cuộn */}
        <div className={styles.panelContent}>{children}</div>
      </div>
    </div>,
    document.body, // Gắn panel vào thẻ <body> của trang
  );
};

export default SidePanel;
