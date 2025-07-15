// components/(features)/panel/PanelManager.js
"use client";

import React from "react";
import { usePanels } from "@/contexts/PanelContext";
import SidePanel from "./SidePanel";

const PANEL_WIDTH = 500; // Định nghĩa chiều rộng cố định cho mỗi panel

const PanelManager = () => {
  // Lấy thêm hàm closeAllPanels để đóng tất cả khi click ra ngoài
  const { panels, closePanel, closeAllPanels } = usePanels();

  if (panels.length === 0) {
    return null;
  }

  return (
    <>
      {panels.map((panel, index) => {
        const { id, component: PanelComponent, props, title } = panel;
        const rightOffset = (panels.length - 1 - index) * PANEL_WIDTH;

        return (
          <SidePanel
            key={id}
            onClose={() => closePanel(id)}
            title={title}
            rightOffset={rightOffset} // Truyền vị trí vào
          >
            <PanelComponent {...props} />
          </SidePanel>
        );
      })}
    </>
  );
};

export default PanelManager;
