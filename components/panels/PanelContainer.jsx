// app/components/panels/PanelContainer.jsx
"use client";

import { usePanels } from "@/app/contexts/PanelContext";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

// 1. Import các panel cụ thể ở đây
import CustomerDetailPanel from "./CustomerDetailPanel";

// 2. Tạo map để định danh các panel
const panelComponents = {
  customerDetail: CustomerDetailPanel,
};

const PanelContainer = () => {
  const { panels, closePanel } = usePanels();

  return (
    <AnimatePresence>
      {panels.map((panel, index) => {
        // 3. Dựa vào tên (componentId) để lấy đúng Component từ map
        const Component = panelComponents[panel.componentId];

        if (!Component) {
          console.error(
            `Panel component with id "${panel.componentId}" not found.`,
          );
          return null;
        }

        const { props, id } = panel;
        const isLastPanel = index === panels.length - 1;

        return (
          <motion.div
            key={id}
            className="fixed top-0 right-0 h-full w-[95%] max-w-2xl bg-gray-900 shadow-xl z-50 flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: isLastPanel ? 0 : `-${10 + index * 5}%` }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="flex-grow overflow-y-auto">
              {/* 4. Render component đã tìm thấy */}
              <Component {...props} closePanel={closePanel} />
            </div>

            {isLastPanel && (
              <button
                onClick={closePanel}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
                aria-label="Đóng panel"
              >
                <X size={24} />
              </button>
            )}
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
};

export default PanelContainer;
