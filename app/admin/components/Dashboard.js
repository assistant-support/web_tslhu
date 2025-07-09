"use client";

import React from "react";
import styles from "../admin.module.css"; // Sử dụng chung file CSS với trang cha

export default function Dashboard() {
  return (
    <div>
      <h2>Dashboard Tổng quan</h2>
      <p>
        Đây là nơi hiển thị các biểu đồ, thống kê nhanh về hiệu suất làm việc
        của nhân viên, số lượng khách hàng, v.v...
      </p>
      <div className={styles.dashboardWidgets}>
        <div className={styles.widget}>
          <h4>Tổng số khách hàng</h4>
          <p className={styles.widgetValue}>1,234</p>
        </div>
        <div className={styles.widget}>
          <h4>Nhân viên hoạt động</h4>
          <p className={styles.widgetValue}>12</p>
        </div>
        <div className={styles.widget}>
          <h4>Tỷ lệ chuyển đổi</h4>
          <p className={styles.widgetValue}>15.7%</p>
        </div>
      </div>
    </div>
  );
}
