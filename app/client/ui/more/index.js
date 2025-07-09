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
  const [isLoading, setIsLoading] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#808080");

  useEffect(() => {
    if (editingStatus) {
      setNewName(editingStatus.name);
      setNewColor(editingStatus.color || "#808080");
    } else {
      setNewName("");
      setNewColor("#808080");
    }
  }, [editingStatus]);

  const handleSave = async () => {
    if (!newName.trim()) {
      alert("Tên trạng thái không được để trống.");
      return;
    }
    setIsLoading(true);
    try {
      const endpoint = "/api/statuses";
      const method = editingStatus ? "PUT" : "POST";
      const payload = editingStatus
        ? { _id: editingStatus._id, name: newName, color: newColor }
        : { name: newName, color: newColor };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);

      alert(result.message);
      setEditingStatus(null);
      onUpdate(); // Tải lại danh sách trạng thái
    } catch (error) {
      alert(`Lỗi: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (statusToDelete) => {
    if (
      !window.confirm(
        `Bạn có chắc muốn xóa trạng thái "${statusToDelete.name}" không?`,
      )
    )
      return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/statuses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: statusToDelete._id }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);

      alert(result.message);
      onUpdate();
    } catch (error) {
      alert(`Lỗi: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        width: "400px",
        maxHeight: "80vh",
        overflowY: "auto",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Quản lý Trạng thái</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {statuses.map((s) => (
          <li
            key={s._id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "10px",
              padding: "8px",
              background: "#f0f0f0",
              borderRadius: "4px",
            }}
          >
            <span
              style={{
                width: "20px",
                height: "20px",
                backgroundColor: s.color,
                borderRadius: "50%",
                border: "1px solid #ddd",
              }}
            ></span>
            <span style={{ flex: 1 }}>{s.name}</span>
            <button onClick={() => setEditingStatus(s)}>Sửa</button>
            <button onClick={() => handleDelete(s)} style={{ color: "red" }}>
              Xóa
            </button>
          </li>
        ))}
      </ul>
      <div
        style={{
          borderTop: "1px solid #ccc",
          paddingTop: "20px",
          marginTop: "20px",
        }}
      >
        <h4>{editingStatus ? "Sửa trạng thái" : "Thêm trạng thái mới"}</h4>
        <input
          type="text"
          placeholder="Tên trạng thái"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />
        <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
          <button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Đang lưu..." : "Lưu"}
          </button>
          {editingStatus && (
            <button onClick={() => setEditingStatus(null)}>Hủy sửa</button>
          )}
        </div>
      </div>
      <button onClick={onClose} style={{ marginTop: "20px", width: "100%" }}>
        Đóng
      </button>
    </div>
  );
};

export default function SidePanel({ open, row, labels = [], onClose, onSave }) {
  const firstInputRef = useRef(null);
  const [inputs, setInputs] = useState({
    careNote: "",
    studyTryNote: "",
    studyNote: "",
  });
  const [saving, setSaving] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
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

  const handleHistoryClick = useCallback((h) => {
    setSelectedHistory(h);
    setDetailOpen(true);
  }, []);

  const renderContent = () => (
    <>
      <section className={styles.info}>
        <p className="text_4" style={{ marginBottom: 8 }}>
          Thông tin khách hàng
        </p>
        <InfoRow label="Họ và tên" value={row?.nameParent} />
        <InfoRow label="Số điện thoại" value={row?.phone} />
        <InfoRow label="Email" value={row?.email} />
        <InfoRow label="Tên học sinh" value={row?.nameStudent} />
        <InfoRow label="Khu vực" value={row?.area} />
        <InfoRow label="Nguồn data" value={row?.source} />
      </section>

      {labels.length > 0 && (
        <section className={styles.labelsBox}>
          <p className="text_4" style={{ marginBottom: 8 }}>
            Nhãn
          </p>
          <div className={styles.labelsWrap}>
            {labels.map((l) => (
              <span key={l} className="chip">
                {l}
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
          onClick={() => setSecondaryOpen(true)}
        >
          Chi tiết chăm sóc
        </button>
      </section>

      <section className={styles.info}>
        <p className="text_4" style={{ marginBottom: 8 }}>
          Cập nhật ghi chú
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          {/* Dropdown Trạng thái */}
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <select
              value={selectedStatusId}
              onChange={handleStatusChange}
              style={{
                padding: "6px 10px",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
              disabled={saving}
              onClick={(e) => e.stopPropagation()} // Ngăn SidePanel đóng khi click
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
              style={{ fontSize: "12px", padding: "4px 8px" }}
            >
              Quản lý trạng thái
            </button>
          </div>

          {/* Nút Thu gọn/Mở rộng */}
          <button
            onClick={() => setFormOpen((o) => !o)}
            style={{ fontSize: "12px", padding: "4px 8px" }}
          >
            {formOpen ? "Thu gọn" : "Mở rộng"}
          </button>
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
        key={row?.phone ?? "no-row"}
        onClose={onClose}
        title="Chi tiết khách hàng"
        size="md"
        renderItemList={() =>
          row ? renderContent() : <Loading content="Đang tải chi tiết…" />
        }
        secondaryOpen={secondaryOpen}
        onCloseSecondary={() => setSecondaryOpen(false)}
        fetchDataSecondary={() =>
          Data_History_User(row.phone).then((res) => res.data)
        }
        renderSecondaryList={(histories) =>
          renderCareHistory(histories, handleHistoryClick, row.phone)
        }
        secondaryTitle="Lịch sử chăm sóc"
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
        button={
          <div
            onClick={() => {
              if (notiStatus) onSave();
              setNotiOpen(false);
            }}
            className={styles.saveBtn}
            style={{
              width: "calc(100% - 52px)",
              display: "flex",
              justifyContent: "center",
            }}
          >
            Tắt thông báo
          </div>
        }
      />
    </>
  );
}
