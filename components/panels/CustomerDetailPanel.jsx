// app/components/panels/CustomerDetailPanel.jsx
"use client";

import React, { useState, useEffect } from "react";
// Sửa đường dẫn import CSS
import styles from "./CustomerDetailPanel.module.css";
import Loading from "@/components/(ui)/(loading)/loading";
import { usePanels } from "@/app/contexts/PanelContext";

export default function CustomerDetailPanel({ customerId, user }) {
  const [customer, setCustomer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Lấy hàm openPanel từ context để mở các panel con sau này
  const { openPanel } = usePanels();

  useEffect(() => {
    if (!customerId) return;

    const fetchCustomerData = async () => {
      setIsLoading(true);
      setError(null);
      const apiUrl = new URL(`/api/client/test`, window.location.origin);

      // 2. In ra console để kiểm tra xem URL có đúng là http://localhost:3000/... không
      console.log("Đang gọi đến API:", apiUrl.href);

      try {
        const response = await fetch(`/api/client/detail?id=${customerId}`);
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(
            errData.message || "Failed to fetch customer details",
          );
        }
        const result = await response.json();
        setCustomer(result.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomerData();
  }, [customerId]);

  const handleOpenCareHistory = () => {
    // Ví dụ về cách mở panel con, chúng ta sẽ làm ở bước sau
    // openPanel('careHistory', { customerId: customerId });
    alert("Chức năng 'Xem lịch sử' sẽ được làm ở bước sau!");
  };

  const handleOpenQuickCampaign = () => {
    // openPanel('quickCampaign', { customer: customer, user: user });
    alert("Chức năng 'Lên chiến dịch nhanh' sẽ được làm ở bước sau!");
  };

  const handleOpenEdit = () => {
    // openPanel('editCustomer', { customer: customer });
    alert("Chức năng 'Chỉnh sửa' sẽ được làm ở bước sau!");
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <p>Lỗi: {error}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Chi tiết Khách hàng</h2>
        <p className={styles.customerName}>{customer?.name}</p>
      </div>

      <div className={styles.content}>
        <p>ID Khách hàng: {customerId}</p>
        <p>Số điện thoại: {customer?.phone}</p>
        <p>Trạng thái: {customer?.status?.name || "Chưa có"}</p>
        {/* Từ status_id?.name thành status?.name */}
        <p>Người phụ trách: {customer?.auth?.[0]?.name || "Chưa có"}</p>
      </div>

      <div className={styles.actions}>
        <button onClick={handleOpenCareHistory} className={styles.actionButton}>
          Xem lịch sử chăm sóc
        </button>
        <button
          onClick={handleOpenQuickCampaign}
          className={styles.actionButton}
        >
          Lên chiến dịch nhanh
        </button>
        <button onClick={handleOpenEdit} className={styles.actionButton}>
          Chỉnh sửa thông tin
        </button>
      </div>
    </div>
  );
}
