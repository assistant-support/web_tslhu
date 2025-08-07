// ** MODIFIED: Refactor toàn bộ component để sử dụng DataTable và chuẩn bị cho Panel mới
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePanels } from "@/contexts/PanelContext";
import {
  getZaloAccounts,
  deleteZaloAccount,
} from "@/app/actions/zaloAccountActions";
import LoadingSpinner from "../shared/LoadingSpinner";
import PaginationControls from "../shared/PaginationControls";
import DataTable from "../datatable/DataTable";
import ZaloDisplay from "../shared/ZaloDisplay";
import ZaloDetailsPanel from "../Panel/ZaloDetailsPanel";

// ++ ADDED: Component con để hiển thị giới hạn, theo đúng kiến trúc
const LimitDisplay = ({ rateLimitPerHour, rateLimitPerDay }) => {
  const limitTextStyle = {
    fontSize: "12px",
    color: "#475569",
    margin: 0,
    lineHeight: 1.4,
  };
  return (
    <div>
      <p style={limitTextStyle}>{rateLimitPerHour || 30}/giờ</p>
      <p style={limitTextStyle}>{rateLimitPerDay || 200}/ngày</p>
    </div>
  );
};

export default function AccountManagement() {
  const { openPanel, closePanel, allActivePanels } = usePanels();
  const [accounts, setAccounts] = useState([]);
  const [pagination, setPagination] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // ** MODIFIED: fetchData giờ sẽ xử lý phân trang từ server
  const fetchData = useCallback(async (page = 1, limit = 10) => {
    setIsLoading(true);
    const result = await getZaloAccounts({ page, limit });
    if (result.success) {
      setAccounts(result.data);
      setPagination(result.pagination);
    } else {
      alert(`Lỗi: ${result.error}`);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeAccountIds = useMemo(() => {
    return (allActivePanels || [])
      .filter((panel) => panel.id.startsWith("zalo-details-"))
      .map((panel) => panel.id.replace("zalo-details-", ""));
  }, [allActivePanels]);

  const handleOpenDetails = (account) => {
    const panelId = `zalo-details-${account._id}`;

    openPanel({
      id: panelId,
      title: `Chi tiết TK Zalo: ${account.name}`,
      component: ZaloDetailsPanel,
      props: {
        accountId: account._id,
        onClose: () => closePanel(panelId),
        onUpdate: fetchData, // Callback để làm mới danh sách sau khi gán user
      },
    });
  };

  const handleAddItem = () => {
    const panelId = `zalo-details-new`;
    openPanel({
      id: panelId,
      title: "Tạo Tài khoản Zalo Mới",
      component: ZaloDetailsPanel,
      props: {
        // Không truyền accountId để panel hiểu là đang ở chế độ "tạo mới"
        onClose: () => closePanel(panelId),
        onUpdate: fetchData, // Tải lại bảng sau khi tạo thành công
      },
    });
  };

  const handleDeleteItem = async (item) => {
    if (
      prompt(
        `Để XÁC NHẬN XÓA vĩnh viễn, vui lòng nhập lại SĐT "${item.phone}" của tài khoản:`,
      ) === item.phone
    ) {
      const result = await deleteZaloAccount(item._id);
      if (result.success) {
        alert(`Đã xóa tài khoản ${item.name}`);
        fetchData(pagination.page, pagination.limit);
      } else {
        alert(`Lỗi: ${result.error}`);
      }
    } else {
      alert("Xác nhận không hợp lệ. Thao tác đã bị hủy.");
    }
  };

  const columns = [
    {
      header: "Tên tài khoản",
      accessor: "name",
      width: "2fr",
      cell: (item) => (
        <ZaloDisplay name={item.name} phone={item.phone} avatar={item.avt} />
      ),
    },
    {
      header: "Nhân viên gán",
      width: "1fr",
      cell: (item) => (item.users || []).length,
    },
    // ++ ADDED: Cột Giới hạn mới
    {
      header: "Giới hạn",
      width: "1fr",
      cell: (item) => (
        <LimitDisplay
          rateLimitPerHour={item.rateLimitPerHour}
          rateLimitPerDay={item.rateLimitPerDay}
        />
      ),
    },
    {
      header: "Script Action",
      accessor: "action",
      width: "2fr",
      cell: (item) => (
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "12px",
            wordBreak: "break-all",
          }}
        >
          {item.action || "Chưa có"}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flexGrow: 1, minHeight: 0 }}>
        <DataTable
          columns={columns}
          data={accounts} // ** MODIFIED: Dùng data trực tiếp từ server
          onRowDoubleClick={handleOpenDetails}
          activeRowId={activeAccountIds}
          showActions={true}
          onAddItem={handleAddItem}
          onDeleteItem={(id) => {
            const itemToDelete = accounts.find((acc) => acc._id === id);
            if (itemToDelete) handleDeleteItem(itemToDelete);
          }}
        />
      </div>
      <div style={{ flexShrink: 0 }}>
        <PaginationControls pagination={pagination} onPageChange={fetchData} />
      </div>
    </div>
  );
}
