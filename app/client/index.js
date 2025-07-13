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
import Label from "./ui/label";
import AddLabelButton from "./ui/addlabel";
import Setting from "./ui/setting";
import Run from "./ui/run";
import Schedule from "./ui/schedule";
import HistoryPopup from "./ui/his";
import WrapIcon from "@/components/(ui)/(button)/hoveIcon";
import { Svg_Pen } from "@/components/(icon)/svg";
import CenterPopup from "@/components/(features)/(popup)/popup_center";
import Noti from "@/components/(features)/(noti)/noti";
import { PanelProvider, usePanels } from "@/contexts/PanelContext";
import StandardSidePanel from "@/components/(features)/panel/SidePanel"; // Import panel quy chuẩn
import CustomerDetails from "./ui/details/CustomerDetails"; // Import nội dung chi tiết khách hàng
import StageIndicator from "@/components/(ui)/progress/StageIndicator";

const useTraCuuData = (customers) => {
  const [lookupMap, setLookupMap] = useState(new Map());

  // Chỉ lấy SĐT của những khách hàng chưa có trong bản đồ tra cứu
  const phonesToFetch = useMemo(
    () =>
      customers
        .map((c) => c.phone)
        .filter((phone) => phone && !lookupMap.has(phone)),
    [customers, lookupMap],
  );

  useEffect(() => {
    if (phonesToFetch.length === 0) return;

    let cancelled = false;

    const fetchAll = async () => {
      console.log(`Đang tra cứu cho ${phonesToFetch.length} SĐT mới...`);

      const fetchPromises = phonesToFetch.map(async (phone) => {
        try {
          const res = await fetch(
            "https://tapi.lhu.edu.vn/TS/AUTH/XetTuyen_TraCuu",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: phone }),
            },
          );
          if (!res.ok) return [phone, { TinhTrang: "Lỗi tra cứu" }];
          const raw = await res.json();
          const data = (Array.isArray(raw) ? raw[0] : raw?.data?.[0]) || {
            TinhTrang: "Không có thông tin",
          };
          return [phone, data];
        } catch {
          return [phone, { TinhTrang: "Lỗi kết nối" }];
        }
      });

      const results = await Promise.all(fetchPromises);

      if (!cancelled) {
        setLookupMap((prevMap) => {
          const newMap = new Map(prevMap);
          results.forEach(([phone, data]) => {
            newMap.set(phone, data);
          });
          return newMap;
        });
      }
    };

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [phonesToFetch]); // Chỉ chạy lại khi có SĐT mới cần fetch

  return lookupMap;
};

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
  onSearch,
}) {
  const hasData = row._apiStatus === "success";
  const canSearch = hasData && row.MaDangKy;

  const disabledStyle = {
    backgroundColor: "var(--red)",
    cursor: "default",
    pointerEvents: "none",
  };
  const getLookupStatusType = (tinhTrang) => {
    if (tinhTrang === "Không có thông tin") {
      return "error"; // Màu đỏ
    }
    if (tinhTrang === "Thiếu thông tin") {
      return "warning"; // Màu vàng
    }
    if (tinhTrang === "Đủ đúng không xét tuyển") {
      return "success"; // Màu xanh lá
    }
    if (tinhTrang) {
      return "found"; // Màu xanh dương cho các trường hợp khác
    }
    return "not-found"; // Màu xám
  };

  return (
    <div
      className={styles.gridRow}
      style={{ backgroundColor: row.remove ? "#ffd9dd" : "white" }}
      onClick={() => onRowClick(row)}
    >
      <div style={{ display: "flex", flex: 5 }}>
        <div
          className={`${styles.gridCell} ${styles.colTiny}`}
          style={{ justifyContent: "center", flex: 0.3, padding: "0 5px" }}
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
          className={`${styles.gridCell} ${styles.colSmall} text_6_400`}
          style={{ justifyContent: "center", flex: 0.3, fontWeight: 600 }}
        >
          {rowIndex + 1}
        </div>
        <div
          className={`${styles.gridCell} text_6_400`}
          style={{ justifyContent: "center", flex: 1, padding: "0 5px" }}
        >
          {row.phone}
        </div>
        <div
          className={`${styles.gridCell} text_6_400`}
          style={{ flex: 1.5, padding: "0 5px" }}
        >
          {row.name}
        </div>
        <div
          className={`${styles.gridCell} text_6_400`}
          style={{ justifyContent: "center", flex: 0.5, padding: "0 5px" }}
        >
          <StageIndicator level={row.stageLevel} />
        </div>
        <div
          className={`${styles.gridCell} text_6_400`}
          style={{
            justifyContent: "center",
            flex: 1,
            padding: "0 5px",
            overflow: "hidden",
          }}
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
          style={{ justifyContent: "center", flex: 0.7, padding: "0 5px" }}
        >
          {row.action && row.action.length > 0 ? row.action[0].actionType : "-"}
        </div>
        <div
          className={`${styles.gridCell} text_7_400`}
          style={{ justifyContent: "center", flex: 0.5, padding: "0 5px" }}
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

function ClientPage({
  initialData,
  initialPagination,
  initialLabels,
  initialStatuses,
  user,
}) {
  const { isPanelOpen, panelContent, openPanel, closePanel } = usePanels();
  const [traCuuOpen, setTraCuuOpen] = useState(false);
  const [traCuuData, setTraCuuData] = useState(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const {
    selectedIds,
    toggleOne: toggleSelectRow,
    setSelectedIds,
    size: selectedCount,
  } = useSelection();
  const [selectedCustomerMap, setSelectedCustomerMap] = useState(new Map());
  const [viewMode, setViewMode] = useState("all");
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [showLabelPopup, setShowLabelPopup] = useState(false);
  const historyRef = useRef(null);
  const scheduleRef = useRef(null);
  const [customers, setCustomers] = useState(initialData);

  const serverPage = initialPagination?.page || 1;
  const serverTotalPages = initialPagination?.totalPages || 1;
  const serverLimit = initialPagination?.limit || 10;
  const currentLimit = useMemo(
    () => Number(searchParams.get("limit")) || serverLimit,
    [searchParams, serverLimit],
  );
  const scheduleData = useMemo(
    () => [...selectedCustomerMap.values()],
    [selectedCustomerMap],
  );

  const handleOpenBulkSchedule = useCallback(() => {
    scheduleRef.current?.openForBulk(scheduleData);
  }, [scheduleData]);

  const handleRowClick = useCallback(
    (row) => {
      openPanel(row);
    },
    [openPanel],
  );

  const handleRefreshAndClose = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
    closePanel(); // Ra lệnh: "Đóng sân khấu!"
  }, [router, startTransition, closePanel]);

  const handleRefresh = useCallback(
    () => startTransition(() => router.refresh()),
    [router],
  );

  const handleNavigation = useCallback(
    (name, value) => {
      const params = new URLSearchParams(searchParams);

      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }

      // Khi thay đổi bất kỳ bộ lọc nào (trừ việc chuyển trang), luôn quay về trang 1
      if (name !== "page") {
        params.set("page", "1");
      }

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams],
  );

  const handleLoadMore = useCallback(() => {
    // Tăng giới hạn hiện tại lên 10 và điều hướng
    handleNavigation("limit", (currentLimit + 10).toString());
  }, [currentLimit, handleNavigation]);

  const handleLoadLess = useCallback(() => {
    // Đảm bảo giới hạn không bao giờ nhỏ hơn 10
    const newLimit = Math.max(10, currentLimit - 10);
    handleNavigation("limit", newLimit.toString());
  }, [currentLimit, handleNavigation]);

  //Cập nhật state này khi dữ liệu từ server thay đổi (ví dụ: chuyển trang, load more)
  useEffect(() => {
    setCustomers(initialData);
  }, [initialData]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (query !== (searchParams.get("query") || ""))
        handleNavigation("query", query);
    }, 300);
    return () => clearTimeout(t);
  }, [query, searchParams, handleNavigation]);

  useEffect(() => {
    let cancelled = false;

    // Lấy dữ liệu từ server và làm giàu nó
    const enrichData = async (dataToEnrich) => {
      // Tìm những khách hàng chưa có thông tin tra cứu
      const customersToFetch = dataToEnrich.filter(
        (c) => c.phone && c.TinhTrang === undefined,
      );

      if (customersToFetch.length === 0) {
        // Nếu không có ai cần fetch, chỉ cần cập nhật state
        setCustomers(dataToEnrich);
        return;
      }

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

      const enrichedCustomers = await Promise.all(fetchPromises);
      const enrichedMap = new Map(enrichedCustomers.map((c) => [c._id, c]));

      if (!cancelled) {
        // Cập nhật lại state chính bằng cách trộn dữ liệu cũ và mới
        const finalData = dataToEnrich.map((c) => enrichedMap.get(c._id) || c);
        setCustomers(finalData);
      }
    };

    enrichData(initialData);

    return () => {
      cancelled = true;
    };
  }, [initialData]);

  const uniqueLabels = useMemo(
    () =>
      initialLabels
        ? [...new Set(initialLabels.map((l) => l.title))].sort((a, b) =>
            a.localeCompare(b, "vi"),
          )
        : [],
    [initialLabels],
  );
  const inlineLabels = useMemo(() => uniqueLabels.slice(0, 6), [uniqueLabels]);
  const currentSelectedLabels = useMemo(
    () => new Set((searchParams.get("label") || "").split(",").filter(Boolean)),
    [searchParams],
  );

  const handleLabelToggle = useCallback(
    (labelTitle) => {
      const next = new Set(currentSelectedLabels);
      next.has(labelTitle) ? next.delete(labelTitle) : next.add(labelTitle);
      handleNavigation("label", [...next].join(","));
    },
    [currentSelectedLabels, handleNavigation],
  );

  const allOnPageChecked = useMemo(
    () =>
      initialData.length > 0 &&
      initialData.every((r) => selectedIds.has(r._id)),
    [initialData, selectedIds],
  );

  const toggleRowAndStoreData = useCallback(
    (row) => {
      setSelectedCustomerMap((prev) => {
        const m = new Map(prev);
        m.has(row._id) ? m.delete(row._id) : m.set(row._id, row);
        return m;
      });
      toggleSelectRow(row._id);
    },
    [toggleSelectRow],
  );

  const handleTogglePageAndStoreData = useCallback(() => {
    setSelectedCustomerMap((prev) => {
      const m = new Map(prev);
      if (allOnPageChecked) initialData.forEach((row) => m.delete(row._id));
      else initialData.forEach((row) => m.set(row._id, row));
      return m;
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const pageIds = initialData.map((r) => r._id);
      pageIds.forEach((id) =>
        allOnPageChecked ? next.delete(id) : next.add(id),
      );
      return next;
    });
  }, [initialData, allOnPageChecked, setSelectedIds]);

  const handleOpenQuickMessage = useCallback((customer) => {
    scheduleRef.current?.openForQuickMessage(customer);
  }, []);

  // 3. Hàm mới để gọi HistoryPopup qua "bộ đàm"
  const handleShowHistory = useCallback((customer) => {
    historyRef.current?.showFor(customer);
  }, []);

  const rowsToDisplay = useMemo(
    () => (viewMode === "selected" ? scheduleData : initialData),
    [viewMode, scheduleData, initialData],
  );
  const visiblePhones = useMemo(
    () => rowsToDisplay.slice(0, 10).map((r) => r.phone),
    [rowsToDisplay],
  );

  const accountDisplayName = user?.zalo?.name || "Chưa chọn tài khoản";

  const totalDisplayPages = useMemo(
    () =>
      viewMode === "selected"
        ? Math.ceil(scheduleData.length / serverLimit) || 1
        : serverTotalPages,
    [viewMode, scheduleData.length, serverLimit, serverTotalPages],
  );
  const currentDisplayPage = useMemo(
    () => (viewMode === "selected" ? 1 : serverPage),
    [viewMode, serverPage],
  );
  const handleSearchClick = useCallback((row) => {
    setTraCuuData(row);
    setTraCuuOpen(true);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.filterSection}>
        <div className={styles.filterHeader}>
          <p className="text_3" style={{ color: "white" }}>
            Danh sách khách hàng
          </p>
          <div style={{ display: "flex", gap: 16 }}>
            <button
              className={styles.btnAction}
              onClick={() => setHistoryOpen(true)}
            >
              Xem lịch sử
            </button>
            <button
              className={`${styles.btnAction} ${styles.btnReload}`}
              onClick={handleRefresh}
              disabled={isPending}
            >
              {isPending ? "Đang làm mới..." : "Làm mới dữ liệu"}
            </button>
          </div>
        </div>
        <div className={styles.filterChips}>
          <div
            style={{
              flex: 1,
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span className="text_6">Lọc theo chiến dịch:</span>
            {inlineLabels.map((lbl) => {
              const active = currentSelectedLabels.has(lbl);
              return (
                <button
                  key={lbl}
                  className={`${styles.chip}${
                    active ? ` ${styles.chipActive}` : ""
                  }`}
                  onClick={() => handleLabelToggle(lbl)}
                >
                  {lbl}
                  {active && <span className={styles.chipRemove}>×</span>}
                </button>
              );
            })}
            {uniqueLabels.length > 6 && (
              <button
                className={styles.chip}
                onClick={() => setShowLabelPopup(true)}
              >
                …
              </button>
            )}
            <AddLabelButton onCreated={handleRefresh} />
          </div>
          <Label data={initialLabels} reload={handleRefresh} />
        </div>
        <div className={styles.filterControls}>
          <div className={styles.filterGroup}>
            <label htmlFor="nameFilter" className="text_6">
              Tìm kiếm (tên/SĐT):
            </label>
            <input
              id="nameFilter"
              className={styles.filterInput}
              placeholder="Nhập tên hoặc số điện thoại..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="statusFilter" className="text_6">
              Trạng thái chăm sóc:
            </label>
            <select
              id="statusFilter"
              className={styles.filterSelect}
              defaultValue={searchParams.get("status") || ""}
              onChange={(e) => handleNavigation("status", e.target.value)}
            >
              <option value="">-- Tất cả trạng thái --</option>
              {initialStatuses?.map((status) => (
                <option key={status._id} value={status._id}>
                  {status.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="uidFilter" className="text_6">
              Trạng thái UID:
            </label>
            <select
              id="uidFilter"
              className={styles.filterSelect}
              defaultValue={searchParams.get("uidStatus") || ""}
              onChange={(e) => handleNavigation("uidStatus", e.target.value)}
            >
              <option value="">-- Tất cả --</option>
              <option value="exists">Có UID</option>
              <option value="missing">Thiếu UID</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p className="text_6">Chọn</p>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewBtn}${
                  viewMode === "all" ? ` ${styles.active}` : ""
                }`}
                onClick={() => setViewMode("all")}
              >
                Tất cả ({initialPagination?.total || 0})
              </button>
              <button
                className={`${styles.viewBtn}${
                  viewMode === "selected" ? ` ${styles.active}` : ""
                }`}
                onClick={() => setViewMode("selected")}
              >
                Đã chọn ({selectedCount})
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.messageSection}>
        <div className={styles.accountSelector} style={{ flex: 1 }}>
          <label className="text_6">Gửi từ tài khoản:</label>
          <div style={{ display: "flex" }}>
            <div
              className="input"
              style={{
                width: 150,
                padding: "8px 12px",
                color: "#495057",
                borderRight: "none",
                borderRadius: "5px 0 0 5px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span className="text_6_400">{accountDisplayName}</span>
            </div>
            <Setting user={user} onUserUpdate={handleRefresh} />
          </div>
          <Run data={user} />
        </div>
        <button
          className="btn"
          style={{ borderRadius: 5, margin: 0 }}
          onClick={handleOpenBulkSchedule} // <-- Đảm bảo gọi đúng tên hàm này
        >
          <p className="text_6" style={{ color: "white" }}>
            Lên chiến dịch hàng loạt
          </p>
        </button>
      </div>
      {isPending && <div className={styles.loading}>Đang tải dữ liệu...</div>}
      {!isPending && (
        <>
          <div className={styles.dataGrid}>
            <div className={styles.gridHeader}>
              <div style={{ display: "flex", flex: 5 }}>
                {/* Các thuộc tính flex đã được điều chỉnh và thêm justifyContent */}
                <div
                  className={`${styles.gridCell} ${styles.colTiny}`}
                  style={{ justifyContent: "center", flex: 0.3 }}
                >
                  <input
                    type="checkbox"
                    className={styles.bigCheckbox}
                    checked={allOnPageChecked}
                    onChange={handleTogglePageAndStoreData}
                    disabled={viewMode === "selected"}
                  />
                  {selectedCount > 0 && (
                    <span
                      className={styles.selectedCount}
                      style={{ color: "white" }}
                    >
                      {selectedCount}
                    </span>
                  )}
                </div>
                <div
                  className={`${styles.gridCell} ${styles.colSmall} text_6`}
                  style={{
                    justifyContent: "center",
                    flex: 0.3,
                    color: "white",
                  }}
                >
                  STT
                </div>
                <div
                  className={`${styles.gridCell} text_6`}
                  style={{ justifyContent: "center", color: "white", flex: 1 }}
                >
                  Di động
                </div>
                <div
                  className={`${styles.gridCell} text_6`}
                  style={{ color: "white", flex: 1.5 }}
                >
                  Tên
                </div>{" "}
                {/* Để tên căn trái cho dễ đọc */}
                <div
                  className={`${styles.gridCell} text_6`}
                  style={{
                    justifyContent: "center",
                    color: "white",
                    flex: 0.5,
                  }}
                >
                  Giai đoạn
                </div>
                <div
                  className={`${styles.gridCell} text_6`}
                  style={{ justifyContent: "center", color: "white", flex: 1 }}
                >
                  Trạng thái
                </div>
                <div
                  className={`${styles.gridCell} text_6`}
                  style={{
                    justifyContent: "center",
                    color: "white",
                    flex: 0.7,
                  }}
                >
                  Hành động
                </div>
                <div
                  className={`${styles.gridCell} text_6`}
                  style={{
                    justifyContent: "center",
                    color: "white",
                    flex: 0.5,
                  }}
                >
                  UID
                </div>
              </div>
              <div
                className={`${styles.gridCell} text_6`}
                style={{ justifyContent: "center", color: "white", flex: 1 }}
              >
                Cập nhật
              </div>
            </div>
            <div className={styles.gridBody}>
              {customers.map((r, idx) => (
                <Row
                  key={r._id}
                  row={r}
                  rowIndex={idx}
                  onToggle={toggleRowAndStoreData}
                  checked={selectedIds.has(r._id)}
                  onRowClick={handleRowClick}
                />
              ))}
            </div>
          </div>
          {totalDisplayPages > 1 && (
            <div className={styles.pagination}>
              {/* Nút Bớt đi (Bên trái) */}
              <div>
                {currentLimit > 10 && (
                  <button onClick={handleLoadLess} className={styles.pageBtn}>
                    Bớt đi -10
                  </button>
                )}
              </div>

              {/* Nhóm điều hướng trang (Ở giữa) */}
              <div className={styles.pageNavGroup}>
                {currentDisplayPage > 1 && (
                  <button
                    onClick={() =>
                      handleNavigation("page", currentDisplayPage - 1)
                    }
                    className={styles.pageBtn}
                  >
                    &laquo; Trang trước
                  </button>
                )}
                <span className={`text_6_400`} style={{ color: "white" }}>
                  Trang {currentDisplayPage} / {totalDisplayPages}
                </span>
                {currentDisplayPage < totalDisplayPages && (
                  <button
                    onClick={() =>
                      handleNavigation("page", currentDisplayPage + 1)
                    }
                    className={styles.pageBtn}
                  >
                    Trang sau &raquo;
                  </button>
                )}
              </div>
              <div>
                <button onClick={handleLoadMore} className={styles.pageBtn}>
                  Xem thêm +10
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {showLabelPopup && (
        <div
          className={styles.labelModalBackdrop}
          onClick={() => setShowLabelPopup(false)}
        >
          <div
            className={styles.labelModal}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.labelModalTitle}>Chọn nhãn để lọc</h3>
            <div className={styles.labelModalGrid}>
              {uniqueLabels.map((lbl) => {
                const active = currentSelectedLabels.has(lbl);
                return (
                  <button
                    key={lbl}
                    className={`${styles.chipLarge}${
                      active ? ` ${styles.chipActive}` : ""
                    }`}
                    onClick={() => handleLabelToggle(lbl)}
                  >
                    {lbl}
                    {active && <span className={styles.chipRemove}>×</span>}
                  </button>
                );
              })}
            </div>
            <button
              className={styles.btnCloseModal}
              onClick={() => setShowLabelPopup(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      <StandardSidePanel
        isOpen={isPanelOpen}
        onClose={closePanel}
        title="Thông tin chi tiết"
      >
        {panelContent && (
          <CustomerDetails
            // Truyền key để component re-mount khi đổi khách hàng
            key={panelContent._id}
            customerData={panelContent} // Truyền dữ liệu qua prop
            onSave={handleRefreshAndClose}
            onShowHistory={handleShowHistory}
            onQuickMessage={handleOpenQuickMessage}
          />
        )}
      </StandardSidePanel>
      <Schedule ref={scheduleRef} user={user} label={initialLabels} />
      <HistoryPopup ref={historyRef} />

      <CenterPopup
        open={traCuuOpen}
        onClose={() => setTraCuuOpen(false)}
        title="DANH SÁCH NGUYỆN VỌNG"
        size="lg"
        globalZIndex={1200}
      >
        {traCuuData && (
          <table className={styles.popupTable}>
            <thead>
              <tr>
                <th>Mã HS</th>
                <th>Họ tên</th>
                <th>Điện thoại</th>
                <th>Trường THPT</th>
                <th>Ngành xét tuyển</th>
                <th>Tổng điểm</th>
                <th>Phương thức xét tuyển</th>
                <th>Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{traCuuData.MaDangKy}</td>
                <td>{traCuuData.HoTen}</td>
                <td>{traCuuData.DienThoai}</td>
                <td>{traCuuData.TruongTHPT}</td>
                <td>{traCuuData.TenNganh}</td>
                <td style={{ textAlign: "right" }}>
                  {traCuuData.TongDiem?.toFixed?.(2) ?? traCuuData.TongDiem}
                </td>
                <td>{traCuuData.TenPhuongThuc}</td>
                <td>{traCuuData.TinhTrang}</td>
              </tr>
            </tbody>
          </table>
        )}
      </CenterPopup>
    </div>
  );
}

export default function Client(props) {
  return (
    <PanelProvider>
      <ClientPage {...props} />
    </PanelProvider>
  );
}
