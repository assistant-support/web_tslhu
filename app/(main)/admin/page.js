// File: app/(main)/admin/page.js
"use client";

import React, { useState } from "react";
import styles from "./admin.module.css";

// 1. Import các component con
import Dashboard from "./components/Dashboard";
import UserManagement from "./components/UserManagement";
import AssignFromSheet from "./components/AssignFromSheet";
import CenterPopup from "@/components/(features)/(popup)/popup_center";
// START: THÊM IMPORT
import CampaignManagement from "./components/CampaignManagement";
import AccountManagement from "./components/AccountManagement";
// END: THÊM IMPORT

// Component chính của trang Admin
export default function AdminPage() {
  const [activeView, setActiveView] = useState("dashboard");
  const [isAssignPopupOpen, setIsAssignPopupOpen] = useState(false);

  const renderActiveView = () => {
    switch (activeView) {
      case "users":
        return <UserManagement />;
      // START: THÊM CASE MỚI
      case "campaigns":
        return <CampaignManagement />;
      case "accounts":
        return <AccountManagement />;
      // END: THÊM CASE MỚI
      case "kpi":
        return <div>Giao diện Phân tích & Báo cáo (KPI)</div>;
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

        {/* START: THÊM 2 NÚT MỚI */}
        <button
          className={`${styles.adminMenuItem} ${
            activeView === "campaigns" ? styles.active : ""
          }`}
          onClick={() => setActiveView("campaigns")}
        >
          Quản lý Chiến dịch
        </button>
        <button
          className={`${styles.adminMenuItem} ${
            activeView === "accounts" ? styles.active : ""
          }`}
          onClick={() => setActiveView("accounts")}
        >
          Quản lý Tài khoản
        </button>
        {/* END: THÊM 2 NÚT MỚI */}

        <button
          className={styles.adminMenuItem}
          onClick={() => setIsAssignPopupOpen(true)}
        >
          Gán quyền từ Sheet
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

      <main className={styles.adminContent}>{renderActiveView()}</main>

      <CenterPopup
        open={isAssignPopupOpen}
        onClose={() => setIsAssignPopupOpen(false)}
        size="md"
      >
        <AssignFromSheet />
      </CenterPopup>
    </div>
  );
}
