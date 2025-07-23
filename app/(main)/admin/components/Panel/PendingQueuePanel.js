// File: PendingQueuePanel.js
"use client";

import React, { useState, useMemo } from "react";
import styles from "./PanelStyles.module.css";

export default function PendingQueuePanel({ panelData: { tasks } }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTasks = useMemo(() => {
    if (!searchTerm) return tasks;
    return tasks.filter(
      (task) =>
        task.person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.person.phone.includes(searchTerm),
    );
  }, [searchTerm, tasks]);

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
        {filteredTasks.map((task) => (
          <div key={task._id} className={styles.listItem}>
            <div className={styles.listItemInfo}>
              <span className={styles.itemName}>{task.person.name}</span>
              <span className={styles.itemSubtext}>{task.person.phone}</span>
            </div>
            <div className={styles.listItemStatus}>
              🕒 {new Date(task.scheduledFor).toLocaleString("vi-VN")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
