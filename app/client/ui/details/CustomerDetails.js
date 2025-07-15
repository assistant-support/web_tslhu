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
import TextNoti from "@/components/(features)/(noti)/textnoti";
import Schedule from "../schedule";

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

const StageSelector = ({ currentLevel, onSelect }) => {
  const stages = ["Chưa có", "Chăm sóc", "Học thử", "Vào học"];
  return (
    <div className={styles.stageSelector}>
      {stages.map((stage, index) => (
        <div
          key={index}
          className={`${styles.stageStep} ${
            currentLevel === index ? styles.active : ""
          }`}
          onClick={() => onSelect(index)}
        >
          <div className={styles.stageDot}></div>
          <div className={styles.stageLabel}>{stage}</div>
        </div>
      ))}
    </div>
  );
};

// --- Component chính ---
export default function CustomerDetails({
  customerData,
  onShowHistory,
  user,
  initialLabels,
  onShowActionPanel,
  statuses,
  onRecipientToggle,
  onUpdateCustomer,
}) {
  const [customer, setCustomer] = useState(customerData);
  const { openPanel } = usePanels();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editableName, setEditableName] = useState(customer.name || "");
  const [notification, setNotification] = useState({
    show: false,
    title: "",
    mes: "",
    color: "default",
  });
  const [isNoteVisible, setNoteVisible] = useState(false);
  const [isStatusSelectorVisible, setStatusSelectorVisible] = useState(false);

  const [editableStatus, setEditableStatus] = useState(
    customer.status?._id || "",
  );
  const [editableStageLevel, setEditableStageLevel] = useState(
    customer.stageLevel || 0,
  );
  const [editableNotes, setEditableNotes] = useState({
    careNote: customer.careNote || "",
    studyTryNote: customer.studyTryNote || "",
    studyNote: customer.studyNote || "",
  });

  const handleOpenActionPanel = () => {
    const singleRecipientMap = new Map([[customerData._id, customerData]]);
    openPanel({
      id: `action-${customerData._id}`,
      component: Schedule,
      title: `Hành động cho: ${customerData.name}`,
      props: {
        // Truyền vào một mảng chỉ có 1 phần tử
        initialData: [customerData],
        recipientsMap: singleRecipientMap, // <-- Truyền Map mới tạo
        onRecipientToggle: onRecipientToggle,
        user: user, // Truyền user data vào
        label: initialLabels, // Truyền label data vào
      },
    });
  };

  const handleSaveField = async (fieldName, value) => {
    try {
      const res = await fetch(`/api/client`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer._id,
          updateData: { [fieldName]: value }, // Tạo đối tượng động: { name: 'giá trị mới' }
        }),
      });

      if (!res.ok) throw new Error("Cập nhật thất bại");

      const responseJson = await res.json();
      onUpdateCustomer(responseJson.data); // Cập nhật UI

      // Xử lý riêng cho việc sửa tên
      if (fieldName === "name") {
        setIsEditingName(false); // Ẩn ô nhập liệu sau khi lưu
      }

      setNotification({
        show: true,
        title: "Thành công",
        mes: "Đã cập nhật thông tin.",
        color: "green",
      });
    } catch (error) {
      setNotification({
        show: true,
        title: "Lỗi",
        mes: error.message,
        color: "red",
      });
    }
  };

  // useEffect(() => {
  //   if (customer) {
  //     setEditableStatus(customer.status?._id || "");
  //     setNotes({
  //       careNote: customer.careNote || "",
  //       studyTryNote: customer.studyTryNote || "",
  //       studyNote: customer.studyNote || "",
  //     });
  //   }
  // }, [customer]);

  useEffect(() => {
    // Nếu thông báo đang không hiển thị, không làm gì cả
    if (!notification.show) {
      return;
    }

    // Nếu thông báo được bật, đặt một bộ đếm giờ để tự động tắt nó
    const timerId = setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 3000); // Ẩn sau 3 giây

    // QUAN TRỌNG: Đây là hàm "dọn dẹp"
    // Nó sẽ tự động chạy khi component bị xóa khỏi giao diện,
    // đảm bảo bộ đếm giờ luôn bị hủy, tránh gây lỗi.
    return () => {
      clearTimeout(timerId);
    };
  }, [notification.show]);

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

  const handleUpdateStatus = async () => {
    if (!editableStatus) {
      setNotification({
        show: true,
        title: "Cảnh báo",
        mes: "Vui lòng chọn một trạng thái.",
        color: "yellow",
      });
      return;
    }

    try {
      const res = await fetch(`/api/client`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer._id,
          updateData: { status: editableStatus }, // Gửi đúng định dạng cho API mới
        }),
      });

      if (!res.ok) throw new Error("Cập nhật trạng thái thất bại");

      const responseJson = await res.json();
      onUpdateCustomer(responseJson.data); // Cập nhật UI

      setStatusSelectorVisible(false); // Ẩn dropdown
      setNotification({
        show: true,
        title: "Thành công",
        mes: "Đã cập nhật trạng thái.",
        color: "green",
      });
    } catch (error) {
      setNotification({
        show: true,
        title: "Lỗi",
        mes: error.message,
        color: "red",
      });
    }
  };

  const handleDeleteStatus = async () => {
    if (
      !window.confirm(
        "Bạn có chắc chắn muốn xóa trạng thái của khách hàng này không?",
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/client`, {
        method: "PATCH", // Dùng PATCH một cách thống nhất
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer._id,
          updateData: { status: null }, // Gửi null để xóa (unset) trạng thái
        }),
      });

      if (!res.ok) throw new Error("Xóa trạng thái thất bại");

      const responseJson = await res.json();
      onUpdateCustomer(responseJson.data);

      setStatusSelectorVisible(false);
      setNotification({
        show: true,
        title: "Thành Công",
        mes: "Đã xóa trạng thái của khách hàng.",
        color: "green",
      });
    } catch (error) {
      setNotification({
        show: true,
        title: "Lỗi",
        mes: error.message,
        color: "red",
      });
    }
  };

  return (
    <div className={styles.container}>
      {notification.show && (
        <div className={styles.notificationContainer}>
          <TextNoti
            title={notification.title}
            mes={notification.mes}
            color={notification.color}
          />
        </div>
      )}
      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Thông tin cơ bản</h3>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Tên khách hàng</span>
            <div className={styles.infoValue}>
              {isEditingName ? (
                // Chế độ SỬA
                <div className={styles.editInputContainer}>
                  <input
                    type="text"
                    value={editableName}
                    onChange={(e) => setEditableName(e.target.value)}
                    className={styles.inlineInput}
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveField("name", editableName)}
                    className={styles.inlineSaveButton}
                  >
                    Lưu
                  </button>
                  <button
                    onClick={() => setIsEditingName(false)}
                    className={styles.inlineCancelButton}
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                // Chế độ XEM
                <>
                  <span>{customer.name || "(chưa có tên)"}</span>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className={styles.inlineButton}
                  >
                    <Svg_Edit w={14} h={14} /> Sửa
                  </button>
                </>
              )}
            </div>
          </div>
          <InfoRow
            label="Di động"
            value={customer.DienThoai || customer.phone}
          />
          <div className={styles.mainActionContainer}>
            <button onClick={handleOpenActionPanel}>Lên Lịch Nhanh</button>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Thông tin xét tuyển</h3>
          <InfoRow label="Tên" value={customer.admissionName} />
          <InfoRow label="Di động" value={customer.admissionPhone} />
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
                {statuses?.map((status) => (
                  <option key={status._id} value={status._id}>
                    {status.name}
                  </option>
                ))}
              </select>

              <div className={styles.actionButtons}>
                {/* Chỉ hiển thị nút xóa khi customer có status */}
                {customer?.status && (
                  <button
                    onClick={handleDeleteStatus}
                    // Đổi tên class để rõ ràng hơn
                    className={`${styles.buttonBase} ${styles.statusDeleteButton}`}
                  >
                    Xóa trạng thái
                  </button>
                )}
                <button
                  onClick={handleUpdateStatus}
                  // Đổi tên class để rõ ràng hơn
                  className={`${styles.buttonBase} ${styles.statusSaveButton}`}
                >
                  Lưu
                </button>
              </div>
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
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Giai đoạn & Ghi chú</div>

              {/* Thanh cập nhật Stage Level */}
              <div className={styles.infoRow}>
                <StageSelector
                  currentLevel={editableStageLevel}
                  onSelect={(level) => {
                    setEditableStageLevel(level);
                    handleSaveField("stageLevel", level); // Tự động lưu khi click
                  }}
                />
              </div>

              {/* Ghi chú Chăm sóc */}
              <div className={styles.noteSection}>
                <label className={styles.noteLabel}>Ghi chú Chăm sóc:</label>
                <textarea
                  className={styles.noteTextArea}
                  placeholder="Nhập ghi chú giai đoạn chăm sóc..."
                  value={editableNotes.careNote}
                  onChange={(e) =>
                    setEditableNotes({
                      ...editableNotes,
                      careNote: e.target.value,
                    })
                  }
                  onBlur={() =>
                    handleSaveField("careNote", editableNotes.careNote)
                  } // Tự động lưu khi người dùng click ra ngoài
                />
              </div>

              {/* Ghi chú Học thử */}
              <div className={styles.noteSection}>
                <label className={styles.noteLabel}>Ghi chú Học thử:</label>
                <textarea
                  className={styles.noteTextArea}
                  placeholder="Nhập ghi chú giai đoạn học thử..."
                  value={editableNotes.studyTryNote}
                  onChange={(e) =>
                    setEditableNotes({
                      ...editableNotes,
                      studyTryNote: e.target.value,
                    })
                  }
                  onBlur={() =>
                    handleSaveField("studyTryNote", editableNotes.studyTryNote)
                  }
                />
              </div>

              {/* Ghi chú Vào học */}
              <div className={styles.noteSection}>
                <label className={styles.noteLabel}>Ghi chú Vào học:</label>
                <textarea
                  className={styles.noteTextArea}
                  placeholder="Nhập ghi chú giai đoạn vào học..."
                  value={editableNotes.studyNote}
                  onChange={(e) =>
                    setEditableNotes({
                      ...editableNotes,
                      studyNote: e.target.value,
                    })
                  }
                  onBlur={() =>
                    handleSaveField("studyNote", editableNotes.studyNote)
                  }
                />
              </div>
            </div>
          )}

          <InfoRow label="NV Chăm sóc">
            {customer.auth && customer.auth.length > 0
              ? customer.auth.map((user) => user.name || user.email).join(", ")
              : "Chưa có"}
          </InfoRow>
        </div>

        <div className={styles.historyButtonContainer}>
          <button
            className={styles.fullWidthButton}
            onClick={() => onShowHistory(customer)}
          >
            <Svg_History w={16} h={16} /> Hiển thị lịch sử tương tác
          </button>
        </div>
      </div>
    </div>
  );
}
