// File: ExecutionHistoryPanel.js
"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import styles from "./PanelStyles.module.css";
import { getHistoryForSchedule } from "@/app/actions/historyActions";
import HistoryDetailPanel from "./HistoryDetailPanel"; // Import panel cấp 3
import { usePanels } from "@/contexts/PanelContext";

export default function ExecutionHistoryPanel({ panelData: { jobId } }) {
  const { openPanel, closePanel } = usePanels();
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setIsLoading(true);
      setError(null); // Reset lỗi mỗi khi fetch
      try {
        const historyData = await getHistoryForSchedule(jobId);
        console.log("Lịch sử trả về:", historyData); // Debug log

        if (Array.isArray(historyData)) {
          setHistory(historyData);
        } else {
          console.error(
            "Dữ liệu lịch sử trả về không phải là mảng:",
            historyData,
          );
          setError("Dữ liệu lịch sử trả về không hợp lệ.");
          setHistory([]);
        }
      } catch (e) {
        console.error("Lỗi khi fetch lịch sử:", e);
        setError("Không thể tải dữ liệu lịch sử.");
      }
      setIsLoading(false);
    });
  }, [jobId]);

  const filteredHistory = useMemo(() => {
    if (!searchTerm) return history;
    return history.filter(
      (log) =>
        log.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.customer?.phone.includes(searchTerm),
    );
  }, [searchTerm, history]);

  const handleOpenDetail = (log) => {
    const panelId = `log-detail-${log._id}`;
    openPanel({
      id: panelId,
      title: `📜 Chi tiết log: ${log.customer?.name}`,
      component: HistoryDetailPanel,
      props: { panelData: log, closePanel: () => closePanel(panelId) },
    });
  };

  if (isLoading)
    return <div className={styles.loading}>Đang tải lịch sử...</div>;
  if (error) return <div className={styles.error}>Lỗi: {error}</div>;

  return (
    <div className={styles.panelContent}>
      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Tìm theo tên hoặc SĐT..."
          className={styles.searchInput}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className={styles.listContainer}>
        {filteredHistory.map((log) => (
          <div
            key={log._id}
            className={styles.listItem}
            onClick={() => handleOpenDetail(log)}
          >
            <div className={styles.listItemInfo}>
              <span className={styles.itemName}>
                {log.status.status === "SUCCESS" ? "✅" : "❌"}{" "}
                {log.customer?.name}
              </span>
              <span className={styles.itemSubtext}>
                {new Date(log.time).toLocaleString("vi-VN")}
              </span>
            </div>
            <div className={styles.listItemStatus}>
              {log.status?.detail?.actionMessage || "..."}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
