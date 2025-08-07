// ++ ADDED: File mới cho panel chi tiết tài khoản Zalo
"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import styles from "./DetailsPanel.module.css";
import {
  getZaloAccountDetails,
  updateZaloAccountDetails,
  createZaloAccount,
} from "@/app/actions/zaloAccountActions";
import LoadingSpinner from "../shared/LoadingSpinner";
import ZaloDisplay from "../shared/ZaloDisplay";
import UserDisplay from "../shared/UserDisplay";
import { usePanels } from "@/contexts/PanelContext";
import AssignUserPanel from "./AssignUserPanel";
import UserDetailsPanel from "./UserDetailsPanel";
import UserTag from "../shared/UserTag";

const handleUserDoubleClick = (user) => {
  const panelId = `user-details-${user._id}`;
  openPanel({
    id: panelId,
    title: `Chi tiết User: ${user.name}`,
    component: UserDetailsPanel,
    props: {
      userId: user._id,
      onUpdate,
      closePanel: () => closeChildPanel(panelId),
    },
  });
};

// Component con có thể thu gọn/mở rộng
const CollapsibleList = ({ title, items, onDoubleClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={styles.collapsibleSection}>
      <button
        className={styles.collapsibleHeader}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>
          {title} ({items.length})
        </span>
        <span
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
        >
          ▼
        </span>
      </button>
      {isOpen && (
        <div className={styles.list}>
          {items.length > 0 ? (
            items.map((user) => (
              <div
                key={user._id}
                className={`${styles.listItem} ${styles.listItemAction}`}
                onDoubleClick={() => onDoubleClick(user)}
              >
                <UserTag user={user} />
              </div>
            ))
          ) : (
            <p className={styles.emptyText}>Chưa có nhân viên nào được gán.</p>
          )}
        </div>
      )}
    </div>
  );
};

// Component con cho phép chỉnh sửa trực tiếp
const EditableField = ({ label, value, name, type = "text", onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCurrentValue(value); // Cập nhật giá trị khi prop thay đổi
  }, [value]);

  const handleSave = () => {
    startTransition(async () => {
      const success = await onSave(name, currentValue);
      if (success) setIsEditing(false);
    });
  };

  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}:</span>
      {isEditing ? (
        <div className={styles.editGroup}>
          {type === "textarea" ? (
            <textarea
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              className={`${styles.input} ${styles.textareaScript}`}
            />
          ) : (
            <input
              type={type}
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              className={styles.input}
            />
          )}
          <button
            onClick={handleSave}
            className={styles.saveInlineBtn}
            disabled={isPending}
          >
            {isPending ? "..." : "Lưu"}
          </button>
          <button
            onClick={() => {
              setIsEditing(false);
              setCurrentValue(value);
            }}
            className={styles.cancelInlineBtn}
            disabled={isPending}
          >
            Hủy
          </button>
        </div>
      ) : (
        <div className={styles.valueGroup}>
          {/* ** MODIFIED: Áp dụng style scriptUrl cho tất cả các giá trị text dài */}
          <span className={styles.scriptUrl}>{value || "Chưa có"}</span>
          <button
            onClick={() => setIsEditing(true)}
            className={styles.editInlineBtn}
          >
            Sửa
          </button>
        </div>
      )}
    </div>
  );
};

export default function ZaloDetailsPanel({ accountId, onUpdate, closePanel }) {
  const [account, setAccount] = useState(null);
  const [isLoading, setIsLoading] = useState(!!accountId); // Chỉ loading nếu có accountId
  const { openPanel, closePanel: closeChildPanel } = usePanels();

  // ** MODIFIED: State để quản lý dữ liệu form cho cả 2 chế độ
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    avt: "",
    action: "",
    uid: "", // Thêm uid vào form
  });
  const isCreating = !accountId; // Xác định chế độ "tạo mới"

  const fetchData = useCallback(async () => {
    if (isCreating) return;
    setIsLoading(true); // Bật loading khi fetch
    const accountData = await getZaloAccountDetails(accountId);
    setAccount(accountData);
    if (accountData) setFormData(accountData); // Đồng bộ form data
    setIsLoading(false);
  }, [accountId, isCreating]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenAssignPanel = () => {
    const panelId = `assign-user-for-${accountId}`;
    openPanel({
      id: panelId,
      title: `Gán quyền cho: ${account.name}`,
      component: AssignUserPanel,
      props: {
        account,
        onClose: () => closeChildPanel(panelId),
        onSuccess: async () => {
          await fetchData();
          onUpdate();
        },
      },
    });
  };

  const handleUserDoubleClick = (user) => {
    const panelId = `user-details-${user._id}`;
    openPanel({
      id: panelId,
      title: `Chi tiết User: ${user.name}`,
      component: UserDetailsPanel,
      props: {
        userId: user._id,
        onUpdate,
        closePanel: () => closeChildPanel(panelId),
      },
    });
  };

  const handleFieldSave = async (fieldName, newValue) => {
    if (isCreating) {
      setFormData((prev) => ({ ...prev, [fieldName]: newValue }));
      return true; // Chỉ cập nhật state ở client khi tạo mới
    }
    // Logic lưu khi chỉnh sửa
    const result = await updateZaloAccountDetails(accountId, {
      [fieldName]: newValue,
    });
    if (result.success) {
      setAccount(result.data);
      onUpdate(); // Cập nhật lại bảng chính
      return true;
    }
    alert(`Lỗi: ${result.error}`);
    return false;
  };

  // ** ADDED: Hàm xử lý khi bấm nút "Tạo mới"
  const handleCreateAccount = async () => {
    const result = await createZaloAccount(formData);
    if (result.success) {
      alert("Tạo tài khoản thành công!");
      onUpdate();
      closePanel();
    } else {
      alert(`Lỗi: ${result.error}`);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  // ** MODIFIED: Sửa lỗi logic hiển thị
  // Nếu không phải đang tạo mới VÀ không tìm thấy tài khoản, mới báo lỗi
  if (!isCreating && !account) {
    return <div className={styles.error}>Không tìm thấy tài khoản.</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {isCreating ? (
          <p className={styles.sectionTitle} style={{ border: "none" }}>
            Nhập thông tin tài khoản mới
          </p>
        ) : (
          <ZaloDisplay
            name={account.name}
            phone={account.phone}
            avatar={account.avt}
          />
        )}
      </div>

      <div className={styles.content}>
        {/* Chỉ hiển thị danh sách user khi đang chỉnh sửa */}
        {!isCreating && account && (
          <CollapsibleList
            title="Nhân viên được gán"
            items={account.users || []}
            onDoubleClick={() => {}}
          />
        )}

        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Thông tin Cơ bản & Script</h4>
          <EditableField
            label="Tên tài khoản"
            name="name"
            value={formData.name}
            onSave={handleFieldSave}
          />
          <EditableField
            label="Số điện thoại"
            name="phone"
            value={formData.phone}
            onSave={handleFieldSave}
          />
          <EditableField
            label="UID tài khoản"
            name="uid"
            value={formData.uid}
            onSave={handleFieldSave}
          />
          <EditableField
            label="Avatar URL"
            name="avt"
            value={formData.avt}
            onSave={handleFieldSave}
          />
          <EditableField
            label="Script Action URL"
            name="action"
            value={formData.action}
            type="textarea"
            onSave={handleFieldSave}
          />
        </div>

        {/* Chỉ hiển thị thông số limit khi đang chỉnh sửa */}
        {!isCreating && account && (
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>
              Thông số Giới hạn (Rate Limit)
            </h4>
            <EditableField
              label="Giới hạn / giờ"
              name="rateLimitPerHour"
              value={account.rateLimitPerHour}
              type="number"
              onSave={handleFieldSave}
            />
            <EditableField
              label="Giới hạn / ngày"
              name="rateLimitPerDay"
              value={account.rateLimitPerDay}
              type="number"
              onSave={handleFieldSave}
            />
            <div className={styles.infoRowReadOnly}>
              <span className={styles.infoLabel}>Đã dùng / giờ:</span>
              <span className={styles.infoValue}>
                {account.actionsUsedThisHour || 0} (Làm mới lúc:{" "}
                {new Date(account.rateLimitHourStart).toLocaleTimeString(
                  "vi-VN",
                )}
                )
              </span>
            </div>
            <div className={styles.infoRowReadOnly}>
              <span className={styles.infoLabel}>Đã dùng / ngày:</span>
              <span className={styles.infoValue}>
                {account.actionsUsedThisDay || 0} (Làm mới lúc:{" "}
                {new Date(account.rateLimitDayStart).toLocaleDateString(
                  "vi-VN",
                )}
                )
              </span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        {isCreating ? (
          <button
            className={styles.primaryButton}
            onClick={handleCreateAccount}
          >
            Tạo tài khoản
          </button>
        ) : (
          <>
            <button
              className={styles.deleteButton}
              onClick={() => alert("Chức năng xóa sẽ được phát triển sau.")}
            >
              Xóa tài khoản
            </button>
            <button
              className={styles.primaryButton}
              onClick={() => alert("Chức năng gán user sẽ được bổ sung sau")}
            >
              Gán / Thu hồi User
            </button>
          </>
        )}
      </div>
    </div>
  );
}
