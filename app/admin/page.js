"use client";

import React, { useState } from "react";
import styles from "./admin.module.css";

// 1. Import các component con mà bạn vừa tạo
import Dashboard from "./components/Dashboard";
import UserManagement from "./components/UserManagement";

// Component chính của trang Admin
export default function AdminPage() {
  // State để quyết định xem nên hiển thị view nào
  const [activeView, setActiveView] = useState("dashboard"); // Mặc định là dashboard

  // Hàm để render component tương ứng với view đang active
  const renderActiveView = () => {
    switch (activeView) {
      case "users":
        return <UserManagement />;
      case "kpi":
        // Bạn có thể tạo component cho KPI và gọi ở đây
        return <div>Giao diện Phân tích & Báo cáo (KPI)</div>;
      case "settings":
        return <div>Giao diện Cài đặt Hệ thống</div>;
      case "dashboard":
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className={styles.adminContainer}>
      <header className={styles.adminHeader}>
        <h1>Trang Quản lý</h1>
        <p>Chào mừng Admin! Đây là trung tâm điều khiển của bạn.</p>
      </header>

      {/* Thanh menu chức năng của Admin */}
      <nav className={styles.adminMenu}>
        <button
          className={`${styles.adminMenuItem} ${
            activeView === "dashboard" ? styles.active : ""
          }`}
          onClick={() => setActiveView("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={`${styles.adminMenuItem} ${
            activeView === "users" ? styles.active : ""
          }`}
          onClick={() => setActiveView("users")}
        >
          Quản lý Nhân viên
        </button>
        <button
          className={`${styles.adminMenuItem} ${
            activeView === "kpi" ? styles.active : ""
          }`}
          onClick={() => setActiveView("kpi")}
        >
          Phân tích & Báo cáo
        </button>
      </nav>

      {/* Phần nội dung chính sẽ render component con tương ứng */}
      <main className={styles.adminContent}>{renderActiveView()}</main>
    </div>
  );
}
