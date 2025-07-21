// app/client/ui/setting/index.js
"use client";

import React, { useState, useCallback, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Svg_Setting } from "@/components/(icon)/svg";
import styles from "./index.module.css";
import { usePanels } from "@/contexts/PanelContext"; // Import hook panel chung
import { setActiveZalo } from "@/app/actions/zaloActions"; // Import action mới
import Noti from "@/components/(features)/(noti)/noti";
import Loading from "@/components/(ui)/(loading)/loading";

// --- COMPONENT CON: NỘI DUNG PANEL QUẢN LÝ TÀI KHOẢN ---
const AccountManagerPanel = ({ user }) => {
  const router = useRouter();
  const [isSubmitting, startTransition] = useTransition();
  const [notification, setNotification] = useState({
    open: false,
    status: true,
    mes: "",
  });

  const allZaloAccounts = useMemo(() => user?.zaloAccounts || [], [user]);
  const activeZaloId = useMemo(() => user?.zalo?._id || null, [user]);

  const handleAccountSelection = (accountId) => {
    startTransition(async () => {
      const result = await setActiveZalo(accountId);
      if (result.success) {
        setNotification({ open: true, status: true, mes: result.message });
        router.refresh();
      } else {
        setNotification({ open: true, status: false, mes: result.error });
      }
    });
  };

  const selectedAccount = allZaloAccounts.find(
    (acc) => acc._id === activeZaloId,
  );
  const availableAccounts = allZaloAccounts.filter(
    (acc) => acc._id !== activeZaloId,
  );

  return (
    <div className={styles.account_list_container}>
      <div className={styles.current_selection_section}>
        <h4 className={styles.section_title}>Tài khoản đang sử dụng</h4>
        {selectedAccount ? (
          <div className={`${styles.account_item} ${styles.selected_item}`}>
            <img
              src={selectedAccount.avt}
              alt={selectedAccount.name}
              className={styles.account_avatar}
            />
            <div className={styles.account_info}>
              <span className={styles.account_name}>
                {selectedAccount.name}
              </span>
            </div>
            <button
              onClick={() => handleAccountSelection(null)}
              className={styles.deselect_btn}
              disabled={isSubmitting}
            >
              Bỏ chọn
            </button>
          </div>
        ) : (
          <div className={styles.no_account_selected}>
            <p>Chưa chọn tài khoản nào</p>
          </div>
        )}
      </div>

      {availableAccounts.length > 0 && (
        <div className={styles.available_list_section}>
          <h4 className={styles.section_title}>Chọn từ các tài khoản khác</h4>
          <div className={styles.account_list}>
            {availableAccounts.map((acc) => (
              <div
                key={acc._id}
                className={`${styles.account_item} ${styles.clickable}`}
                onClick={() => handleAccountSelection(acc._id)}
              >
                <img
                  src={acc.avt}
                  alt={acc.name}
                  className={styles.account_avatar}
                />
                <div className={styles.account_info}>
                  <span className={styles.account_name}>{acc.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <Noti
        open={notification.open}
        onClose={() => setNotification({ ...notification, open: false })}
        status={notification.status}
        mes={notification.mes}
      />
    </div>
  );
};

// --- COMPONENT CON: NỘI DUNG PANEL CÀI ĐẶT CHÍNH ---
const SettingsPanel = ({ user }) => {
  const { openPanel } = usePanels();

  const handleOpenAccountManager = () => {
    openPanel({
      id: "account-manager",
      title: "Quản lý tài khoản Zalo",
      component: AccountManagerPanel,
      props: { user },
    });
  };

  const mainDisplayAccountName = useMemo(
    () => user?.zalo?.name || "Chưa chọn",
    [user],
  );

  return (
    <div style={{ padding: "8px" }}>
      <div
        className={`${styles.popup_t} ${styles.clickable}`}
        onClick={handleOpenAccountManager}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Svg_Setting w={16} h={16} c="var(--main_d)" />
          <p className="text_6" style={{ color: "var(--main_d)" }}>
            Tài khoản
          </p>
        </div>
        <p className="text_6_400">{mainDisplayAccountName}</p>
      </div>
      {/* Thêm các mục cài đặt khác ở đây nếu cần */}
    </div>
  );
};

// --- COMPONENT CHÍNH (BUTTON KÍCH HOẠT) ---
export default function Setting({ user }) {
  const { openPanel } = usePanels();

  const handleOpenSettings = () => {
    openPanel({
      id: "main-settings",
      title: "Cài đặt & Cấu hình",
      component: SettingsPanel,
      props: { user },
    });
  };

  return (
    <div
      className="input"
      style={{
        cursor: "pointer",
        gap: 8,
        alignItems: "center",
        display: "flex",
        flex: 1,
        borderRadius: "0 5px 5px 0",
        background: "#e2e8f0",
      }}
      onClick={handleOpenSettings}
    >
      <Svg_Setting w={16} h={16} c={"var(--main_b)"} />
      <p className="text_6_400">Cấu hình</p>
    </div>
  );
}
