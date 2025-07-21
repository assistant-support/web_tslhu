"use client";

import React, {
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useEffect,
} from "react";
import FlexiblePopup from "@/components/(features)/(popup)/popup_right";
import { Data_History_User } from "@/data/customer"; // Đảm bảo đường dẫn đúng

// Component nhỏ, an toàn để hiển thị ngày giờ
const ClientSideTime = ({ date }) => {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  if (!isMounted || !date) return "...";
  return new Date(date).toLocaleString("vi-VN");
};

const HistoryList = ({ histories, userPhone }) => {
  if (!histories) return <div>Đang tải lịch sử...</div>;
  if (histories.length === 0) return <div>Chưa có lịch sử chăm sóc.</div>;

  return (
    <ul style={{ listStyle: "none", padding: "0 10px" }}>
      {histories.map((h) => {
        const recipientData = h.recipients.find((r) => r.phone === userPhone);
        if (!recipientData) return null;
        const isSuccess = recipientData.status === "success";
        return (
          <li
            key={h._id}
            style={{ borderBottom: "1px solid #f0f0f0", padding: "10px 0" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
              }}
            >
              <span>{h.jobName || "Hành động trực tiếp"}</span>
              <span style={{ color: isSuccess ? "green" : "red" }}>
                {isSuccess ? "Thành công" : "Thất bại"}
              </span>
            </div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
              <ClientSideTime date={recipientData.processedAt} />
            </div>
            <p style={{ fontSize: "13px", margin: "8px 0 0", color: "#333" }}>
              {recipientData.details || "Không có chi tiết."}
            </p>
          </li>
        );
      })}
    </ul>
  );
};

const HistoryPopup = forwardRef(function HistoryPopup(props, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [histories, setHistories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = useCallback(async (phone) => {
    if (!phone) return;
    setIsLoading(true);
    try {
      const response = await Data_History_User(phone);
      setHistories(response?.data || []);
    } catch (error) {
      console.error("Lỗi khi tải lịch sử:", error);
      setHistories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    showFor: (customerData) => {
      setCustomer(customerData);
      fetchHistory(customerData.phone);
      setIsOpen(true);
    },
  }));

  const handleClose = () => {
    setIsOpen(false);
    // Reset state sau khi đóng để lần sau mở ra không bị dữ liệu cũ
    setTimeout(() => {
      setCustomer(null);
      setHistories([]);
    }, 300); // Chờ animation kết thúc
  };

  return (
    <FlexiblePopup
      open={isOpen}
      onClose={handleClose}
      title={`Lịch sử chăm sóc: ${customer?.name || ""}`}
      renderItemList={() =>
        isLoading ? (
          <div>Đang tải...</div>
        ) : (
          <HistoryList histories={histories} userPhone={customer?.phone} />
        )
      }
    />
  );
});

export default HistoryPopup;
