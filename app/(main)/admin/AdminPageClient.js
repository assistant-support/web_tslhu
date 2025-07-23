"use client";

import React, { useState } from "react";
import { usePanels } from "@/contexts/PanelContext";
import styles from "./admin.module.css";

// ================= START: THAY ĐỔI THEO CẤU TRÚC MỚI =================
// Import component chính cho tab đầu tiên
import LabelManager from "./components/LabelSchedule";
import AccountManagement from "./components/Account/AccountManagement";
import AssignFromSheet from "./components/AssignFromSheet";
// =================  END: THAY ĐỔI THEO CẤU TRÚC MỚI  =================

export default function AdminPageClient({
  initialRunningJobs,
  initialCampaigns,
}) {
  const { openPanel, closePanel } = usePanels();
  const [activeComponentKey, setActiveComponentKey] =
    React.useState("labelSchedule");
  const [runningJobs, setRunningJobs] = useState(initialRunningJobs);
  const [campaigns, setCampaigns] = useState(initialCampaigns);

  const menuItems = [
    { key: "labelSchedule", label: "🚀 Nhãn & Lịch trình" },
    { key: "accounts", label: "👤 Quản lý Tài khoản" },
    { key: "assign", label: "📝 Gán từ Sheet" },
  ];

  const renderActiveComponent = () => {
    switch (activeComponentKey) {
      case "labelSchedule":
        return (
          <LabelManager
            openPanel={openPanel}
            closePanel={closePanel}
            runningJobs={runningJobs}
            setRunningJobs={setRunningJobs}
            campaigns={campaigns}
            setCampaigns={setCampaigns}
          />
        );
      case "accounts":
        return <AccountManagement openPanel={openPanel} />;
      case "assign":
        return <AssignFromSheet />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.adminContainer}>
      <nav className={styles.adminTabMenu}>
        {menuItems.map((item) => (
          <button
            key={item.key}
            className={`${styles.tabMenuItem} ${
              activeComponentKey === item.key ? styles.active : ""
            }`}
            onClick={() => setActiveComponentKey(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className={styles.adminContent}>{renderActiveComponent()}</main>
    </div>
  );
}
