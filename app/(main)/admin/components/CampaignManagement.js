// File: app/(main)/admin/components/CampaignManagement.js
"use client";

import React, { useState, useEffect, useTransition } from "react";
import styles from "../admin.module.css";
import {
  getCampaigns,
  createOrUpdateCampaign,
  deleteCampaign,
} from "@/app/actions/campaignActions";
import CenterPopup from "@/components/(features)/(popup)/popup_center";
import Loading from "@/components/(ui)/(loading)/loading";

// --- Component Form cho Popup ---
const CampaignForm = ({ campaign, onClose, onSave }) => {
  const [title, setTitle] = useState(campaign?.title || "");
  const [content, setContent] = useState(campaign?.content || "");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await onSave({ id: campaign?._id, title, content });
      if (result?.error) {
        alert(`Lỗi: ${result.error}`);
      } else {
        onClose();
      }
    });
  };

  return (
    <div className={styles.popupForm}>
      <h3>{campaign ? "Chỉnh sửa Chiến dịch" : "Tạo Chiến dịch Mới"}</h3>
      <div className={styles.formGroup}>
        <label htmlFor="title">Tên chiến dịch</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="VD: Tuyển sinh Khóa Mùa Thu 2025"
        />
      </div>
      <div className={styles.formGroup}>
        <label htmlFor="content">Nội dung mẫu (Tùy chọn)</label>
        <textarea
          id="content"
          rows="5"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nội dung tin nhắn sẽ được gợi ý khi nhân viên chọn chiến dịch này..."
        />
      </div>
      <div className={styles.formActions}>
        <button
          onClick={onClose}
          className={styles.cancelButton}
          disabled={isPending}
        >
          Hủy
        </button>
        <button
          onClick={handleSubmit}
          className={styles.saveButton}
          disabled={isPending}
        >
          {isPending ? "Đang lưu..." : "Lưu lại"}
        </button>
      </div>
    </div>
  );
};

// --- Component Chính ---
export default function CampaignManagement() {
  const [campaigns, setCampaigns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    getCampaigns().then((data) => {
      setCampaigns(data);
      setIsLoading(false);
    });
  }, []);

  const handleOpenPopup = (campaign = null) => {
    setSelectedCampaign(campaign);
    setIsPopupOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa chiến dịch này không?")) {
      await deleteCampaign(id);
      // Dữ liệu sẽ tự động được revalidate và cập nhật
    }
  };

  if (isLoading) {
    return <Loading content="Đang tải danh sách chiến dịch..." />;
  }

  return (
    <div className={styles.managementContainer}>
      <div className={styles.managementHeader}>
        <h2>Danh sách Chiến dịch</h2>
        <button onClick={() => handleOpenPopup()} className={styles.addButton}>
          + Tạo mới
        </button>
      </div>
      <div className={styles.tableContainer}>
        <table>
          <thead>
            <tr>
              <th>Tên chiến dịch</th>
              <th>Nội dung mẫu</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign._id}>
                <td>{campaign.title}</td>
                <td className={styles.contentCell}>{campaign.content}</td>
                <td>
                  <button
                    onClick={() => handleOpenPopup(campaign)}
                    className={styles.editButton}
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(campaign._id)}
                    className={styles.deleteButton}
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isPopupOpen && (
        <CenterPopup open={isPopupOpen} onClose={() => setIsPopupOpen(false)}>
          <CampaignForm
            campaign={selectedCampaign}
            onClose={() => setIsPopupOpen(false)}
            onSave={createOrUpdateCampaign}
          />
        </CenterPopup>
      )}
    </div>
  );
}
