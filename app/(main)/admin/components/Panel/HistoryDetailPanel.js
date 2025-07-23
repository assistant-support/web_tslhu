// File: HistoryDetailPanel.js
"use client";

import React from "react";
import styles from "./PanelStyles.module.css"; // Sẽ tạo file CSS dùng chung

const DetailRow = ({ label, value, isObject = false }) => (
  <div className={styles.detailRow}>
    <span className={styles.detailLabel}>{label}</span>
    {isObject ? (
      <pre className={styles.detailValueJson}>{value}</pre>
    ) : (
      <span className={styles.detailValue}>{value}</span>
    )}
  </div>
);

export default function HistoryDetailPanel({ panelData: log }) {
  if (!log) return null;

  const { status, actionDetail, time, customer } = log;
  const executionResult = status.detail || {};

  return (
    <div className={styles.panelContent}>
      <h4 className={styles.contentTitle}>
        Chi tiết thực thi cho: {customer?.name || "Không rõ"}
      </h4>
      <div className={styles.detailGroup}>
        <DetailRow
          label="Trạng thái"
          value={status.status === "SUCCESS" ? "✅ Thành công" : "❌ Thất bại"}
        />
        <DetailRow
          label="Thời gian"
          value={new Date(time).toLocaleString("vi-VN")}
        />
        <DetailRow
          label="Thông điệp trả về"
          value={executionResult.actionMessage || "Không có"}
        />
        {log.action === "DO_SCHEDULE_SEND_MESSAGE" && (
          <DetailRow
            label="Nội dung đã gửi"
            value={actionDetail.messageTemplate || "Không có"}
            isObject
          />
        )}
      </div>

      <h4 className={styles.contentTitle}>Dữ liệu gốc từ Script</h4>
      <div className={styles.detailGroup}>
        <DetailRow
          label="Toàn bộ kết quả"
          value={JSON.stringify(executionResult, null, 2)}
          isObject
        />
      </div>
    </div>
  );
}
