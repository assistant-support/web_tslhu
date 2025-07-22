"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./index.module.css";
import Setting from "./ui/setting";
import HistoryPopup from "./ui/his";
import { PanelProvider, usePanels } from "@/contexts/PanelContext";
import CustomerDetails from "./ui/details/CustomerDetails"; // Import nội dung chi tiết khách hàng
import StageIndicator from "@/components/(ui)/progress/StageIndicator";
import Loading from "@/components/(ui)/(loading)/loading";
import PanelManager from "@/components/(features)/panel/PanelManager";
import dynamic from "next/dynamic";

const CollapseIcon = ({ isCollapsed }) => (
  <svg
    className={styles.collapseIcon}
    style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 9L12 15L18 9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Schedule = dynamic(() => import("./ui/schedule"), {
  ssr: false,
  loading: () => <p>Đang tải trình lên lịch...</p>,
});

const useSelection = () => {
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const toggleOne = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  return { selectedIds, toggleOne, setSelectedIds, size: selectedIds.size };
};

const Row = React.memo(function Row({
  row,
  rowIndex,
  onToggle,
  checked,
  onRowClick,
  isUpdated,
  isActive,
}) {
  const getLookupStatusType = (tinhTrang) => {
    if (tinhTrang === "Không có thông tin" || tinhTrang === "Lỗi tra cứu")
      return "error";
    if (tinhTrang === "Thiếu thông tin") return "warning";
    if (tinhTrang === "Đủ đúng không xét tuyển") return "success";
    if (tinhTrang) return "found";
    return "not-found";
  };

  return (
    <div
      className={`${styles.gridRow} ${isUpdated ? styles.rowUpdated : ""} ${
        isActive ? styles.activeRow : ""
      }`}
      style={{ backgroundColor: row.remove ? "#ffd9dd" : "white" }}
      onClick={() => onRowClick(row)}
    >
      <div style={{ display: "flex", flex: 5 }}>
        <div
          className={styles.gridCell}
          style={{ justifyContent: "center", flex: "0 0 40px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className={styles.bigCheckbox}
            checked={checked}
            onChange={() => onToggle(row)}
          />
        </div>
        <div
          className={`${styles.gridCell} text_6_400`}
          style={{
            justifyContent: "center",
            flex: "0 0 50px",
            fontWeight: 600,
          }}
        >
          {rowIndex + 1}
        </div>
        <div
          className={`${styles.gridCell} text_6_400`}
          style={{ justifyContent: "center", flex: 1 }}
        >
          {row.phone}
        </div>
        <div className={`${styles.gridCell} text_6_400`} style={{ flex: 1.5 }}>
          {row.name}
        </div>
        <div
          className={`${styles.gridCell} text_6_400`}
          style={{ justifyContent: "center", flex: 0.5 }}
        >
          <StageIndicator level={row.stageLevel} />
        </div>
        <div
          className={`${styles.gridCell} text_6_400`}
          style={{ justifyContent: "center", flex: 1, overflow: "hidden" }}
        >
          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={row.status?.name}
          >
            {row.status?.name || "-"}
          </span>
        </div>
        <div
          className={`${styles.gridCell} text_6_400`}
          style={{ justifyContent: "center", flex: 0.7 }}
        >
          {row.action && row.action.length > 0 ? row.action[0].actionType : "-"}
        </div>
        <div
          className={`${styles.gridCell} text_7_400`}
          style={{ justifyContent: "center", flex: 0.5 }}
        >
          <p
            style={{
              padding: "3px 12px",
              color: "white",
              fontSize: 12,
              borderRadius: 12,
              background:
                row.uid === "Lỗi tìm kiếm"
                  ? "var(--yellow)"
                  : row.uid
                  ? "var(--green)"
                  : "var(--red)",
            }}
          >
            {row.uid === "Lỗi tìm kiếm"
              ? "Lỗi"
              : row.uid
              ? "Đã có"
              : "Chưa tìm"}
          </p>
        </div>
      </div>
      <div
        className={`${styles.gridCell} text_6_400`}
        style={{ flex: 1, padding: "0 16px", justifyContent: "center" }}
      >
        <span
          className={styles.lookupStatus}
          data-status={getLookupStatusType(row.TinhTrang)}
        >
          {row.TinhTrang || "Chưa tra cứu"}
        </span>
      </div>
    </div>
  );
});

// START: THAY THẾ TOÀN BỘ COMPONENT `ClientPage`
function ClientPage({
  initialData,
  initialPagination,
  initialLabels,
  initialStatuses,
  user,
}) {
  // --- STATES & REFS ---
  const { openPanel, panels, updatePanelProps } = usePanels();
  const [customers, setCustomers] = useState(initialData);
  const [updatedIds, setUpdatedIds] = useState(new Set());
  const prevCustomersRef = useRef(new Map());
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isOverallLoading, setIsOverallLoading] = useState(false);
  const {
    selectedIds,
    toggleOne,
    setSelectedIds,
    size: selectedCount,
  } = useSelection();
  const [selectedCustomerMap, setSelectedCustomerMap] = useState(new Map());
  const [viewMode, setViewMode] = useState("all");
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const historyRef = useRef(null);

  // Yêu cầu 2.2: State cho ô nhập số trang
  const [pageInput, setPageInput] = useState(initialPagination?.page || 1);
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  const startIndex = (initialPagination.page - 1) * initialPagination.limit;

  const enrichSingleCustomer = async (customerToEnrich) => {
    try {
      const res = await fetch(
        "https://tapi.lhu.edu.vn/TS/AUTH/XetTuyen_TraCuu",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: customerToEnrich.phone }),
        },
      );
      if (!res.ok) return { ...customerToEnrich, TinhTrang: "Lỗi tra cứu" };
      const raw = await res.json();
      const data = (Array.isArray(raw) ? raw[0] : raw?.data?.[0]) || {
        TinhTrang: "Không có thông tin",
      };

      // Trả về khách hàng đã được bổ sung thông tin tra cứu
      return { ...customerToEnrich, ...data };
    } catch {
      return { ...customerToEnrich, TinhTrang: "Lỗi kết nối" };
    }
  };

  // --- MEMOS & DERIVED STATES ---
  const serverPage = initialPagination?.page || 1;
  const serverTotalPages = initialPagination?.totalPages || 1;
  const scheduleData = useMemo(
    () => [...selectedCustomerMap.values()],
    [selectedCustomerMap],
  );
  const accountDisplayName = user?.zaloActive?.name || "Chưa chọn TK";
  const allOnPageChecked = useMemo(
    () =>
      initialData.length > 0 &&
      initialData.every((r) => selectedIds.has(r._id)),
    [initialData, selectedIds],
  );
  const activeRowIds = useMemo(() => {
    const ids = new Set();
    panels.forEach((panel) => {
      if (panel.id.startsWith("details-")) {
        ids.add(panel.id.replace("details-", ""));
      }
    });
    return ids;
  }, [panels]);

  // --- HANDLERS & CALLBACKS ---
  const handleNavigation = useCallback(
    (name, value) => {
      setIsOverallLoading(true);
      const params = new URLSearchParams(searchParams);
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      if (name !== "page") {
        params.set("page", "1");
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams],
  );

  // Yêu cầu 2.2: Logic cho việc chuyển trang nhanh
  const handleGoToPage = (e) => {
    if (e.key === "Enter") {
      const pageNum = parseInt(pageInput, 10);
      if (pageNum >= 1 && pageNum <= serverTotalPages) {
        handleNavigation("page", pageNum.toString());
      } else {
        // Optional: Hiển thị thông báo lỗi nếu trang không hợp lệ
        alert(
          `Trang không hợp lệ. Vui lòng nhập số từ 1 đến ${serverTotalPages}.`,
        );
        setPageInput(serverPage); // Reset về trang hiện tại
      }
    }
  };

  const handleRefresh = useCallback(
    () => startTransition(() => router.refresh()),
    [router],
  );

  const toggleRowAndStoreData = useCallback(
    (row) => {
      setSelectedCustomerMap((prev) => {
        const m = new Map(prev);
        m.has(row._id) ? m.delete(row._id) : m.set(row._id, row);
        return m;
      });
      toggleOne(row._id);
    },
    [toggleOne],
  );

  const handleTogglePageAndStoreData = useCallback(() => {
    const isCheckingAll = !allOnPageChecked;
    setSelectedCustomerMap((prev) => {
      const m = new Map(prev);
      initialData.forEach((row) => {
        if (isCheckingAll) {
          m.set(row._id, row);
        } else {
          m.delete(row._id);
        }
      });
      return m;
    });

    setSelectedIds((prev) => {
      const next = new Set(prev);
      initialData.forEach((row) => {
        if (isCheckingAll) {
          next.add(row._id);
        } else {
          next.delete(row._id);
        }
      });
      return next;
    });
  }, [initialData, allOnPageChecked, setSelectedIds]);

  const handleOpenBulkSchedule = useCallback(() => {
    if (scheduleData.length === 0) {
      alert("Vui lòng chọn ít nhất một khách hàng.");
      return;
    }
    openPanel({
      id: `bulk-action-${Date.now()}`,
      component: Schedule,
      title: `Lên lịch cho ${scheduleData.length} người`,
      props: {
        initialData: scheduleData,
        recipientsMap: selectedCustomerMap,
        onRecipientToggle: toggleRowAndStoreData,
        user: user,
        label: initialLabels,
      },
    });
  }, [
    openPanel,
    scheduleData,
    user,
    initialLabels,
    selectedCustomerMap,
    toggleRowAndStoreData,
  ]);

  const handleRowClick = useCallback(
    (customer) => {
      // Hàm này là "bộ não" xử lý MỌI cập nhật từ panel chi tiết.
      // Dù là sửa tên, đổi trạng thái hay thêm bình luận, tất cả đều đi qua đây.
      const handleUpdateAndReEnrich = async (updatedCustomerFromServer) => {
        const customerId = updatedCustomerFromServer._id;
        const panelId = `details-${customerId}`;

        // BƯỚC 1: CẬP NHẬT GIAO DIỆN TẠM THỜI
        // Hiển thị trạng thái "Đang tra cứu..." ngay lập tức để người dùng biết hệ thống đang xử lý.
        // Dữ liệu cơ bản (như tên mới, comment mới) cũng được cập nhật ngay ở bước này.
        setCustomers((current) =>
          current.map((c) =>
            c._id === customerId
              ? {
                  ...c,
                  ...updatedCustomerFromServer,
                  TinhTrang: "Đang tra cứu...",
                }
              : c,
          ),
        );

        // BƯỚC 2: LẤY DỮ LIỆU ĐẦY ĐỦ
        // Tra cứu lại thông tin từ API bên ngoài để đảm bảo dữ liệu luôn mới nhất.
        const fullyEnrichedCustomer = await enrichSingleCustomer(
          updatedCustomerFromServer,
        );

        // BƯỚC 3: CẬP NHẬT DỮ LIỆU CUỐI CÙNG VÀ KÍCH HOẠT HIỆU ỨNG
        // Cập nhật lại danh sách với dữ liệu đầy đủ VÀ kích hoạt hiệu ứng highlight.
        setUpdatedIds((prev) => new Set(prev).add(customerId));
        setCustomers((current) =>
          current.map((c) =>
            c._id === customerId ? fullyEnrichedCustomer : c,
          ),
        );

        // Cập nhật prop cho panel đang mở để nó cũng được re-render với dữ liệu mới nhất.
        updatePanelProps(panelId, { customerData: fullyEnrichedCustomer });

        // BƯỚC 4: TẮT HIỆU ỨNG SAU 2 GIÂY
        setTimeout(() => {
          setUpdatedIds((prev) => {
            const next = new Set(prev);
            next.delete(customerId);
            return next;
          });
        }, 2000);
      };

      openPanel({
        id: `details-${customer._id}`,
        component: CustomerDetails,
        title: `Chi tiết: ${customer.name}`,
        props: {
          customerData: customer,
          onUpdateCustomer: handleUpdateAndReEnrich, // Truyền hàm xử lý duy nhất này
          //... các props khác không đổi
          statuses: initialStatuses,
          user: user,
          initialLabels: initialLabels,
          onRecipientToggle: toggleRowAndStoreData,
        },
      });
    },
    [
      // Dependencies không đổi
      openPanel,
      initialStatuses,
      user,
      initialLabels,
      toggleRowAndStoreData,
      enrichSingleCustomer,
      updatePanelProps,
    ],
  );
  const handleLimitChange = (e) => {
    // Chỉ hoạt động khi người dùng nhấn phím "Enter"
    if (e.key === "Enter") {
      const newLimit = parseInt(e.target.value, 10);

      // Kiểm tra nếu giá trị hợp lệ (lớn hơn 0)
      if (newLimit > 0) {
        // Gọi hàm điều hướng đã có để tải lại trang với limit mới
        handleNavigation("limit", newLimit.toString());
      } else {
        // Nếu người dùng nhập số không hợp lệ, trả về giá trị cũ
        e.target.value = initialPagination.limit;
      }
    }
  };

  // --- EFFECTS ---
  // Effect tìm kiếm
  useEffect(() => {
    const handler = setTimeout(() => {
      if (query !== (searchParams.get("query") || "")) {
        handleNavigation("query", query);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [query, searchParams, handleNavigation]);

  // Effect làm giàu và cập nhật dữ liệu
  useEffect(() => {
    const areObjectsDifferent = (objA, objB) =>
      JSON.stringify(objA) !== JSON.stringify(objB);
    let cancelled = false;

    const processData = async (dataToProcess) => {
      // Làm giàu dữ liệu
      const customersToFetch = dataToProcess.filter(
        (c) => c.phone && c.TinhTrang === undefined,
      );
      let finalEnrichedData = [...dataToProcess];

      if (customersToFetch.length > 0) {
        const fetchPromises = customersToFetch.map(async (customer) => {
          try {
            const res = await fetch(
              "https://tapi.lhu.edu.vn/TS/AUTH/XetTuyen_TraCuu",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: customer.phone }),
              },
            );
            if (!res.ok) return { ...customer, TinhTrang: "Lỗi tra cứu" };
            const raw = await res.json();
            const data = (Array.isArray(raw) ? raw[0] : raw?.data?.[0]) || {
              TinhTrang: "Không có thông tin",
            };
            return { ...customer, ...data };
          } catch {
            return { ...customer, TinhTrang: "Lỗi kết nối" };
          }
        });
        const newlyEnriched = await Promise.all(fetchPromises);
        const enrichedMap = new Map(newlyEnriched.map((c) => [c._id, c]));
        finalEnrichedData = dataToProcess.map(
          (c) => enrichedMap.get(c._id) || c,
        );
      }

      if (cancelled) return;

      // So sánh và highlight
      const newUpdatedIds = new Set();
      const prevDataMap = prevCustomersRef.current;
      finalEnrichedData.forEach((current) => {
        const prev = prevDataMap.get(current._id);
        if (prev && areObjectsDifferent(prev, current)) {
          newUpdatedIds.add(current._id);
        }
      });

      // Cập nhật state
      setCustomers(finalEnrichedData);
      setIsOverallLoading(false);
      prevCustomersRef.current = new Map(
        finalEnrichedData.map((c) => [c._id, c]),
      );

      if (newUpdatedIds.size > 0) {
        setUpdatedIds(newUpdatedIds);
        const timer = setTimeout(() => setUpdatedIds(new Set()), 2000);
        return () => clearTimeout(timer);
      }
    };

    if (initialData && initialData.length > 0) {
      setIsOverallLoading(true);
      processData(initialData);
    } else {
      setCustomers([]);
      prevCustomersRef.current = new Map();
      setIsOverallLoading(false);
    }

    // Yêu cầu 2.2: Đồng bộ state input với trang thực tế
    setPageInput(serverPage);

    return () => {
      cancelled = true;
    };
  }, [initialData, serverPage]);

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div className={styles.accountSelector}>
          <label className="text_6">TK dùng:</label>
          <div style={{ display: "flex" }}>
            <div
              className="input"
              style={{
                width: 130,
                padding: "6px 10px",
                borderRight: "none",
                borderRadius: "5px 0 0 5px",
              }}
            >
              <span className="text_6_400">{accountDisplayName}</span>
            </div>
            <Setting user={user} onUserUpdate={handleRefresh} />
          </div>
        </div>
        {selectedCount > 0 && (
          <button
            className={styles.btnCampaign}
            onClick={handleOpenBulkSchedule}
          >
            Lên chiến dịch ({selectedCount})
          </button>
        )}
      </div>

      <div
        className={`${styles.filterSection} ${
          isFilterCollapsed ? styles.collapsed : ""
        }`}
      >
        <div
          className={styles.filterHeader}
          onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
        >
          <h3>Bộ lọc & Tìm kiếm</h3>
          <CollapseIcon isCollapsed={isFilterCollapsed} />
        </div>
        <div className={styles.filterControls}>
          <div className={styles.filterGroup}>
            <label htmlFor="nameFilter">Tìm kiếm (tên/SĐT):</label>
            <input
              id="nameFilter"
              className={styles.filterInput}
              placeholder="Nhập từ khóa..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="labelFilter">Chiến dịch:</label>
            <select
              id="labelFilter"
              className={styles.filterSelect}
              value={searchParams.get("label") || ""}
              onChange={(e) => handleNavigation("label", e.target.value)}
            >
              <option value="">-- Tất cả --</option>
              {initialLabels?.map((label) => (
                <option key={label._id} value={label.title}>
                  {label.title}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="statusFilter">Trạng thái:</label>
            <select
              id="statusFilter"
              className={styles.filterSelect}
              value={searchParams.get("status") || ""}
              onChange={(e) => handleNavigation("status", e.target.value)}
            >
              <option value="">-- Tất cả --</option>
              {initialStatuses?.map((status) => (
                <option key={status._id} value={status._id}>
                  {status.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="uidFilter">UID:</label>
            <select
              id="uidFilter"
              className={styles.filterSelect}
              value={searchParams.get("uidStatus") || ""}
              onChange={(e) => handleNavigation("uidStatus", e.target.value)}
            >
              <option value="">-- Tất cả --</option>
              <option value="exists">Có UID</option>
              <option value="missing">Thiếu UID</option>
            </select>
          </div>
          <div className={styles.filterGroup} style={{ flex: "0 1 auto" }}>
            <label>Xem:</label>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn} ${
                  viewMode === "all" ? styles.active : ""
                }`}
                onClick={() => setViewMode("all")}
              >
                Tất cả ({initialPagination?.total || 0})
              </button>
              <button
                className={`${styles.viewBtn} ${
                  viewMode === "selected" ? styles.active : ""
                }`}
                onClick={() => setViewMode("selected")}
              >
                Đã chọn ({selectedCount})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Yêu cầu 2 & 3: Bảng dữ liệu và chân trang gộp làm một */}
      <div className={styles.gridWrapper}>
        <div className={styles.dataGrid}>
          <div className={styles.gridHeader}>
            <div style={{ display: "flex", flex: 5, color: "white" }}>
              <div
                style={{
                  flex: "0 0 40px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: "0 16px",
                }}
              >
                <input
                  type="checkbox"
                  className={styles.bigCheckbox}
                  checked={allOnPageChecked}
                  onChange={handleTogglePageAndStoreData}
                  disabled={viewMode === "selected"}
                />
              </div>
              <div
                className={styles.gridCell}
                style={{ flex: "0 0 50px", justifyContent: "center" }}
              >
                STT
              </div>
              <div
                className={styles.gridCell}
                style={{ flex: 1, justifyContent: "center" }}
              >
                Di động
              </div>
              <div className={styles.gridCell} style={{ flex: 1.5 }}>
                Tên
              </div>
              <div
                className={styles.gridCell}
                style={{ flex: 0.5, justifyContent: "center" }}
              >
                Giai đoạn
              </div>
              <div
                className={styles.gridCell}
                style={{ flex: 1, justifyContent: "center" }}
              >
                Trạng thái
              </div>
              <div
                className={styles.gridCell}
                style={{ flex: 0.7, justifyContent: "center" }}
              >
                Hành động
              </div>
              <div
                className={styles.gridCell}
                style={{ flex: 0.5, justifyContent: "center" }}
              >
                UID
              </div>
            </div>
            <div
              className={styles.gridCell}
              style={{ flex: 1, justifyContent: "center", color: "white" }}
            >
              TT xét tuyển
            </div>
          </div>
          <div className={styles.gridBody}>
            {isOverallLoading ? (
              <Loading content={"Đang tải..."} />
            ) : (
              (viewMode === "selected" ? scheduleData : customers).map(
                (r, idx) => (
                  <Row
                    key={r._id}
                    row={r}
                    rowIndex={startIndex + idx}
                    onToggle={toggleRowAndStoreData}
                    checked={selectedIds.has(r._id)}
                    onRowClick={handleRowClick}
                    isUpdated={updatedIds.has(r._id)}
                    isActive={activeRowIds.has(r._id)}
                  />
                ),
              )
            )}
          </div>
        </div>
        {serverTotalPages > 1 && viewMode === "all" && (
          <div className={styles.pagination}>
            <div className={styles.paginationInfo}>
              <div className={styles.limitControl}>
                <label htmlFor="limitInput">Số dòng/trang:</label>
                <input
                  id="limitInput"
                  type="number"
                  defaultValue={initialPagination.limit}
                  onKeyDown={handleLimitChange}
                  className={styles.pageInput}
                />
              </div>
            </div>
            <div className={styles.pageNavGroup}>
              <button
                onClick={() =>
                  handleNavigation("page", (serverPage - 1).toString())
                }
                className={styles.pageBtn}
                disabled={serverPage <= 1}
              >
                &laquo;
              </button>
              <span>
                Trang
                <input
                  type="number"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={handleGoToPage}
                  className={styles.pageInput}
                />{" "}
                / {serverTotalPages}
              </span>
              <button
                onClick={() =>
                  handleNavigation("page", (serverPage + 1).toString())
                }
                className={styles.pageBtn}
                disabled={serverPage >= serverTotalPages}
              >
                &raquo;
              </button>
            </div>
            <div>
              {" "}
              <span>
                (Hiển thị {customers.length} trên {initialPagination.total})
              </span>
            </div>
          </div>
        )}
      </div>

      <HistoryPopup ref={historyRef} />
    </div>
  );
}
// END: THAY THẾ TOÀN BỘ COMPONENT `ClientPage`

export default function Client(props) {
  return (
    <PanelProvider>
      <ClientPage {...props} />
      <PanelManager />
    </PanelProvider>
  );
}
