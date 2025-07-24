"use client";
import React from "react";
import styles from "./ArchivedCampaigns.module.css";
import { usePanels } from "@/contexts/PanelContext";
import ScheduleDetailPanel from "../../Panel/ScheduleDetailPanel";

const ArchivedRow = (
  { job, onOpenDetail }, // Đổi tên onOpenHistory -> onOpenDetail cho nhất quán
) => (
  <div className={styles.row} onClick={() => onOpenDetail(job)}>
    <div className={`${styles.rowCell} ${styles.jobName}`} title={job.jobName}>
      <span>{job.jobName}</span>
    </div>
    <div className={`${styles.rowCell} ${styles.statsCell}`}>
      {job.statistics.completed} / {job.statistics.total}
    </div>
    <div className={`${styles.rowCell} ${styles.statsCell}`}>
      {job.zaloAccount?.name || "Không rõ"}
    </div>
    <div className={`${styles.rowCell} ${styles.timeCell}`}>
      {new Date(job.completedAt).toLocaleString("vi-VN")}
    </div>
  </div>
);

export default function ArchivedCampaigns({ jobs }) {
  const { openPanel } = usePanels();

  const handleOpenDetail = (job) => {
    // Đổi tên hàm cho nhất quán
    const panelId = `archived-detail-${job._id}`;
    openPanel({
      id: panelId,
      title: `Lịch sử: ${job.jobName}`,
      component: ScheduleDetailPanel,
      // SỬA LỖI Ở ĐÂY: Truyền toàn bộ object `job` và prop `isArchived`
      props: {
        panelData: job,
        isArchived: true,
      },
    });
  };

  if (!jobs || jobs.length === 0) {
    return <p className={styles.noData}>Chưa có lịch sử chiến dịch nào.</p>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <div className={`${styles.rowCell} ${styles.jobName}`}>
            Tên chiến dịch
          </div>
          <div className={`${styles.rowCell} ${styles.statsCell}`}>
            Hoàn thành
          </div>
          <div className={`${styles.rowCell} ${styles.statsCell}`}>
            Tài khoản
          </div>
          <div className={`${styles.rowCell} ${styles.timeCell}`}>
            Thời gian xong
          </div>
        </div>
        <div className={styles.tableBody}>
          {jobs.map((job) => (
            <ArchivedRow
              key={job._id}
              job={job}
              onOpenDetail={handleOpenDetail} // Cập nhật tên prop
            />
          ))}
        </div>
      </div>
    </div>
  );
}
