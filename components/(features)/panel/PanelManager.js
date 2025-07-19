// components/(features)/panel/PanelManager.js
"use client";

import React, { useState, useRef, useEffect } from "react";
import { usePanels } from "@/contexts/PanelContext";
import SidePanel from "./SidePanel";
import styles from "./PanelManager.module.css";

const PANEL_WIDTH = 450;
const MAX_VISIBLE_PANELS = 3;

// --- Component Nút Điều Khiển ---
const PanelControls = ({ autoCollapsed, manualCollapsed }) => {
  // Lấy đúng hàm closeAllPanels từ context
  const { restorePanel, bringToFront, closeAllPanels } = usePanels();
  const [isListVisible, setListVisible] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isListVisible) return;
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setListVisible(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isListVisible]);

  const allCollapsed = [...autoCollapsed, ...manualCollapsed];
  const hasAnyPanels = autoCollapsed.length > 0 || manualCollapsed.length > 0;

  if (!hasAnyPanels) return null;

  return (
    <div className={styles.controlsContainer} ref={containerRef}>
      <div className={styles.controlButton}>
        <div
          className={styles.countSection}
          onClick={() => setListVisible(!isListVisible)}
        >
          {allCollapsed.length > 0
            ? `${allCollapsed.length} panel đang ẩn`
            : "Danh sách ẩn"}
        </div>
        {/* Nút "X" sẽ gọi thẳng hàm closeAllPanels */}
        <div
          className={styles.closeAllIcon}
          onClick={closeAllPanels}
          title="Đóng tất cả"
        >
          &times;
        </div>
      </div>

      {isListVisible && allCollapsed.length > 0 && (
        <div className={styles.collapsedList}>
          {autoCollapsed.map((panel) => (
            <div
              key={panel.id}
              className={styles.collapsedItem}
              onClick={() => bringToFront(panel.id)}
            >
              {panel.title} (tự động)
            </div>
          ))}
          {manualCollapsed.map((panel) => (
            <div
              key={panel.id}
              className={styles.collapsedItem}
              onClick={() => restorePanel(panel.id)}
            >
              {panel.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Component Quản Lý Chính ---
const PanelManager = () => {
  const { panels, collapsed, closePanel, collapsePanel } = usePanels();

  const numToCollapseAuto = Math.max(0, panels.length - MAX_VISIBLE_PANELS);
  const autoCollapsedPanels = panels.slice(0, numToCollapseAuto);
  const visiblePanels = panels.slice(numToCollapseAuto);

  return (
    <>
      <PanelControls
        autoCollapsed={autoCollapsedPanels}
        manualCollapsed={collapsed}
      />
      {visiblePanels.map((panel, index) => {
        const { id, component: PanelComponent, props, title } = panel;
        const rightOffset = (visiblePanels.length - 1 - index) * PANEL_WIDTH;
        return (
          <SidePanel
            key={id}
            onClose={() => closePanel(id)}
            onCollapse={() => collapsePanel(id)}
            title={title}
            rightOffset={rightOffset}
          >
            <PanelComponent {...props} />
          </SidePanel>
        );
      })}
    </>
  );
};

export default PanelManager;
