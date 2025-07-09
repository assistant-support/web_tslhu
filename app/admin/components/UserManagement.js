"use client";

import React from "react";
import styles from "../admin.module.css";

export default function UserManagement() {
  return (
    <div>
      <h2>Quản lý Nhân viên</h2>
      <p>Giao diện thêm, sửa, xóa tài khoản nhân viên sẽ nằm ở đây.</p>
      {/* Ví dụ: Nút thêm mới */}
      <button className={styles.actionButton}>+ Thêm nhân viên mới</button>

      {/* Bảng danh sách nhân viên sẽ được thêm vào đây */}
      <div
        style={{
          marginTop: "20px",
          border: "1px solid #ddd",
          padding: "10px",
          borderRadius: "5px",
        }}
      >
        (Bảng dữ liệu nhân viên)
      </div>
    </div>
  );
}
