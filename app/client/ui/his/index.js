'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import FlexiblePopup from '@/components/(features)/(popup)/popup_right';
import CenterPopup from '@/components/(features)/(popup)/popup_center';
import Title from '@/components/(features)/(popup)/title';
import { Data_History } from '@/data/client';
import styles from './index.module.css';

const ACTION_TYPE_MAP = {
    sendMessage: 'Gửi tin nhắn',
    addFriend: 'Gửi lời mời kết bạn',
    findUid: 'Tìm kiếm UID',
};

const renderHistoryList = (histories, onItemClick) => (
    <div className={styles.historyList}>
        {histories.map(h => {
            const successCount = h.recipients.filter(r => r.status === 'success').length;
            const errorCount = h.recipients.length - successCount;
            const actionText = ACTION_TYPE_MAP[h.actionType] || h.actionType;

            return (
                <div key={h._id} className={styles.historyItem} onClick={() => onItemClick(h)}>
                    <div className={styles.itemHeader}>
                        <span className={styles.jobName}>{h.jobName || 'Không có tên'}</span>
                        <span className={styles.actionTypeBadge}>{actionText}</span>
                    </div>
                    <div className={styles.itemMeta}>
                        <span>{new Date(h.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                    <div className={styles.itemStats}>
                        <div className={`${styles.statusBadge} ${styles.success}`}>
                            <span className={styles.dot} />
                            {successCount} Thành công
                        </div>
                        <div className={`${styles.statusBadge} ${styles.error}`}>
                            <span className={styles.dot} />
                            {errorCount} Thất bại
                        </div>
                    </div>
                    {h.message && (
                        <div className={styles.messageBlock}>
                            <p className={styles.messageSnippet}>Nội dung: {h.message}</p>
                        </div>
                    )}
                </div>
            );
        })}
    </div>
);

const renderDetailPopup = ({ selectedHistory, onClose }) => {
    const [showRecipients, setShowRec] = useState(false);
    const [filterText, setFilterText] = useState('');

    const filteredRecipients = useMemo(() => {
        if (!selectedHistory) return [];
        return selectedHistory.recipients.filter(r =>
            (r.name && r.name.toLowerCase().includes(filterText.toLowerCase())) ||
            (r.phone && r.phone.includes(filterText))
        );
    }, [selectedHistory, filterText]);

    if (!selectedHistory) return null;

    const successCount = selectedHistory.recipients.filter(r => r.status === 'success').length;
    const errorCount = selectedHistory.recipients.length - successCount;

    return (
        <>
            <Title
                content={
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <p>Chi tiết lịch sử</p>
                        <div className='text_6_400' style={{ padding: '4px 8px', backgroundColor: '#e4ddff', borderRadius: 4 }}>
                            {selectedHistory.jobName}
                        </div>
                    </div>
                }
                click={onClose}
            />
            <div style={{ padding: 16 }}>
                {selectedHistory.actionType === 'sendMessage' && selectedHistory.message && (
                    <div className={styles.messageBlock} style={{ borderTop: 'none', margin: '0 0 16px 0', padding: 0 }}>
                        <p className='text_6'>Nội dung đã gửi:</p>
                        <p className='text_6_400' style={{ marginTop: 0, whiteSpace: 'pre-wrap' }}>
                            {selectedHistory.message}
                        </p>
                    </div>
                )}
                <p className='text_6' style={{ borderTop: 'thin solid var(--border-color)', paddingTop: '8px' }}>
                    Chi tiết từng người nhận:
                </p>
                <div style={{ display: 'flex', gap: 16, marginBottom: 8, alignItems: 'center' }}>
                    <div className={`${styles.statusBadge} ${styles.success}`}>
                        <span className={styles.dot} />
                        {successCount} Thành công
                    </div>
                    <div className={`${styles.statusBadge} ${styles.error}`}>
                        <span className={styles.dot} />
                        {errorCount} Thất bại
                    </div>
                    <button type="button" className={styles.toggleButton} onClick={() => setShowRec(v => !v)}>
                        {showRecipients ? 'Ẩn danh sách' : 'Hiển thị danh sách'}
                    </button>
                </div>
                {showRecipients && (
                    <div style={{ border: 'thin solid var(--border-color)', padding: '8px', borderRadius: 12 }}>
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Tìm theo tên hoặc số..."
                            value={filterText}
                            onChange={e => setFilterText(e.target.value)}
                        />
                        <ul className={styles.recipientList}>
                            {filteredRecipients.map((u, idx) => (
                                <li key={idx} className={styles.recipientItem}>
                                    <p className='text_6_400'>{u.name} — {u.phone}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className={styles.detailText}>{u.details}</span>
                                        <span className={`${styles.dot} ${u.status === 'success' ? styles.success : styles.error}`} />
                                    </div>
                                </li>
                            ))}
                            {filteredRecipients.length === 0 && (
                                <li className={styles.noResults}>Không tìm thấy người phù hợp</li>
                            )}
                        </ul>
                    </div>
                )}
            </div>
        </>
    );
};

export default function HistoryPopup({ open, onClose }) {
    const [centerOpen, setCenterOpen] = useState(false);
    const [selectedHistory, setSelected] = useState(null);
    const [historyList, setHistoryList] = useState(null);

    useEffect(() => {
        if (open) {
            Data_History().then(res => setHistoryList(res.data || []));
        }
    }, [open]);

    const handleItemClick = useCallback(h => {
        setSelected(h);
        setCenterOpen(true);
    }, []);

    return (
        <>
            <FlexiblePopup
                open={open}
                onClose={onClose}
                data={historyList || []}
                title="Lịch sử hành động"
                renderItemList={(histories) => renderHistoryList(histories, handleItemClick)}
                globalZIndex={1000}
            />
            <CenterPopup
                open={centerOpen}
                onClose={() => setCenterOpen(false)}
                size="md"
                globalZIndex={1001}
            >
                {renderDetailPopup({ selectedHistory, onClose: () => setCenterOpen(false) })}
            </CenterPopup>
        </>
    );
}
