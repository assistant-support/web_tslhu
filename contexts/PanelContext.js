// File: contexts/PanelContext.js

"use client";

import React, { createContext, useState, useContext, useCallback } from "react";

const PanelContext = createContext(null);

export const usePanels = () => {
  const context = useContext(PanelContext);
  if (context === null) {
    throw new Error(
      "Lỗi lập trình: usePanels() phải được dùng bên trong <PanelProvider>",
    );
  }
  return context;
};

export const PanelProvider = ({ children }) => {
  // State chính: một mảng chứa thông tin các panel đang mở
  const [panels, setPanels] = useState([]);

  // Hàm để MỞ một panel mới
  const openPanel = useCallback((panelConfig) => {
    // panelConfig là một object, vd: { id: 'details-123', component: CustomerDetails, props: {...} }
    setPanels((prev) => {
      // Tránh mở trùng panel có cùng ID
      if (prev.some((p) => p.id === panelConfig.id)) {
        return prev;
      }
      return [...prev, panelConfig];
    });
  }, []);

  // Hàm để ĐÓNG một panel cụ thể
  const closePanel = useCallback((panelId) => {
    setPanels((prev) => prev.filter((p) => p.id !== panelId));
  }, []);

  // Hàm để ĐÓNG TẤT CẢ panel
  const closeAllPanels = useCallback(() => {
    setPanels([]);
  }, []);

  const value = { panels, openPanel, closePanel, closeAllPanels };

  return (
    <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
  );
};
