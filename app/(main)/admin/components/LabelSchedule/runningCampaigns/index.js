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

// --- Component Card cho mỗi chiến dịch ---
const CampaignRow = ({ job, onOpenDetail }) => {
  const { statistics: st, jobName, estimatedCompletionTime } = job;
  const progress = st.total > 0 ? (st.completed / st.total) * 100 : 0;
  const timeLeft = calcTimeLeft(estimatedCompletionTime);

  return (
    // Thêm onClick vào cả dòng và thêm class để thay đổi con trỏ
    <div
      className={`${styles.row} ${styles.clickableRow}`}
      onClick={() => onOpenDetail(job)}
    >
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

      {/* Bổ sung cột thời gian hoàn thành dự kiến */}
      <div className={`${styles.rowCell} ${styles.timeCell}`}>
        {estimatedCompletionTime
          ? new Date(estimatedCompletionTime).toLocaleString("vi-VN")
          : "N/A"}
      </div>

      {/* Xóa bỏ div chứa nút "Chi tiết" */}
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
          {/* Thêm header cho cột mới */}
          <div className={`${styles.rowCell} ${styles.timeCell}`}>
            Dự kiến xong
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
