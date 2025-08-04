// app/(main)/admin/components/CampaignTable/index.js
"use client";
import React, { useState, useEffect, useCallback } from "react";
import styles from "./CampaignTable.module.css";
import { usePanels } from "@/contexts/PanelContext";
import ScheduleDetailPanel from "../Panel/ScheduleDetailPanel";
import StackedProgressBar from "../shared/StackedProgressBar";
import { getRunningJobs, getArchivedJobs } from "@/app/actions/campaignActions";
import LoadingSpinner from "../shared/LoadingSpinner";
import PaginationControls from "../shared/PaginationControls";

// --- Components con để hiển thị thông tin ---
const UserInfo = ({ user }) => (
  <div className={styles.userInfo}>
    <span className={styles.mainInfo} title={user?.name}>
      {user?.name || "Không rõ"}
    </span>
    <span className={styles.subInfo} title={user?.email}>
      {user?.email || "..."}
    </span>
  </div>
);

const ZaloInfo = ({ account }) => (
  <div className={styles.zaloInfo}>
    <img
      src={account?.avt || "/default-avatar.png"}
      alt="avt"
      className={styles.avatar}
    />
    <div className={styles.textInfo}>
      <span className={styles.mainInfo} title={account?.name}>
        {account?.name || "Không rõ"}
      </span>
      <span className={styles.subInfo}>{account?.phone || "..."}</span>
    </div>
  </div>
);

// Yêu cầu 7: Component hiển thị thời gian phức tạp
const TimeCell = ({ job, mode }) => {
  const formatDateTime = (date) =>
    new Date(date).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const getDuration = (start, end) => {
    const diff = +new Date(end) - +new Date(start);
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff / 60_000) % 60);
    return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`;
  };

  const getTimeLeft = (until) => {
    const diff = +new Date(until) - +new Date();
    if (diff <= 0) return "Đã xong";
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / 3_600_000) % 24);
    if (d > 0) return `~${d} ngày`;
    const m = Math.floor((diff / 60_000) % 60);
    return h > 0 ? `~${h}h ${m}m` : `~${m}m`;
  };

  const startTime = formatDateTime(job.createdAt);
  const endTime =
    mode === "running"
      ? formatDateTime(job.estimatedCompletionTime)
      : formatDateTime(job.completedAt);
  const duration =
    mode === "running"
      ? getTimeLeft(job.estimatedCompletionTime)
      : getDuration(job.createdAt, job.completedAt);

  return (
    <div className={styles.timeInfo}>
      <span>{startTime}</span>
      <span>{endTime}</span>
      <span className={styles.durationInfo}>
        {mode === "running" ? `Còn lại: ${duration}` : `Tổng: ${duration}`}
      </span>
    </div>
  );
};

// --- Component Row (1 dòng trong bảng) ---
const CampaignRow = ({ job, mode, onOpenDetail }) => (
  // Row cũng dùng display: contents
  <div className={styles.gridRow} onClick={() => onOpenDetail(job)}>
    <div className={`${styles.cell} ${styles.jobNameCell}`}>{job.jobName}</div>
    <div className={styles.cell}>
      <StackedProgressBar
        success={job.statistics.completed}
        failed={job.statistics.failed}
        total={job.statistics.total}
      />
    </div>
    <div className={styles.cell}>
      <ZaloInfo account={job.zaloAccount} />
    </div>
    <div className={styles.cell}>
      <UserInfo user={job.createdBy} />
    </div>
    <div className={styles.cell}>{job.actionType}</div>
    <div className={styles.cell}>
      <TimeCell job={job} mode={mode} />
    </div>
  </div>
);
const Header = () => (
  // Header bây giờ dùng display: contents để các cell con của nó
  // trở thành một phần của grid cha (tableContainer)
  <div className={styles.header}>
    <div className={styles.headerCell}>Tên chiến dịch</div>
    <div className={styles.headerCell}>Kết quả</div>
    <div className={styles.headerCell}>Tài khoản</div>
    <div className={styles.headerCell}>Người tạo</div>
    <div className={styles.headerCell}>Hành động</div>
    <div className={styles.headerCell}>Thời gian</div>
  </div>
);

// --- Component Chính ---
export default function CampaignTable({ mode }) {
  const { openPanel, closePanel } = usePanels();
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // ++ ADDED: Hàm lấy dữ liệu dựa trên 'mode'
  const fetchData = useCallback(
    async (page = 1, limit = 10) => {
      setIsLoading(true);
      const fetcher = mode === "running" ? getRunningJobs : getArchivedJobs;
      const result = await fetcher({ page, limit });

      if (result.success) {
        setJobs(result.data);
        setPagination(result.pagination);
      } else {
        alert(`Lỗi tải dữ liệu: ${result.error}`);
      }
      setIsLoading(false);
    },
    [mode],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const handleDataRefresh = useCallback(() => {
    fetchData(pagination.page, pagination.limit);
  }, [fetchData, pagination]);

  const handleOpenDetail = useCallback(
    (job) => {
      openPanel({
        id: `schedule-detail-${job._id}`,
        title: `Chi tiết: ${job.jobName}`,
        component: ScheduleDetailPanel,
        props: {
          panelData: job,
          isArchived: mode === "archived",
          onScheduleUpdate: handleDataRefresh,
          closePanel: () => closePanel(`schedule-detail-${job._id}`),
        },
      });
    },
    [openPanel, closePanel, mode, handleDataRefresh],
  );

  return (
    // ** MODIFIED: Cấu trúc layout mới
    <div className={styles.fullHeightContainer}>
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className={styles.tableContainer}>
          <Header />
          {(jobs || []).map((job) => (
            <CampaignRow
              key={job._id}
              job={job}
              mode={mode}
              onOpenDetail={handleOpenDetail}
            />
          ))}
        </div>
      )}
      <PaginationControls pagination={pagination} onPageChange={fetchData} />
    </div>
  );
}
