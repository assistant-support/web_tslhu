// File: ScheduleDetailPanel.js (Đã cập nhật)
"use client";

import React, { useState, useTransition } from "react";
import styles from "./ScheduleDetailPanel.module.css";
import { usePanels } from "@/contexts/PanelContext";
import { stopSchedule } from "@/app/actions/campaignActions";
import PendingQueuePanel from "./PendingQueuePanel";
import ExecutionHistoryPanel from "./ExecutionHistoryPanel";

// Một component nhỏ cho các nút bấm, cho code sạch hơn
const ActionButton = ({ onClick, label, icon }) => (
  <button className={styles.actionButton} onClick={onClick}>
    {icon}
    <span>{label}</span>
  </button>
);
const InfoRow = ({ icon, label, value }) => (
  <div className={styles.infoRow}>
    <span className={styles.infoIcon}>{icon}</span>
    <span className={styles.infoLabel}>{label}</span>
    <span className={styles.infoValue}>{value || "Không có"}</span>
  </div>
);

export default function ScheduleDetailPanel({
  panelData: job,
  closePanel,
  onScheduleUpdate,
  isArchived = false,
}) {
  const { openPanel } = usePanels();
  const [isPending, startTransition] = useTransition();

  const handleStopSchedule = () => {
    if (
      confirm(
        `Bạn có chắc muốn dừng và hủy vĩnh viễn lịch trình "${job.jobName}" không?`,
      )
    ) {
      startTransition(async () => {
        const result = await stopSchedule(job._id);
        if (result.error) alert(`Lỗi: ${result.error}`);
        else {
          onScheduleUpdate({ type: "STOP_SCHEDULE", jobId: job._id });
          closePanel();
        }
      });
    }
  };

  // Mở panel hàng đợi
  const handleOpenQueuePanel = () => {
    const panelId = `queue-${job._id}`;
    openPanel({
      id: panelId,
      title: `👥 Hàng đợi: ${job.jobName}`,
      component: PendingQueuePanel,
      props: { panelData: { tasks: job.tasks } },
    });
  };

  // Mở panel lịch sử
  const handleOpenHistoryPanel = () => {
    const panelId = `history-${job._id}`;
    openPanel({
      id: panelId,
      title: `📜 Lịch sử: ${job.jobName}`,
      component: ExecutionHistoryPanel,
      props: { panelData: { jobId: job._id } },
    });
  };

  const st = job.statistics || { total: 0, completed: 0, failed: 0 };
  const tasks = job.tasks || [];
  const progressValue =
    st.total > 0 ? ((st.completed + st.failed) / st.total) * 100 : 0;

  return (
    <div className={styles.panelContainer}>
      {/* Phần thông tin tổng quan */}
      <div className={styles.overviewSection}>
        <div className={styles.overviewItem}>
          <span>Bắt đầu</span>
          <strong>{new Date(job.createdAt).toLocaleString("vi-VN")}</strong>
        </div>
        <div className={styles.overviewItem}>
          <span>{isArchived ? "Hoàn thành" : "Dự kiến xong"}</span>
          <strong>
            {job.estimatedCompletionTime
              ? new Date(job.estimatedCompletionTime).toLocaleString("vi-VN")
              : "N/A"}
          </strong>
        </div>
      </div>

      {/* Thanh tiến độ */}
      <div className={styles.progressSection}>
        <div className={styles.progressStats}>
          <span>
            Hoàn thành: <strong>{st.completed}</strong>
          </span>
          <span>
            Thất bại: <strong>{st.failed}</strong>
          </span>
          {!isArchived && (
            <span>
              Đang chờ: <strong>{tasks.length}</strong>
            </span>
          )}
          <span>
            Tổng: <strong>{st.total}</strong>
          </span>
        </div>
        <div className={styles.progressBarContainer}>
          <div
            className={styles.progressBar}
            style={{ width: `${progressValue}%` }}
          />
        </div>
      </div>

      <div className={styles.configSection}>
        <h4 className={styles.sectionTitle}>Chi tiết Cấu hình</h4>
        <InfoRow icon="⚙️" label="Loại hành động" value={job.actionType} />
        <InfoRow
          icon="👤"
          label="Tài khoản Zalo"
          value={job.zaloAccount?.name}
        />
        <InfoRow icon="🧑‍💻" label="Người tạo lịch" value={job.createdBy?.name} />
        <InfoRow
          icon="⚡"
          label="Tốc độ"
          value={`${job.config?.actionsPerHour || 50} hành động/giờ`}
        />
      </div>

      {/* Các nút hành động để mở panel con */}
      <div className={styles.actionsContainer}>
        {!isArchived && (
          <ActionButton
            label={`Hàng đợi (${tasks.length})`}
            icon="👥"
            onClick={handleOpenQueuePanel}
          />
        )}
        <ActionButton
          label="Lịch sử thực thi"
          icon="📜"
          onClick={handleOpenHistoryPanel}
        />
      </div>

      {job.actionType === "sendMessage" && job.config.messageTemplate && (
        <div className={styles.messageSection}>
          <h4>Nội dung tin nhắn</h4>
          <pre className={styles.messageContent}>
            {job.config.messageTemplate}
          </pre>
        </div>
      )}

      {!isArchived && (
        <div className={styles.panelFooter}>
          <button
            onClick={handleStopSchedule}
            className={styles.stopButton}
            disabled={isPending || job.status === "completed"}
          >
            {isPending ? "Đang xử lý..." : "Dừng & Hủy Lịch trình"}
          </button>
        </div>
      )}
    </div>
  );
}
