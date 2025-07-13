// File: app/client/ui/details/CustomerDetails.js

"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./CustomerDetails.module.css";
import { usePanels } from "@/contexts/PanelContext";
import {
  Svg_History,
  Svg_Notes,
  Svg_Edit,
  Svg_Pen,
} from "@/components/(icon)/svg";
import Loading from "@/components/(ui)/(loading)/loading";
import StageIndicator from "@/components/(ui)/progress/StageIndicator";

// --- Component hiển thị một dòng thông tin ---
const InfoRow = ({ label, value, children, statusColor }) => (
  <div className={styles.infoRow}>
    <span className={styles.infoLabel}>{label}</span>
    <div className={styles.infoValue}>
      {statusColor ? (
        <span className={styles.statusTag} data-status={statusColor}>
          {value}
        </span>
      ) : (
        value
      )}
      {children}
    </div>
  </div>
);

// --- Component chính ---
export default function CustomerDetails({
  customerData,
  onSave,
  onShowHistory,
  onShowActionPanel,
}) {
  const [customer, setCustomer] = useState(customerData);

  const [isNoteVisible, setNoteVisible] = useState(false);
  const [isStatusSelectorVisible, setStatusSelectorVisible] = useState(false);

  const [editableStatus, setEditableStatus] = useState("");
  const [notes, setNotes] = useState({
    careNote: "",
    studyTryNote: "",
    studyNote: "",
  });

  useEffect(() => {
    if (customer) {
      setEditableStatus(customer.status?._id || "");
      setNotes({
        careNote: customer.careNote || "",
        studyTryNote: customer.studyTryNote || "",
        studyNote: customer.studyNote || "",
      });
    }
  }, [customer]);

  const handleUpdateLookup = () => {
    if (customer?.MaDangKy) {
      const url = `https://xettuyen.lhu.edu.vn/cap-nhat-thong-tin-xet-tuyen-dai-hoc?id=${encodeURIComponent(
        customer.MaDangKy,
      )}&htx=0`;
      window.open(url, "_blank");
    }
  };

  const getStatusColor = (tinhTrang) => {
    if (tinhTrang === "Không có thông tin" || tinhTrang === "Lỗi tra cứu")
      return "error";
    if (tinhTrang === "Thiếu thông tin") return "warning";
    if (tinhTrang === "Đủ đúng không xét tuyển") return "success";
    if (tinhTrang) return "found";
    return "not-found";
  };

  if (!customer) {
    // Hiển thị loading hoặc thông báo trống trong khi chờ dữ liệu được truyền vào
    return (
      <div className={styles.loadingContainer}>
        <Loading />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* START: CẬP NHẬT JSX */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Thông tin cơ bản</h3>
          <InfoRow label="Tên" value={customer.HoTen || customer.name} />
          <InfoRow
            label="Di động"
            value={customer.DienThoai || customer.phone}
          />
          <div className={styles.mainActionContainer}>
            <button
              className={styles.mainActionButton}
              onClick={() => onShowActionPanel(customer)}
            >
              Hành động nhanh
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Thông tin xét tuyển</h3>
          <InfoRow label="Mã ĐK" value={customer.MaDangKy} />
          <InfoRow label="CMND/CCCD" value={customer.CMND} />
          <InfoRow label="Ngày ĐK" value={customer.NgayDK} />
          <InfoRow label="Trường THPT" value={customer.TruongTHPT} />
          <InfoRow label="Ngành xét tuyển" value={customer.TenNganh} />
          <InfoRow label="Tổng điểm" value={customer.TongDiem} />
          <InfoRow label="Phương thức XT" value={customer.TenPhuongThuc} />
          <InfoRow
            label="Tình trạng TT"
            value={customer.TinhTrang}
            statusColor={getStatusColor(customer.TinhTrang)}
          />
          <div className={styles.updateLookupContainer}>
            <button
              className={styles.secondaryButton}
              onClick={handleUpdateLookup}
              disabled={!customer?.MaDangKy}
            >
              <Svg_Pen w={14} h={14} /> Đi đến trang cập nhật
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Thông tin chăm sóc</h3>
          <InfoRow label="Trạng thái">
            <span>{customer.status?.name || "Chưa có"}</span>
            <button
              className={styles.inlineButton}
              onClick={() => setStatusSelectorVisible(!isStatusSelectorVisible)}
            >
              <Svg_Edit w={14} h={14} /> Thay đổi
            </button>
          </InfoRow>

          {isStatusSelectorVisible && (
            <div className={styles.statusSelector}>
              <select
                value={editableStatus}
                onChange={(e) => setEditableStatus(e.target.value)}
              >
                <option value="">-- Chọn trạng thái mới --</option>
                <option value="1">Đã liên hệ</option>
                <option value="2">Tiềm năng</option>
                <option value="3">Không nghe máy</option>
              </select>
            </div>
          )}

          <InfoRow label="Giai đoạn">
            <StageIndicator level={customer.stageLevel || 0} />
            <button
              className={styles.inlineButton}
              onClick={() => setNoteVisible(!isNoteVisible)}
            >
              <Svg_Notes w={14} h={14} /> Ghi chú
            </button>
          </InfoRow>

          {isNoteVisible && (
            <div className={styles.notesSection}>
              <textarea
                placeholder="Ghi chú chăm sóc..."
                value={notes.careNote}
                onChange={(e) =>
                  setNotes({ ...notes, careNote: e.target.value })
                }
              />
              <textarea
                placeholder="Ghi chú học thử..."
                value={notes.studyTryNote}
                onChange={(e) =>
                  setNotes({ ...notes, studyTryNote: e.target.value })
                }
              />
              <textarea
                placeholder="Ghi chú nhập học..."
                value={notes.studyNote}
                onChange={(e) =>
                  setNotes({ ...notes, studyNote: e.target.value })
                }
              />
            </div>
          )}

          <InfoRow label="NV Chăm sóc">
            {customer.auth && customer.auth.length > 0
              ? customer.auth.map((user) => user.name || user.email).join(", ")
              : "Chưa có"}
          </InfoRow>
        </div>
        {/* END: CẬP NHẬT JSX */}

        <div className={styles.historyButtonContainer}>
          <button
            className={styles.fullWidthButton}
            onClick={() => onShowHistory(customer)}
          >
            <Svg_History w={16} h={16} /> Hiển thị lịch sử tương tác
          </button>
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.saveButton}>Lưu thay đổi</button>
      </div>
    </div>
  );
}
