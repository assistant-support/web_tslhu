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
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [panelContent, setPanelContent] = useState(null);

  const openPanel = useCallback((content) => {
    console.log("Opening panel with content:", content); // Thêm log để kiểm tra
    setPanelContent(content);
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    // Đợi animation chạy xong mới xóa content
    setTimeout(() => setPanelContent(null), 300);
  }, []);

  const value = {
    isPanelOpen,
    panelContent,
    openPanel,
    closePanel,
  };

  return (
    <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
  );
};
