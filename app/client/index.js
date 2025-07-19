// app/client/index.js
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import styles from "./index.module.css";

import Setting from "./ui/setting";
import Loading from "@/components/(ui)/(loading)/loading";
import PanelManager from "@/components/(features)/panel/PanelManager";
import { usePanels } from "@/contexts/PanelContext";
import CustomerDetails from "./ui/details/CustomerDetails";
import Schedule from "./ui/schedule";
import { CampaignProvider } from "@/contexts/CampaignContext";

const useSelection = (items = []) => {
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const toggleOne = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allItemIds = new Set(items.map((item) => item._id));
      if (prev.size === allItemIds.size) {
        return new Set();
      } else {
        return allItemIds;
      }
    });
  }, [items]);

  return { selectedIds, toggleOne, toggleAll, setSelectedIds };
};

const Row = ({ row, rowIndex, onRowClick, isActive, onToggle, isSelected }) => (
  <div
    className={`${styles.gridRow} ${isActive ? styles.activeRow : ""}`}
    onClick={() => onRowClick(row)}
  >
    <div style={{ display: "flex", flex: 5, alignItems: "center" }}>
      <div className={styles.gridCell} onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className={styles.rowCheckbox}
          checked={isSelected}
          onChange={() => onToggle(row._id)}
        />
      </div>
      <div className={`${styles.gridCell} ${styles.colSmall}`}>
        {rowIndex + 1}
      </div>
      <div className={styles.gridCell}>{row.phone}</div>
      <div className={styles.gridCell} style={{ flex: 1.5 }}>
        {row.name}
      </div>
      <div className={styles.gridCell}>{row.status?.name || "-"}</div>
    </div>
    <div
      className={`${styles.gridCell}`}
      style={{ flex: 1, justifyContent: "center" }}
    >
      <span
        className={styles.lookupStatus}
        data-status={row.admissionData?.TinhTrang}
      >
        {row.admissionData?.TinhTrang || "Chưa tra cứu"}
      </span>
    </div>
  </div>
);

function ClientPage({
  initialData,
  initialPagination,
  initialLabels,
  initialStatuses,
  user,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openPanel, panels, updatePanelProps } = usePanels();

  const [clients, setClients] = useState(initialData || []);
  const [pagination, setPagination] = useState(
    initialPagination || { hasMore: false },
  );
  const [isLoading, setIsLoading] = useState(false);

  const { selectedIds, toggleOne, toggleAll, setSelectedIds } =
    useSelection(clients);
  const selectedClients = useMemo(
    () => clients.filter((c) => selectedIds.has(c._id)),
    [clients, selectedIds],
  );
  const areAllVisibleSelected = useMemo(
    () => clients.length > 0 && selectedIds.size === clients.length,
    [clients, selectedIds],
  );

  const query = searchParams.get("query") || "";
  const status = searchParams.get("status") || "";

  useEffect(() => {
    setClients(initialData || []);
    setPagination(initialPagination || { hasMore: false });
    setSelectedIds(new Set());
  }, [initialData, initialPagination, setSelectedIds]);

  const handleLoadMore = useCallback(async () => {
    setIsLoading(true);
    try {
      const skip = clients.length;
      const currentParams = new URLSearchParams(searchParams.toString());
      currentParams.set("limit", "10");
      currentParams.set("skip", skip.toString());

      const response = await fetch(`/api/clients?${currentParams.toString()}`);
      if (!response.ok) throw new Error("Tải thêm dữ liệu thất bại.");

      const newData = await response.json();
      setClients((prev) => [...prev, ...newData.data]);
      setPagination(newData.pagination);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [clients.length, searchParams]);

  const handleFilterChange = (key, value) => {
    const currentParams = new URLSearchParams(searchParams.toString());
    if (value) {
      currentParams.set(key, value);
    } else {
      currentParams.delete(key);
    }
    router.push(`${pathname}?${currentParams.toString()}`);
  };

  const handleCustomerUpdate = (updatedCustomerData) => {
    setClients((currentClients) => {
      return currentClients.map((client) => {
        if (client._id === updatedCustomerData._id) {
          return { ...client, ...updatedCustomerData };
        }
        return client;
      });
    });

    updatePanelProps(`details-${updatedCustomerData._id}`, {
      customerData: updatedCustomerData,
    });
  };

  const handleRowClick = useCallback(
    (customer) => {
      openPanel({
        id: `details-${customer._id}`,
        component: CustomerDetails,
        title: `Chi tiết: ${customer.name}`,
        props: {
          customerData: customer,
          statuses: initialStatuses,
          onUpdateCustomer: handleCustomerUpdate,
          user: user,
          initialLabels: initialLabels,
        },
      });
    },
    [openPanel, initialStatuses, user, initialLabels, handleCustomerUpdate],
  );

  const handleOpenBulkSchedule = useCallback(() => {
    if (selectedClients.length === 0) {
      alert("Vui lòng chọn ít nhất một khách hàng.");
      return;
    }
    openPanel({
      id: `bulk-action-${Date.now()}`,
      component: Schedule,
      title: `Lên lịch cho ${selectedClients.length} người`,
      props: {
        initialData: selectedClients,
        user: user,
        label: initialLabels,
      },
    });
  }, [openPanel, selectedClients, user, initialLabels]);

  const activeRowIds = useMemo(() => {
    const ids = new Set();
    panels.forEach((panel) => {
      if (panel.id.startsWith("details-")) {
        ids.add(panel.id.replace("details-", ""));
      }
    });
    return ids;
  }, [panels]);

  return (
    <div className={styles.container}>
      <div className={styles.topActionsContainer}>
        <div className={styles.accountSelector}>
          <p className="text_6">Tài khoản Zalo:</p>
          <Setting user={user} />
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={handleOpenBulkSchedule}
            className={styles.bulkActionButton}
          >
            Hành động hàng loạt ({selectedIds.size})
          </button>
        )}
      </div>

      <div className={styles.filterContainer}>
        <input
          type="text"
          placeholder="Tìm theo tên hoặc SĐT..."
          className={styles.filterInput}
          defaultValue={query}
          onChange={(e) => handleFilterChange("query", e.target.value)}
        />
        <select
          className={styles.filterSelect}
          value={status}
          onChange={(e) => handleFilterChange("status", e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {initialStatuses.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.dataGrid}>
        <div className={styles.gridHeader}>
          <div style={{ display: "flex", flex: 5, alignItems: "center" }}>
            <div className={styles.gridCell}>
              <input
                type="checkbox"
                className={styles.rowCheckbox}
                checked={areAllVisibleSelected}
                onChange={toggleAll}
              />
            </div>
            <div className={`${styles.gridCell} ${styles.colSmall}`}>STT</div>
            <div className={styles.gridCell}>Di động</div>
            <div className={styles.gridCell} style={{ flex: 1.5 }}>
              Tên
            </div>
            <div className={styles.gridCell}>Trạng thái</div>
            <div
              className={styles.gridCell}
              style={{ flex: 1, justifyContent: "center" }}
            >
              Cập nhật
            </div>
          </div>
        </div>
        <div className={styles.gridBody}>
          {clients.map((client, idx) => (
            <Row
              key={client._id || idx}
              row={client}
              rowIndex={idx}
              onRowClick={handleRowClick}
              isActive={activeRowIds.has(client._id)}
              onToggle={toggleOne}
              isSelected={selectedIds.has(client._id)}
            />
          ))}
        </div>
      </div>

      {pagination.hasMore && (
        <div className={styles.loadMoreContainer}>
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            className={styles.loadMoreButton}
          >
            {isLoading ? "Đang tải..." : "Tải thêm"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Client(props) {
  return (
    <CampaignProvider>
      <PanelProvider>
        <ClientPage {...props} />
        <PanelManager />
      </PanelProvider>
    </CampaignProvider>
  );
}
