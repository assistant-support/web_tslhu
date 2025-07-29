// File: PendingQueuePanel.js
"use client";

import React, { useState, useMemo, useTransition } from "react";
import styles from "./PanelStyles.module.css";
import { usePanels } from "@/contexts/PanelContext";
import { getCustomerDetails } from "@/app/actions/customerActions";
import CustomerDetails from "@/app/(main)/client/ui/details/CustomerDetails";
import { removeTaskFromSchedule } from "@/app/actions/campaignActions";

export default function PendingQueuePanel({
  panelData: { job, onScheduleUpdate },
}) {
  const { openPanel } = usePanels();
  const [tasks, setTasks] = useState(job.tasks || []);
  const [searchTerm, setSearchTerm] = useState("");
  // Yêu cầu 8: Sửa lỗi thiếu isPending
  const [isPending, startTransition] = useTransition();

  const handleDoubleClickCustomer = async (customer) => {
    if (!customer?._id) return;
    const customerDetails = await getCustomerDetails(customer._id);
    if (customerDetails) {
      openPanel({
        id: `details-${customer._id}`,
        component: CustomerDetails,
        title: `Chi tiết: ${customerDetails.name}`,
        props: {
          customerData: customerDetails,
          // Yêu cầu 1: Truyền callback xuống để đồng bộ state
          onUpdateInList: (updatedCustomer) => {
            setTasks((currentTasks) =>
              currentTasks.map((task) =>
                task.person._id === updatedCustomer._id
                  ? { ...task, person: updatedCustomer }
                  : task,
              ),
            );
          },
        },
      });
    } else {
      alert("Không thể lấy thông tin chi tiết khách hàng.");
    }
  };

  const filteredTasks = useMemo(() => {
    if (!searchTerm) return tasks;
    return tasks.filter(
      (task) =>
        task.person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.person.phone.includes(searchTerm),
    );
  }, [searchTerm, tasks]);

  const handleRemoveTask = (taskId) => {
    if (confirm("Bạn có chắc muốn xóa người này khỏi hàng đợi không?")) {
      startTransition(async () => {
        const result = await removeTaskFromSchedule(job._id, taskId);
        if (result.success) {
          setTasks((prev) => prev.filter((t) => t._id !== taskId));
          // Gọi callback lên để cập nhật lại component cha
          onScheduleUpdate({
            type: "TASK_REMOVED",
            jobId: job._id,
            updatedJob: result.updatedJob,
          });
        } else {
          alert(`Lỗi: ${result.error}`);
        }
      });
    }
  };

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
          <div
            key={task._id}
            className={styles.listItem}
            onDoubleClick={() => handleDoubleClickCustomer(task.person)}
            title="Double-click để xem chi tiết khách hàng"
          >
            <div className={styles.listItemInfo}>
              <span className={styles.itemName}>{task.person.name}</span>
              <span className={styles.itemSubtext}>{task.person.phone}</span>
            </div>
            <div className={styles.listItemStatus}>
              🕒 {new Date(task.scheduledFor).toLocaleString("vi-VN")}
            </div>
            {/* Yêu cầu 13: Nút xóa */}
            <button
              className={styles.deleteButton}
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveTask(task._id);
              }}
              disabled={isPending}
              title="Xóa khỏi hàng đợi"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
