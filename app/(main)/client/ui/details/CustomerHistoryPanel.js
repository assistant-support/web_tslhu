"use client";

import React, { useState, useEffect, useTransition } from "react";
import styles from "./CustomerHistoryPanel.module.css";
import { getHistoryForCustomer } from "@/app/actions/historyActions";

// Helper để dịch tên action cho thân thiện
const formatActionName = (action) => {
  const map = {
    DO_SCHEDULE_SEND_MESSAGE: "Gửi tin nhắn tự động",
    CREATE_SCHEDULE_SEND_MESSAGE: "Lên lịch gửi tin nhắn",
    DELETE_SCHEDULE_SEND_MESSAGE: "Xóa khỏi lịch gửi tin",
    UPDATE_NAME_CUSTOMER: "Cập nhật tên",
    UPDATE_STATUS_CUSTOMER: "Cập nhật trạng thái",
    UPDATE_STAGE_CUSTOMER: "Thay đổi giai đoạn",
    ADD_COMMENT_CUSTOMER: "Thêm bình luận",
  };
  return map[action] || action.replace(/_/g, " ").toLowerCase();
};

const ActionDetails = ({ log }) => {
  const { action, status, actionDetail, zalo } = log;
  const result = status.detail || {};

  // Mặc định hiển thị thông điệp từ script
  let details = (
    <p>
      <strong>Kết quả:</strong> {result.actionMessage || "Không có chi tiết."}
    </p>
  );

  switch (action) {
    case "UPDATE_NAME_CUSTOMER":
      details = (
        <p>
          <strong>Thay đổi:</strong> Từ "{actionDetail.oldName}" thành "
          {actionDetail.newName}"
        </p>
      );
      break;
    case "UPDATE_STATUS_CUSTOMER":
      details = (
        <p>
          <strong>Thay đổi:</strong> Từ "{actionDetail.oldStatus}" thành "
          {actionDetail.newStatus}"
        </p>
      );
      break;
    case "UPDATE_STAGE_CUSTOMER":
      details = (
        <p>
          <strong>Thay đổi:</strong> Từ giai đoạn "{actionDetail.oldStage}" sang
          "{actionDetail.newStage}"
        </p>
      );
      break;
    case "ADD_COMMENT_CUSTOMER":
      details = <p>Đã thêm một bình luận mới vào hồ sơ.</p>;
      break;
  }

  return (
    <>
      {details}
      {zalo && (
        <p>
          <strong>Qua Zalo:</strong> {zalo.name}
        </p>
      )}
    </>
  );
};

const HistoryItem = ({ log }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    // Gán sự kiện click vào item cha
    <div className={styles.item} onClick={() => setIsExpanded(!isExpanded)}>
      <div className={styles.itemHeader}>
        <div className={styles.itemTitle}>
          {/* Tên hành động được đưa ra ngoài */}
          <span className={styles.itemAction}>
            {log.status.status === "SUCCESS" ? "✅" : "❌"}{" "}
            {formatActionName(log.action)}
          </span>
          <span className={styles.itemUser}>
            bởi {log.user?.name || "Hệ thống"}
          </span>
        </div>
        <span className={styles.itemTime}>
          {new Date(log.time).toLocaleString("vi-VN")}
        </span>
      </div>
      {/* Phần body chỉ hiển thị khi isExpanded là true */}
      {isExpanded && (
        <div className={styles.itemBody}>
          <ActionDetails log={log} />
        </div>
      )}
    </div>
  );
};

export default function CustomerHistoryPanel({ panelData: { customerId } }) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!customerId) return;
    startTransition(async () => {
      setIsLoading(true);
      const data = await getHistoryForCustomer(customerId);
      setHistory(data);
      setIsLoading(false);
    });
  }, [customerId]);

  if (isLoading)
    return <div className={styles.loading}>Đang tải lịch sử...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.timeline}>
        {history.length > 0 ? (
          history.map((log) => <HistoryItem key={log._id} log={log} />)
        ) : (
          <p className={styles.noHistory}>Chưa có lịch sử tương tác.</p>
        )}
      </div>
    </div>
  );
}
