"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import styles from "./RunningCampaigns.module.css";
import { useRouter } from "next/navigation";
import ScheduleDetailPanel from "../../Panel/ScheduleDetailPanel";
import { usePanels } from "@/contexts/PanelContext";

// ---------- helper ----------
const calcTimeLeft = (until) => {
  if (!until) return "";
  const diff = +new Date(until) - +new Date();
  if (diff <= 0) return "Hoàn thành";
  const h = Math.floor((diff / 3_600_000) % 24);
  const m = Math.floor((diff / 60_000) % 60);
  return h > 0 ? `~ ${h}h ${m}m` : `~ ${m} phút`;
};

// ---------- small render blocks (tái sử dụng từ file cũ) ----------
const RecipientList = ({ job, removedIds, onToggle }) => (
  <div className={styles.taskList}>
    {(job.tasks || []).map((t) => {
      const removed = removedIds.has(t._id);
      const processed = t.status !== "pending";
      return (
        <div
          key={t._id}
          className={`${styles.taskItem} ${removed ? styles.removed : ""} ${
            processed ? styles.processed : ""
          }`}
        >
          <div className={styles.taskInfo}>
            <span className={styles.taskName}>{t.person.name}</span>
            <span className={styles.taskStatus}>
              {processed ? `Đã ${t.status}` : "Đang chờ"}
            </span>
          </div>
          <button
            onClick={() => onToggle(t._id)}
            className={`${styles.toggleTaskBtn} ${
              removed ? styles.reAdd : styles.remove
            }`}
            disabled={processed}
          >
            {removed ? "Thêm lại" : "Bỏ"}
          </button>
        </div>
      );
    })}
  </div>
);

const DetailContent = ({
  job,
  onEditRecipients,
  onSave,
  onStop,
  isSubmitting,
  timeLeft,
}) => {
  const st = job.statistics || { total: 0, completed: 0, failed: 0 };
  const success = st.total ? (st.completed / st.total) * 100 : 0;
  const failure = st.total ? (st.failed / st.total) * 100 : 0;
  return (
    <div className={styles.popupContainer}>
      <div className={styles.popupGroup}>
        <p className={styles.popupLabel}>Tên lịch trình</p>
        <p className={styles.popupValue}>{job.jobName}</p>
      </div>
      <div className={styles.popupGroup}>
        <p className={styles.popupLabel}>Thông tin chung</p>
        <div className={styles.statGrid}>
          <div>
            <span className={styles.statTitle}>Trạng thái</span>
            <span className={`${styles.statValue} ${styles.statusProcessing}`}>
              {job.status}
            </span>
          </div>
          <div>
            <span className={styles.statTitle}>Hành động</span>
            <span className={styles.statValue}>{job.actionType}</span>
          </div>
          <div>
            <span className={styles.statTitle}>Tốc độ</span>
            <span className={styles.statValue}>
              {job.config?.actionsPerHour || 0} / giờ
            </span>
          </div>
        </div>
      </div>
      <div className={styles.popupGroup}>
        <p className={styles.popupLabel}>Tiến độ & Tỉ lệ</p>
        <div className={styles.statGrid}>
          <div>
            <span className={styles.statTitle}>Hoàn thành</span>
            <span className={styles.statValue}>
              {st.completed} / {st.total}
            </span>
          </div>
          <div>
            <span className={styles.statTitle}>Thất bại</span>
            <span className={styles.statValue}>{st.failed}</span>
          </div>
          <div>
            <span className={`${styles.statTitle} ${styles.successRate}`}>
              Thành công
            </span>
            <span className={`${styles.statValue} ${styles.successRate}`}>
              {success.toFixed(1)}%
            </span>
          </div>
          <div>
            <span className={`${styles.statTitle} ${styles.failureRate}`}>
              Thất bại
            </span>
            <span className={`${styles.statValue} ${styles.failureRate}`}>
              {failure.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      <div className={styles.popupGroup}>
        <p className={styles.popupLabel}>Thời gian</p>
        <div className={styles.statGrid}>
          <div>
            <span className={styles.statTitle}>Bắt đầu</span>
            <span className={styles.statValue}>
              {new Date(job.createdAt).toLocaleString("vi-VN")}
            </span>
          </div>
          <div>
            <span className={styles.statTitle}>Dự kiến xong</span>
            <span className={styles.statValue}>
              {new Date(job.estimatedCompletionTime).toLocaleString("vi-VN")}
            </span>
          </div>
          <div>
            <span className={styles.statTitle}>Còn lại</span>
            <span className={styles.statValue}>{timeLeft}</span>
          </div>
        </div>
      </div>
      <div className={styles.popupGroup}>
        <div className={styles.recipientSummary}>
          <p className={styles.popupLabel}>Danh sách người nhận</p>
          <button
            className={styles.editRecipientsBtn}
            onClick={onEditRecipients}
          >
            Chỉnh sửa
          </button>
        </div>
      </div>
      <div className={styles.popupActions}>
        <button
          onClick={onStop}
          className={`${styles.actionButton} ${styles.stopButton}`}
          disabled={isSubmitting}
        >
          Dừng & Hủy
        </button>
        <button
          onClick={onSave}
          className="btn"
          disabled={isSubmitting}
          style={{ borderRadius: 5, margin: 0, transform: "none" }}
        >
          {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </div>
  );
};

// --- Component Card cho mỗi chiến dịch ---
const CampaignRow = ({ job, onOpenDetail }) => {
  const { statistics: st, jobName, estimatedCompletionTime } = job;
  const progress = st.total > 0 ? (st.completed / st.total) * 100 : 0;
  const timeLeft = calcTimeLeft(estimatedCompletionTime);

  return (
    <div className={styles.row}>
      <div className={`${styles.rowCell} ${styles.jobName}`} title={jobName}>
        <span>{jobName}</span>
      </div>
      <div className={`${styles.rowCell} ${styles.progressCell}`}>
        <div className={styles.progressContainer}>
          <div
            className={styles.progressBar}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={styles.progressText}>{progress.toFixed(0)}%</span>
      </div>
      <div className={`${styles.rowCell} ${styles.statsCell}`}>
        {st.completed} / {st.total}
      </div>
      <div className={`${styles.rowCell} ${styles.timeCell}`}>{timeLeft}</div>
      <div className={`${styles.rowCell} ${styles.actionCell}`}>
        <button
          onClick={() => onOpenDetail(job)}
          className={styles.detailButton}
        >
          Chi tiết
        </button>
      </div>
    </div>
  );
};

// --- Component Chính Quản lý Toàn bộ ---
export default function RunningCampaigns({
  jobs,
  setJobs,
  openPanel,
  closePanel,
}) {
  const router = useRouter();
  const [isSubmitting, startTransition] = useTransition();

  const [selectedJob, setSelectedJob] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRecipientOpen, setIsRecipientOpen] = useState(false);
  const [removedTaskIds, setRemovedTaskIds] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState("");
  // const { openPanel, closePanel } = usePanels();

  const handleScheduleUpdate = useCallback(
    (updatedInfo) => {
      if (updatedInfo.type === "STOP_SCHEDULE") {
        setJobs((prevJobs) =>
          prevJobs.filter((job) => job._id !== updatedInfo.jobId),
        );
      }
      if (updatedInfo.type === "REMOVE_TASK") {
        setJobs((prevJobs) =>
          prevJobs.map((job) => {
            if (job._id === updatedInfo.jobId) {
              const newTasks = job.tasks.filter(
                (task) => task._id !== updatedInfo.taskId,
              );
              return {
                ...job,
                tasks: newTasks,
                statistics: { ...job.statistics, total: newTasks.length },
              };
            }
            return job;
          }),
        );
      }
    },
    [setJobs],
  );
  const handleOpenDetail = useCallback(
    (job) => {
      const panelId = `schedule-detail-${job._id}`;
      openPanel({
        id: panelId,
        title: `Chi tiết: ${job.jobName}`,
        component: ScheduleDetailPanel,
        props: {
          panelData: job,
          closePanel: () => closePanel(panelId),
          onScheduleUpdate: handleScheduleUpdate,
        },
      });
    },
    [openPanel, closePanel, handleScheduleUpdate],
  );

  useEffect(() => {
    if (!selectedJob?.estimatedCompletionTime) return;
    setTimeLeft(calcTimeLeft(selectedJob.estimatedCompletionTime));
    const timer = setInterval(
      () => setTimeLeft(calcTimeLeft(selectedJob.estimatedCompletionTime)),
      1000,
    );
    return () => clearInterval(timer);
  }, [selectedJob]);

  if (!jobs || jobs.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.mainTitle}>🗓️ Chiến dịch đang chạy</h3>
      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <div className={`${styles.rowCell} ${styles.jobName}`}>
            Tên chiến dịch
          </div>
          <div className={`${styles.rowCell} ${styles.progressCell}`}>
            Tiến độ
          </div>
          <div className={`${styles.rowCell} ${styles.statsCell}`}>
            Hoàn thành
          </div>
          <div className={`${styles.rowCell} ${styles.timeCell}`}>Còn lại</div>
          <div className={`${styles.rowCell} ${styles.actionCell}`}>
            Hành động
          </div>
        </div>
        <div className={styles.tableBody}>
          {jobs.map((job) => (
            <CampaignRow
              key={job._id}
              job={job}
              onOpenDetail={handleOpenDetail}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
