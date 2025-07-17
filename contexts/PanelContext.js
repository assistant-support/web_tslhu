// contexts/PanelContext.js
"use client";

import React, { createContext, useState, useContext, useCallback } from "react";

const PanelContext = createContext(null);

export const usePanels = () => {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error(
      "Lỗi: usePanels() phải được dùng bên trong <PanelProvider>",
    );
  }
  return context;
};

export const PanelProvider = ({ children }) => {
  const [panels, setPanels] = useState([]);
  const [collapsed, setCollapsed] = useState([]);

  const openPanel = useCallback((panelConfig) => {
    setPanels((prev) => {
      const existing = prev.find((p) => p.id === panelConfig.id);
      if (existing) {
        const others = prev.filter((p) => p.id !== panelConfig.id);
        return [...others, existing];
      }
      return [...prev, panelConfig];
    });
    setCollapsed((prev) => prev.filter((p) => p.id !== panelConfig.id));
  }, []);

  const closePanel = useCallback((panelId) => {
    setPanels((prev) => prev.filter((p) => p.id !== panelId));
    setCollapsed((prev) => prev.filter((p) => p.id !== panelId));
  }, []);

  const collapsePanel = useCallback(
    (panelId) => {
      const panelToCollapse = panels.find((p) => p.id === panelId);
      if (panelToCollapse && !collapsed.some((p) => p.id === panelId)) {
        setCollapsed((prev) => [...prev, panelToCollapse]);
      }
      setPanels((prev) => prev.filter((p) => p.id !== panelId));
    },
    [panels, collapsed],
  );

  const restorePanel = useCallback(
    (panelId) => {
      const panelToRestore = collapsed.find((p) => p.id === panelId);
      if (panelToRestore) {
        setPanels((prev) => [...prev, panelToRestore]);
        setCollapsed((prev) => prev.filter((p) => p.id !== panelId));
      }
    },
    [collapsed],
  );

  const bringToFront = useCallback((panelId) => {
    setPanels((prev) => {
      const panelToMove = prev.find((p) => p.id === panelId);
      if (!panelToMove) return prev;
      const otherPanels = prev.filter((p) => p.id !== panelId);
      return [...otherPanels, panelToMove];
    });
  }, []);

  // HÀM QUAN TRỌNG ĐỂ ĐÓNG TẤT CẢ
  const closeAllPanels = useCallback(() => {
    setPanels([]);
    setCollapsed([]);
  }, []);

  const value = {
    panels,
    collapsed,
    openPanel,
    closePanel,
    collapsePanel,
    restorePanel,
    bringToFront,
    closeAllPanels,
  };

  return (
    <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
  );
};
