// app/contexts/PanelContext.js
"use client";

import React, { createContext, useContext, useState } from "react";

const PanelContext = createContext();

export const usePanels = () => useContext(PanelContext);

export const PanelProvider = ({ children }) => {
  const [panels, setPanels] = useState([]);

  // Hàm này chỉ lưu TÊN (componentId) và PROPS của panel
  const openPanel = (componentId, props) => {
    const newPanel = {
      id: `${componentId}-${Date.now()}`,
      componentId: componentId,
      props: props,
    };
    setPanels((currentPanels) => [...currentPanels, newPanel]);
  };

  const closePanel = () => {
    setPanels((currentPanels) => currentPanels.slice(0, -1));
  };

  const closeAllPanels = () => {
    setPanels([]);
  };

  const value = {
    panels,
    openPanel,
    closePanel,
    closeAllPanels,
  };

  return (
    <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
  );
};
