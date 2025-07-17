// app/client/ui/schedule/index.js
"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Noti from "@/components/(features)/(noti)/noti";
import styles from "./index.module.css";
// Import các component con trực tiếp
import CenterPopup from "@/components/(features)/(popup)/popup_center";
import RecipientList from "./RecipientList";
import { useCampaigns } from "@/contexts/CampaignContext";

const AVAILABLE_ACTIONS = [
  { key: "sendMessage", name: "Gửi tin" },
  { key: "addFriend", name: "Kết bạn" },
  { key: "findUid", name: "Tìm UID" },
  // Thêm các hành động khác ở đây
];

const LimitInputRow = ({ label, value, onChange, min, max, disabled }) => {
  const handleInputChange = (e) => {
    if (disabled) return;
    const inputValue = e.target.value;
    if (inputValue === "") {
      onChange("");
      return;
    }
    onChange(Number(inputValue));
  };
  const handleInputBlur = () => {
    if (disabled) return;
    let num = parseInt(value, 10);
    if (isNaN(num) || num < min) {
      num = min;
    } else if (num > max) {
      num = max;
    }
    onChange(num);
  };
  const increment = () => {
    const nextValue = (Number(value) || 0) + 1;
    if (nextValue <= max) onChange(nextValue);
  };
  const decrement = () => {
    const nextValue = (Number(value) || 0) - 1;
    if (nextValue >= min) onChange(nextValue);
  };
  return (
    <div className={styles.limit_row}>
      <p className="text_6">{label}</p>
      <div className={styles.stepper_container}>
        <button
          onClick={decrement}
          className={styles.stepper_btn}
          disabled={disabled || value <= min}
        >
          -
        </button>
        <input
          type="number"
          value={value}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          className={styles.limit_input}
          disabled={disabled}
        />
        <button
          onClick={increment}
          className={styles.stepper_btn}
          disabled={disabled || value >= max}
        >
          +
        </button>
      </div>
    </div>
  );
};

const ScheduleForm = ({
  jobName,
  setJobName,
  actionType,
  setActionType,
  message,
  setMessage,
  actionsPerHour,
  setActionsPerHour,
  activeRecipientCount,
  labels,
  selectedLabelId,
  onLabelChange,
  onSubmit,
  isSubmitting,
  onEditRecipients,
  estimatedTime,
  maxLimit,
}) => (
  <div className={styles.formContainer}>
    <div className={styles.formGroup}>
      <p className="text_6">Tên lịch trình</p>
      <input
        id="jobName"
        type="text"
        className="input"
        value={jobName}
        onChange={(e) => setJobName(e.target.value)}
        placeholder="Ví dụ: Gửi tin khuyến mãi tháng 7"
        disabled={isSubmitting}
      />
    </div>
    <div className={styles.formGroup}>
      <p className="text_6">Hành động</p>
      <select
        id="actionType"
        className="input"
        value={actionType}
        onChange={(e) => setActionType(e.target.value)}
        disabled={isSubmitting}
      >
        <option value="sendMessage">Gửi tin nhắn</option>
        <option value="addFriend">Gửi lời mời kết bạn</option>
        <option value="findUid">Tìm kiếm UID</option>
      </select>
    </div>
    {actionType === "sendMessage" && (
      <>
        <div className={styles.formGroup}>
          <p className="text_6">Chọn nhãn (Tùy chọn)</p>
          <select
            id="labelSelect"
            className="input"
            value={selectedLabelId}
            onChange={onLabelChange}
            disabled={isSubmitting}
          >
            <option value="">-- Chọn nhãn có sẵn --</option>
            {(labels || []).map((label) => (
              <option key={label._id} value={label._id}>
                {label.title}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <p className="text_6">Nội dung tin nhắn</p>
          <textarea
            id="message"
            className="input"
            rows="5"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Nhập nội dung hoặc chọn một nhãn ở trên..."
            disabled={isSubmitting}
          />
        </div>
      </>
    )}
    <div className={styles.formGroup}>
      <LimitInputRow
        label="Số lượng gửi / giờ:"
        value={actionsPerHour}
        onChange={setActionsPerHour}
        min={1}
        max={maxLimit}
        disabled={isSubmitting}
      />
    </div>
    <div className={styles.summary}>
      <div className={styles.summaryInfo}>
        <p className="text_6_400">
          Số người thực hiện: <strong>{activeRecipientCount} người</strong>
        </p>
        <p className="text_6_400">
          Thời gian hoàn thành: <strong>~{estimatedTime}</strong>
        </p>
      </div>
      <button
        className="input"
        onClick={onEditRecipients}
        style={{ cursor: "pointer" }}
        disabled={isSubmitting}
      >
        Chỉnh sửa
      </button>
    </div>
    <button
      onClick={onSubmit}
      className="btn"
      disabled={isSubmitting}
      style={{
        width: "100%",
        justifyContent: "center",
        borderRadius: 5,
        marginTop: 16,
      }}
    >
      {isSubmitting
        ? "Đang xử lý..."
        : activeRecipientCount > 1
        ? "Bắt đầu lịch trình"
        : "Gửi ngay"}
    </button>
  </div>
);

// --- Component Schedule Chính ---
export default function Schedule({
  user,
  label: labelsFromProps,
  initialData,
}) {
  const router = useRouter();
  const [currentRecipients, setCurrentRecipients] = useState([]);
  const [removedIds, setRemovedIds] = useState(() => new Set());
  const [isRecipientPopupOpen, setIsRecipientPopupOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobName, setJobName] = useState("");
  const [actionType, setActionType] = useState("sendMessage");
  const [message, setMessage] = useState("");
  const [actionsPerHour, setActionsPerHour] = useState(50);
  const [selectedLabelId, setSelectedLabelId] = useState("");
  const [notification, setNotification] = useState({
    open: false,
    status: true,
    mes: "",
  });
  const { createDraft, removeDraft } = useCampaigns();
  const [draftId, setDraftId] = useState(null);

  useEffect(() => {
    // Đăng ký một chiến dịch nháp khi component mount
    const newDraftId = createDraft({
      title: `Lịch trình cho ${initialData.length} người`,
      recipients: initialData,
    });
    setDraftId(newDraftId);

    // Hàm dọn dẹp: tự hủy đăng ký khi component unmount
    return () => {
      removeDraft(newDraftId);
    };
  }, [initialData, createDraft, removeDraft]);

  // useEffect để thiết lập state ban đầu khi nhận được `initialData`
  useEffect(() => {
    if (initialData) {
      setCurrentRecipients(initialData);
      setRemovedIds(new Set());
    }
  }, [initialData]);

  const activeRecipients = useMemo(
    () => currentRecipients.filter((c) => !removedIds.has(c._id)),
    [currentRecipients, removedIds],
  );

  const estimatedTime = useMemo(() => {
    if (activeRecipients.length === 0 || !actionsPerHour || actionsPerHour <= 0)
      return "0 phút";
    const hoursNeeded = activeRecipients.length / actionsPerHour;
    return hoursNeeded < 1
      ? `${Math.ceil(hoursNeeded * 60)} phút`
      : `${Math.ceil(hoursNeeded)} giờ`;
  }, [activeRecipients.length, actionsPerHour]);

  const handleToggleRecipient = useCallback((customer) => {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.has(customer._id)
        ? next.delete(customer._id)
        : next.add(customer._id);
      return next;
    });
  }, []);

  const handleLabelChange = useCallback(
    (e) => {
      const labelId = e.target.value;
      setSelectedLabelId(labelId);
      const selectedLabel = (labelsFromProps || []).find(
        (l) => l._id === labelId,
      );
      setMessage(selectedLabel ? selectedLabel.content || "" : "");
    },
    [labelsFromProps],
  );

  const handleSubmit = useCallback(async () => {
    if (activeRecipients.length === 0)
      return alert("Không có người nhận nào được chọn.");
    setIsSubmitting(true);
    try {
      const scheduleData = {
        jobName:
          jobName ||
          `Lịch trình ngày ${new Date().toLocaleDateString("vi-VN")}`,
        actionType,
        config: { messageTemplate: message, actionsPerHour },
        zaloAccountId: user.zalo._id,
        tasks: activeRecipients.map((c) => ({
          person: { name: c.name, phone: c.phone, uid: c.uid, _id: c._id },
        })),
      };
      const response = await fetch("/api/runca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduleData),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.mes || "Tạo lịch trình thất bại.");
      setNotification({
        open: true,
        status: true,
        mes: result.mes || "Tạo lịch trình thành công!",
      });
      router.refresh();
    } catch (error) {
      setNotification({ open: true, status: false, mes: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    jobName,
    actionType,
    message,
    actionsPerHour,
    activeRecipients,
    user,
    router,
  ]);

  return (
    <>
      <ScheduleForm
        jobName={jobName}
        setJobName={setJobName}
        actionType={actionType}
        setActionType={setActionType}
        message={message}
        setMessage={setMessage}
        actionsPerHour={actionsPerHour}
        setActionsPerHour={setActionsPerHour}
        activeRecipientCount={activeRecipients.length}
        labels={labelsFromProps || []}
        selectedLabelId={selectedLabelId}
        onLabelChange={handleLabelChange}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        onEditRecipients={() => setIsRecipientPopupOpen(true)}
        estimatedTime={estimatedTime}
        maxLimit={user?.zalo?.rateLimitPerHour || 50}
      />

      <CenterPopup
        open={isRecipientPopupOpen}
        onClose={() => setIsRecipientPopupOpen(false)}
      >
        <div className={styles.recipientPopupContainer}>
          <h3 className={styles.recipientPopupTitle}>
            Chỉnh sửa danh sách ({activeRecipients.length} người)
          </h3>
          <RecipientList
            recipients={currentRecipients} // Dùng state nội bộ
            removedIds={removedIds} // Dùng state nội bộ
            onToggle={handleToggleRecipient} // Dùng hàm nội bộ
          />
        </div>
      </CenterPopup>

      <Noti
        open={notification.open}
        onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
        status={notification.status}
        mes={notification.mes}
      />
    </>
  );
}

// BỎ `forwardRef` đi, không cần nữa.
