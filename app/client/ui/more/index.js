"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import FlexiblePopup from "@/components/(features)/(popup)/popup_right";
import CenterPopup from "@/components/(features)/(popup)/popup_center";
import Loading from "@/components/(ui)/(loading)/loading";
import { Data_History_User, Re_Client } from "@/data/client";
import Noti from "@/components/(features)/(noti)/noti";
import styles from "./index.module.css";
import Title from "@/components/(features)/(popup)/title";
import Schedule from "../schedule"; // Import component Schedule
import CareHistory from "../his"; // Import component CareHistory

// --- CÁC HÀM TIỆN ÍCH ---
const ClientSideTime = ({ date }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !date) {
    return null; // Không hiển thị gì ở server hoặc khi chưa có ngày
  }

  return new Date(date).toLocaleString("vi-VN");
};

const ACTION_TYPE_MAP = {
  sendMessage: "Gửi tin nhắn",
  addFriend: "Gửi lời mời kết bạn",
  findUid: "Tìm kiếm UID",
};

const getCustomerType = (row) => {
  if (!row) return "Mới";
  if (row.remove && row.remove.trim() !== "") return "Đã hủy";
  if (row.study) return "Nhập học";
  if (row.studyTry) return "Học thử";
  if (row.care) return "Có nhu cầu";
  return "Mới";
};

const InfoRow = React.memo(function InfoRow({ label, value }) {
  return (
    <p className="text_6" style={{ margin: "4px 0" }}>
      {label}:&nbsp;
      <span style={{ fontWeight: 400 }}>{value || "—"}</span>
    </p>
  );
});

// --- CÁC COMPONENT RENDER ---

const renderDetailPopup = ({ selectedHistory, userPhone, onClose }) => {
  if (!selectedHistory) return <Loading content="Đang tải..." />;

  const recipientData = selectedHistory.recipients.find(
    (r) => r.phone === userPhone,
  );

  if (!recipientData) {
    return (
      <>
        <Title content={<p>Lỗi</p>} click={onClose} />
        <div style={{ padding: "24px", textAlign: "center" }}>
          Không tìm thấy dữ liệu chi tiết cho hành động này.
        </div>
      </>
    );
  }

  const actionText =
    ACTION_TYPE_MAP[selectedHistory.actionType] || selectedHistory.actionType;
  const isSuccess = recipientData.status === "success";

  return (
    <>
      <Title
        content={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <p>Chi tiết hành động</p>
            <div
              className={styles.historyLabels}
              style={{ backgroundColor: "#e4ddff" }}
            >
              {selectedHistory.jobName}
            </div>
          </div>
        }
        click={onClose}
      />
      <div className={styles.info} style={{ borderBottom: "none" }}>
        <InfoRow label="Hành động" value={actionText} />
        <InfoRow
          label="Thời gian"
          value={<ClientSideTime date={recipientData.processedAt} />}
        />
        <div
          className={styles.messageBlock}
          style={{
            borderTop: "1px solid var(--border-color)",
            margin: "12px 0",
            padding: "6px 0",
          }}
        >
          <p className="text_6" style={{ marginBottom: "4px" }}>
            Nội dung/Kết quả:
          </p>
          <p className={`${styles.historyMessage} text_6_400`}>
            {recipientData.details || "Không có chi tiết."}
          </p>
        </div>
        <div
          className={styles.statusRow}
          style={{ justifyContent: "flex-start" }}
        >
          <p className="text_6">Trạng thái:</p>
          <div
            className={`${styles.statusBadge} ${
              isSuccess ? styles.success : styles.error
            }`}
          >
            <span className={styles.dot} />
            {isSuccess ? "Thành công" : "Thất bại"}
          </div>
        </div>
      </div>
    </>
  );
};

const renderCareHistory = (histories, onHistoryClick, userPhone) => {
  if (!histories) return <Loading content="Đang tải lịch sử..." />;
  if (histories.length === 0) {
    return <div className={styles.emptyHistory}>Chưa có lịch sử chăm sóc</div>;
  }
  return (
    <ul className={styles.historyList}>
      {histories.map((h) => {
        const recipientData = h.recipients.find((r) => r.phone === userPhone);
        if (!recipientData) return null;

        const actionText = ACTION_TYPE_MAP[h.actionType] || h.actionType;
        const isSuccess = recipientData.status === "success";

        return (
          <li
            key={h._id}
            className={styles.historyItem}
            onClick={() => onHistoryClick(h)}
          >
            <div className={styles.historyHeader}>
              <div className={styles.historyDate}>
                <ClientSideTime date={recipientData.processedAt} />
              </div>
              <div className={styles.historyLabels}>{actionText}</div>
            </div>
            <p className={styles.historyMessage}>
              {h.jobName || "Hành động trực tiếp"}
            </p>
            <div
              className={`${styles.statusBadge} ${
                isSuccess ? styles.success : styles.error
              }`}
            >
              <span className={styles.dot} />
              {isSuccess ? "Thành công" : "Thất bại"}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
// --- COMPONENT NHỎ ĐỂ QUẢN LÝ TRẠNG THÁI (THÊM/SỬA/XÓA) ---
const StatusManager = ({ statuses, onUpdate, onClose }) => {
  // State của component
  const [isLoading, setIsLoading] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  const [newName, setNewName] = useState("");

  // State mới để quản lý thông báo
  const [notiOpen, setNotiOpen] = useState(false);
  const [notiStatus, setNotiStatus] = useState(false);
  const [notiMes, setNotiMes] = useState("");
  const [statusToDelete, setStatusToDelete] = useState(null);

  useEffect(() => {
    if (editingStatus) {
      setNewName(editingStatus.name);
    } else {
      setNewName("");
    }
  }, [editingStatus]);

  // Hàm tiện ích để hiển thị thông báo
  const showNotification = (isSuccess, message) => {
    setNotiStatus(isSuccess);
    setNotiMes(message);
    setNotiOpen(true);
  };

  const handleSave = async () => {
    if (!newName.trim()) {
      showNotification(false, "Tên trạng thái không được để trống.");
      return;
    }
    setIsLoading(true);
    try {
      const endpoint = "/api/statuses";
      const method = editingStatus ? "PUT" : "POST";
      const payload = editingStatus
        ? { _id: editingStatus._id, name: newName }
        : { name: newName };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);

      showNotification(true, result.message);
      setEditingStatus(null);
      onUpdate();
    } catch (error) {
      showNotification(false, `Lỗi: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Hàm này giờ chỉ mở hộp thoại xác nhận
  const handleDeleteClick = (status) => {
    setStatusToDelete(status); // Lưu lại trạng thái cần xóa và mở Noti xác nhận
  };

  // 2. Hàm này mới thực sự gọi API để xóa
  const confirmDelete = async () => {
    if (!statusToDelete) return;

    setIsLoading(true);
    // Đóng hộp thoại xác nhận trước
    const statusName = statusToDelete.name;
    setStatusToDelete(null);

    try {
      const res = await fetch("/api/statuses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: statusToDelete._id }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);

      showNotification(true, result.message);
      onUpdate();
    } catch (error) {
      showNotification(false, `Lỗi khi xóa "${statusName}": ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Bọc trong React.Fragment để chứa cả Noti
    <>
      <div
        style={{
          position: "relative",
          padding: "16px",
          // Bỏ width cố định, thêm minWidth và maxWidth
          minWidth: "320px",
          maxWidth: "500px",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "none",
            border: "none",
            fontSize: "24px",
            cursor: "pointer",
            lineHeight: "1",
            padding: "5px",
          }}
        >
          &times;
        </button>

        <h3
          style={{ marginTop: 0, paddingRight: "25px", marginBottom: "16px" }}
        >
          Quản lý Trạng thái
        </h3>

        {/* Div chứa danh sách trạng thái với thanh cuộn riêng */}
        <div
          style={{
            flexShrink: 1,
            overflowY: "auto",
            border: "1px solid #eee",
            padding: "10px",
            borderRadius: "5px",
            marginBottom: "16px",
          }}
        >
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {statuses.map((s) => (
              <li
                key={s._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                {/* Cho phép text tự xuống dòng */}
                <span
                  style={{ flex: 1, wordBreak: "break-word" }}
                  title={s.name}
                >
                  {s.name}
                </span>
                <button
                  onClick={() => setEditingStatus(s)}
                  style={{
                    fontSize: "12px",
                    padding: "4px 8px",
                    flexShrink: 0,
                  }}
                >
                  Sửa
                </button>
                <button
                  onClick={() => handleDeleteClick(s)}
                  style={{
                    color: "red",
                    fontSize: "12px",
                    padding: "4px 8px",
                    flexShrink: 0,
                  }}
                >
                  Xóa
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Phần form để thêm/sửa trạng thái */}
        <div style={{ flexShrink: 0 }}>
          <h4>{editingStatus ? "Sửa trạng thái" : "Thêm trạng thái mới"}</h4>
          <input
            type="text"
            placeholder="Tên trạng thái"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              marginBottom: "10px",
              boxSizing: "border-box", // Thêm thuộc tính này
            }}
          />
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "10px",
              justifyContent: "center",
            }}
          >
            <button
              onClick={handleSave}
              disabled={isLoading}
              style={{
                backgroundColor: "var(--green, #28a745)",
                color: "white",
                padding: "8px 24px",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              {isLoading ? "Đang lưu..." : "Lưu"}
            </button>
            {editingStatus && (
              <button onClick={() => setEditingStatus(null)}>Hủy sửa</button>
            )}
          </div>
        </div>
      </div>

      {/* Noti cho thông báo thành công/thất bại */}
      <Noti
        open={notiOpen}
        onClose={() => setNotiOpen(false)}
        status={notiStatus}
        mes={notiMes}
        button={
          <button
            onClick={() => setNotiOpen(false)}
            style={{ width: "100%", padding: "10px" }}
          >
            Đã hiểu
          </button>
        }
      />

      {/* Chỉ render Noti xác nhận khi statusToDelete có giá trị */}
      {statusToDelete && (
        <Noti
          open={true} // Luôn mở vì đã được bọc bởi điều kiện bên ngoài
          onClose={() => setStatusToDelete(null)}
          status={null}
          mes={`Bạn có chắc muốn xóa trạng thái "${statusToDelete.name}" không? Hành động này không thể hoàn tác.`}
          button={
            <div
              style={{ display: "flex", gap: "10px", justifyContent: "center" }}
            >
              <button
                onClick={confirmDelete}
                style={{ background: "var(--red, #dc3545)", color: "white" }}
              >
                Có, xóa!
              </button>
              <button onClick={() => setStatusToDelete(null)}>Không</button>
            </div>
          }
        />
      )}
    </>
  );
};

export default function SidePanel({
  open,
  row,
  labels,
  onClose,
  onSave,
  onQuickMessage,
  onShowHistory,
}) {
  const firstInputRef = useRef(null);
  const [inputs, setInputs] = useState({
    careNote: "",
    studyTryNote: "",
    studyNote: "",
  });
  const [saving, setSaving] = useState(false);
  const [secondaryView, setSecondaryView] = useState(null);
  const [formOpen, setFormOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [notiOpen, setNotiOpen] = useState(false);
  const [notiStatus, setNotiStatus] = useState(false);
  const [notiMes, setNotiMes] = useState("");
  const [checkedState, setCheckedState] = useState({
    care: false,
    studyTry: false,
    study: false,
  });
  const [statuses, setStatuses] = useState([]); // Lưu danh sách tất cả trạng thái
  const [selectedStatusId, setSelectedStatusId] = useState(""); // Lưu ID của trạng thái được chọn
  const [isStatusManagerOpen, setIsStatusManagerOpen] = useState(false); // Điều khiển popup quản lý
  const [secondaryContent, setSecondaryContent] = useState(null);

  const isCancelled = row?.remove && row.remove.trim() !== "";
  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch("/api/statuses");
      const result = await res.json();
      if (result.success) {
        setStatuses(result.data);
      }
    } catch (error) {
      console.error("Lỗi khi tải trạng thái:", error);
    }
  }, []); // Mảng phụ thuộc rỗng vì hàm này không cần gì từ bên ngoài

  useEffect(() => {
    if (open && row) {
      fetchStatuses();
      // Logic điền dữ liệu vào form
      setInputs({
        careNote: row.careNote ?? "",
        studyTryNote: row.studyTryNote ?? "",
        studyNote: row.studyNote ?? "",
      });
      setCheckedState({
        care: !!row.care,
        studyTry: !!row.studyTry,
        study: !!row.study,
      });
      const currentStatusId =
        typeof row.status === "object" ? row.status?._id : row.status;
      setSelectedStatusId(currentStatusId || "");
    }
  }, [open, row, fetchStatuses]); // Phụ thuộc vào open, row, và hàm fetch

  // 2. useEffect chính để xử lý logic khi mở panel
  useEffect(() => {
    if (open && row) {
      // Tải danh sách trạng thái
      fetchStatuses();

      // Điền dữ liệu của khách hàng vào form
      setInputs({
        careNote: row.careNote ?? "",
        studyTryNote: row.studyTryNote ?? "",
        studyNote: row.studyNote ?? "",
      });

      const currentStatusId =
        typeof row.status === "object" ? row.status?._id : row.status;
      setSelectedStatusId(currentStatusId || "");

      setCheckedState({
        care: !!row.care,
        studyTry: !!row.studyTry,
        study: !!row.study,
      });
    }
  }, [open, row, fetchStatuses]); // Phụ thuộc vào open, row, và hàm fetch

  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (open && formOpen) {
      const t = setTimeout(() => firstInputRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [open, formOpen]);

  const handleChange = (key) => (e) =>
    setInputs((prev) => ({ ...prev, [key]: e.target.value }));

  const handleCheckboxChange = (key) => (e) => {
    setCheckedState((prev) => ({ ...prev, [key]: e.target.checked }));
  };
  const handleStatusChange = (e) => {
    setSelectedStatusId(e.target.value);
  };

  const handleToggleCancel = async () => {
    if (saving) return;
    setSaving(true);
    const newRemoveValue = isCancelled ? "" : "Đã hủy";
    try {
      const res = await fetch("/api/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: row.phone, remove: newRemoveValue }),
      });
      const result = await res.json();
      setNotiStatus(result.status === 2);
      setNotiMes(result.mes);
      setNotiOpen(true);
    } catch (err) {
      setNotiStatus(false);
      setNotiMes(isCancelled ? "Bỏ hủy thất bại!" : "Hủy đăng ký thất bại!");
      setNotiOpen(true);
    } finally {
      setSaving(false);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const payload = {
      _id: row._id,
      status: selectedStatusId,
      ...inputs, // Gửi các ghi chú mới (careNote, studyTryNote, ...)
      ...checkedState, // Gửi trạng thái checkbox (care, studyTry, ...)
    };

    try {
      const res = await fetch("/api/client", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      // Phần xử lý thông báo giữ nguyên
      if (result.status) {
        setNotiStatus(true);
        setNotiMes("Cập nhật thành công!");
        if (onSave) onSave(); // Gọi hàm onSave để làm mới dữ liệu ở trang cha
      } else {
        setNotiStatus(false);
        setNotiMes(result.message || "Cập nhật thất bại!");
      }
      setNotiOpen(true);
    } catch (err) {
      console.error("Lỗi khi cập nhật:", err); // Thêm log để dễ debug
      setNotiStatus(false);
      setNotiMes("Cập nhật thất bại!");
      setNotiOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const renderContent = () => (
    <>
      <section className={styles.info}>
        <p className="text_4" style={{ marginBottom: 8 }}>
          Thông tin khách hàng
        </p>
        <InfoRow label="Tên học sinh" value={row?.name} />
        <InfoRow label="Số điện thoại" value={row?.phone} />
        <InfoRow label="UID" value={row?.uid} />
        <button
          onClick={() => onQuickMessage(row)}
          style={{
            width: "100%",
            marginTop: "12px",
            padding: "8px",
            fontSize: "14px",
            fontWeight: "500",
            color: "#fff",
            backgroundColor: "#0d6efd", // Màu xanh dương
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Lên chiến dịch nhanh
        </button>
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid #f0f0f0",
          }}
        >
          <p className="text_6" style={{ margin: "4px 0", color: "#666" }}>
            Nhân viên chăm sóc:
          </p>
          {row.auth && row.auth.length > 0 ? (
            <ul style={{ listStyle: "none", paddingLeft: "10px", margin: 0 }}>
              {row.auth.map((user) => (
                <li
                  key={user._id}
                  className="text_6_400"
                  style={{ marginBottom: "4px" }}
                >
                  - {user.name || user.email || "Không rõ tên"}
                </li>
              ))}
            </ul>
          ) : (
            <p
              className="text_6_400"
              style={{ fontStyle: "italic", paddingLeft: "10px" }}
            >
              Chưa có nhân viên phụ trách.
            </p>
          )}
        </div>
      </section>

      {labels && labels.length > 0 && (
        <section className={styles.labelsBox}>
          <p className="text_4" style={{ marginBottom: 8 }}>
            Nhãn
          </p>
          <div className={styles.labelsWrap}>
            {labels.map((labelObj) => (
              // 1. Dùng labelObj._id làm key duy nhất
              <span key={labelObj._id} className="chip">
                {/* 2. Hiển thị labelObj.title thay vì cả object */}
                {labelObj.title}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className={styles.info}>
        <p className="text_4" style={{ marginBottom: 8 }}>
          Lịch sử chăm sóc
        </p>
        <InfoRow label="Giai đoạn chăm sóc" value={getCustomerType(row)} />
        <button
          type="button"
          className={styles.saveBtn}
          style={{ marginTop: 8 }}
          onClick={() => onShowHistory(row)}
        >
          Chi tiết chăm sóc
        </button>
      </section>

      <section
        className={"info"}
        style={{
          padding: "16px",
          background: "#f9f9f9",
          borderRadius: "8px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <p className="text_4" style={{ margin: 0, fontWeight: "bold" }}>
            Cập nhật Ghi chú & Trạng thái
          </p>

          {/* Container cho các nút điều khiển bên phải */}
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            {/* Nhóm Dropdown và nút Quản lý */}
            <div style={{ display: "flex", alignItems: "stretch" }}>
              <select
                value={selectedStatusId}
                onChange={handleStatusChange}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #ccc",
                  borderRight: "none",
                  borderRadius: "4px 0 0 4px",
                  backgroundColor: "white",
                  flex: "1 1 auto",
                  minWidth: "120px", // Quy định chiều rộng tối thiểu
                  maxWidth: "300px",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
                disabled={saving}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">-- Chọn trạng thái --</option>
                {statuses.map((status) => (
                  <option key={status._id} value={status._id}>
                    {status.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setIsStatusManagerOpen(true)}
                style={{
                  fontSize: "12px",
                  padding: "6px 8px",
                  border: "1px solid #ccc",
                  borderRadius: "0 4px 4px 0",
                  whiteSpace: "nowrap",
                  backgroundColor: "#f0f0f0",
                  marginLeft: "-1px",
                  cursor: "pointer",
                }}
              >
                Quản lý
              </button>
            </div>

            {/* Nút Thu gọn/Mở rộng */}
            <button
              onClick={() => setFormOpen((o) => !o)}
              style={{
                fontSize: "12px",
                padding: "6px 12px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              {formOpen ? "Thu gọn" : "Mở rộng"}
            </button>
          </div>
        </div>
        {formOpen && (
          <form
            onSubmit={handleSubmit}
            className={styles.form}
            style={{ padding: "12px 0" }}
          >
            {[
              // Chúng ta định nghĩa cả key cho checkbox và key cho textarea ở đây để code rõ ràng hơn
              {
                noteKey: "careNote",
                checkKey: "care",
                label: "Care",
                ref: firstInputRef,
              },
              { noteKey: "studyTryNote", checkKey: "studyTry", label: "OTP" },
              { noteKey: "studyNote", checkKey: "study", label: "Nhập học" },
            ].map(({ noteKey, checkKey, label, ref }) => (
              <div key={noteKey} className={styles.formGroup}>
                {/* Label chứa checkbox và tên */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "4px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    disabled={saving}
                    // Lấy trạng thái từ `checkedState` với key tương ứng (ví dụ: 'care')
                    checked={checkedState[checkKey]}
                    onChange={handleCheckboxChange(checkKey)}
                  />
                  {label}
                </label>

                {/* Textarea để nhập ghi chú */}
                <textarea
                  ref={ref}
                  rows={2}
                  // Lấy giá trị từ `inputs` với key tương ứng (ví dụ: 'careNote')
                  value={inputs[noteKey]}
                  onChange={handleChange(noteKey)}
                  disabled={saving}
                  placeholder={`Thêm ghi chú cho giai đoạn ${label}...`}
                  style={{
                    width: "97%",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                  }}
                />
              </div>
            ))}

            {/* Phần các nút bấm không thay đổi */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 16,
                borderTop: "1px solid var(--border-color)",
                paddingTop: 12,
              }}
            >
              <button
                type="button"
                onClick={handleToggleCancel}
                disabled={saving}
                className={styles.cancelBtn}
                style={{
                  backgroundColor: isCancelled ? "var(--green)" : "var(--red)",
                }}
              >
                {isCancelled ? "Bỏ hủy" : "Hủy bỏ"}
              </button>

              <button
                type="submit"
                className={styles.saveBtn}
                disabled={saving}
              >
                Lưu thông tin
              </button>
            </div>
          </form>
        )}
      </section>
      {saving && (
        <div className={styles.saving}>
          <Loading />
        </div>
      )}
    </>
  );

  return (
    <>
      <FlexiblePopup
        open={open}
        onClose={onClose}
        title="Chi tiết khách hàng"
        renderItemList={() => (row ? renderContent() : <Loading />)}
      />
      <CenterPopup
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        globalZIndex={1001}
        size="md"
      >
        {renderDetailPopup({
          selectedHistory,
          userPhone: row?.phone,
          onClose: () => setDetailOpen(false),
        })}
      </CenterPopup>

      {/* === POPUP QUẢN LÝ TRẠNG THÁI ĐƯỢC THÊM VÀO ĐÂY === */}
      <CenterPopup
        open={isStatusManagerOpen}
        onClose={() => setIsStatusManagerOpen(false)}
        size="auto"
      >
        <StatusManager
          statuses={statuses}
          onUpdate={fetchStatuses}
          onClose={() => setIsStatusManagerOpen(false)}
        />
      </CenterPopup>

      <Noti
        open={notiOpen}
        onClose={() => setNotiOpen(false)}
        status={notiStatus}
        mes={notiMes}
      />
    </>
  );
}
