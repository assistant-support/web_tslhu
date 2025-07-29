// web_tslhu/app/(main)/admin/AdminPageClient.js

"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./admin.module.css";
import { usePanels } from "@/contexts/PanelContext";
import { getRunningJobs, getArchivedJobs } from "@/app/actions/campaignActions";
import CampaignLabels from "./components/CampaignLabels"; // Component mới cho Nhãn
import CampaignTable from "./components/CampaignTable"; // Component mới cho Bảng
import AccountManagement from "./components/Account/AccountManagement";
import AssignFromSheet from "./components/AssignFromSheet";

export default function AdminPageClient({
  initialRunningJobs,
  initialCampaigns,
  initialArchivedJobs,
}) {
  const { openPanel, closePanel } = usePanels();

  // START: THAY ĐỔI CẤU TRÚC STATE VÀ TABS
  const [activeComponentKey, setActiveComponentKey] = useState("running"); // Mặc định là tab đang chạy
  const [runningJobs, setRunningJobs] = useState(initialRunningJobs || []);
  const [archivedJobs, setArchivedJobs] = useState(initialArchivedJobs || []);
  const [campaigns, setCampaigns] = useState(initialCampaigns || []);

  const menuItems = [
    { key: "labels", label: "🏷️ Nhãn & Mẫu tin" },
    { key: "running", label: "🚀 Đang chạy" },
    { key: "archived", label: "🗂️ Lịch sử" },
    { key: "accounts", label: "👤 Quản lý Tài khoản" },
    { key: "assign", label: "📝 Gán từ Sheet" },
  ];
  // END: THAY ĐỔI CẤU TRÚC STATE VÀ TABS

  // Yêu cầu 12: Tự động refresh dữ liệu
  useEffect(() => {
    const interval = setInterval(async () => {
      if (document.visibilityState === "visible") {
        // Chỉ fetch khi tab đang active
        const [running, archived] = await Promise.all([
          getRunningJobs(),
          getArchivedJobs(),
        ]);
        setRunningJobs(running);
        setArchivedJobs(archived);
      }
    }, 30000); // 30 giây

    return () => clearInterval(interval);
  }, []);

  // Callback để cập nhật state từ các panel con
  const handleScheduleUpdate = useCallback((updateInfo) => {
    if (updateInfo.type === "STOP_SCHEDULE") {
      setRunningJobs((prev) =>
        prev.filter((job) => job._id !== updateInfo.jobId),
      );
    }
    if (updateInfo.type === "TASK_REMOVED") {
      setRunningJobs((prev) =>
        prev.map((job) =>
          job._id === updateInfo.jobId ? updateInfo.updatedJob : job,
        ),
      );
    }
  }, []);

  const renderActiveComponent = () => {
    switch (activeComponentKey) {
      case "labels":
        return (
          <CampaignLabels
            campaigns={campaigns}
            setCampaigns={setCampaigns}
            openPanel={openPanel}
            closePanel={closePanel}
          />
        );
      case "running":
        return (
          <CampaignTable
            key="running-table"
            jobs={runningJobs}
            mode="running"
            onScheduleUpdate={handleScheduleUpdate}
          />
        );
      case "archived":
        return (
          <CampaignTable
            key="archived-table"
            jobs={archivedJobs}
            mode="archived"
            onScheduleUpdate={handleScheduleUpdate} // Vẫn truyền để đồng bộ
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
      {/* Yêu cầu 5: Xóa bỏ thanh cuộn riêng của bảng */}
      <main className={styles.adminContent}>{renderActiveComponent()}</main>
    </div>
  );
}
