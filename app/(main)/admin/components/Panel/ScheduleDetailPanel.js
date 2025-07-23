"use client";

import React, { useState, useTransition } from "react";
import styles from "./ScheduleDetailPanel.module.css";
import { useRouter } from "next/navigation";
import {
  stopSchedule,
  removeTaskFromSchedule,
} from "@/app/actions/campaignActions";

const RecipientRow = ({ task, onRemove, isPending }) => {
  return (
    <div className={styles.recipientRow}>
      <div className={styles.recipientInfo}>
        <span className={styles.recipientName}>{task.person.name}</span>
        <span className={styles.recipientPhone}>{task.person.phone}</span>
      </div>
      <div className={styles.recipientStatus} data-status={task.status}>
        {task.status}
      </div>
      <div className={styles.recipientAction}>
        {task.status === "pending" && (
          <button
            onClick={onRemove}
            className={styles.removeButton}
            disabled={isPending}
          >
            Xóa
          </button>
        )}
      </div>
    </div>
  );
};

export default function ScheduleDetailPanel({
  panelData: job,
  closePanel,
  onScheduleUpdate,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tasks, setTasks] = useState(job.tasks || []);

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
          closePanel(); // Đóng panel lại
        }
      });
    }
  };

  const handleRemoveTask = (taskId) => {
    startTransition(async () => {
      const result = await removeTaskFromSchedule(job._id, taskId);
      if (result.error) alert(`Lỗi: ${result.error}`);
      else {
        setTasks((currentTasks) =>
          currentTasks.filter((t) => t._id !== taskId),
        );
        // Gọi callback để báo cho cha biết cần cập nhật UI
        onScheduleUpdate({
          type: "REMOVE_TASK",
          jobId: job._id,
          taskId: taskId,
        });
      }
    });
  };

  const st = job.statistics;
  const progress = st.total > 0 ? (st.completed / st.total) * 100 : 0;

  return (
    <div className={styles.panelContainer}>
      <div className={styles.panelHeader}>
        <h3>{job.jobName}</h3>
        <div className={styles.headerStats}>
          <span>
            Trạng thái:{" "}
            <strong className={styles.statusProcessing}>{job.status}</strong>
          </span>
          <span>
            Loại: <strong>{job.actionType}</strong>
          </span>
        </div>
      </div>

      {/* Hiển thị nội dung tin nhắn nếu có */}
      {job.actionType === "sendMessage" && job.config.messageTemplate && (
        <div className={styles.messageSection}>
          <h4>Nội dung tin nhắn</h4>
          <pre className={styles.messageContent}>
            {job.config.messageTemplate}
          </pre>
        </div>
      )}

      <div className={styles.recipientSection}>
        <h4>Quản lý Người nhận ({tasks.length})</h4>
        <div className={styles.recipientList}>
          {tasks.map((task) => (
            <RecipientRow
              key={task._id}
              task={task}
              onRemove={() => handleRemoveTask(task._id)}
              isPending={isPending}
            />
          ))}
        </div>
      </div>

      <div className={styles.panelFooter}>
        <button
          onClick={handleStopSchedule}
          className={styles.stopButton}
          disabled={isPending}
        >
          {isPending ? "Đang xử lý..." : "Dừng & Hủy toàn bộ Lịch trình"}
        </button>
      </div>
    </div>
  );
}
