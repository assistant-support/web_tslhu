'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import FlexiblePopup from '@/components/(features)/(popup)/popup_right';
import CenterPopup from '@/components/(features)/(popup)/popup_center';
import Loading from '@/components/(ui)/(loading)/loading';
import { Data_History_User, Re_Client } from '@/data/client';
import Noti from '@/components/(features)/(noti)/noti';
import styles from './index.module.css';
import Title from '@/components/(features)/(popup)/title';

// --- CÁC HÀM TIỆN ÍCH ---

const ACTION_TYPE_MAP = {
    sendMessage: 'Gửi tin nhắn',
    addFriend: 'Gửi lời mời kết bạn',
    findUid: 'Tìm kiếm UID',
};

const getCustomerType = row => {
    if (!row) return 'Mới';
    if (row.remove && row.remove.trim() !== '') return 'Đã hủy';
    if (row.study) return 'Nhập học';
    if (row.studyTry) return 'Học thử';
    if (row.care) return 'Có nhu cầu';
    return 'Mới';
};

const InfoRow = React.memo(function InfoRow({ label, value }) {
    return (
        <p className="text_6" style={{ margin: '4px 0' }}>
            {label}:&nbsp;
            <span style={{ fontWeight: 400 }}>
                {value || '—'}
            </span>
        </p>
    );
});

// --- CÁC COMPONENT RENDER ---

const renderDetailPopup = ({ selectedHistory, userPhone, onClose }) => {
    if (!selectedHistory) return <Loading content="Đang tải..." />;

    const recipientData = selectedHistory.recipients.find(r => r.phone === userPhone);

    if (!recipientData) {
        return (
            <>
                <Title content={<p>Lỗi</p>} click={onClose} />
                <div style={{ padding: '24px', textAlign: 'center' }}>
                    Không tìm thấy dữ liệu chi tiết cho hành động này.
                </div>
            </>
        );
    }

    const actionText = ACTION_TYPE_MAP[selectedHistory.actionType] || selectedHistory.actionType;
    const isSuccess = recipientData.status === 'success';

    return (
        <>
            <Title
                content={
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <p>Chi tiết hành động</p>
                        <div className={styles.historyLabels} style={{ backgroundColor: '#e4ddff' }}>
                            {selectedHistory.jobName}
                        </div>
                    </div>
                }
                click={onClose}
            />
            <div className={styles.info} style={{ borderBottom: 'none' }}>
                <InfoRow label="Hành động" value={actionText} />
                <InfoRow label="Thời gian" value={recipientData.processedAt ? new Date(recipientData.processedAt).toLocaleString('vi-VN') : 'Chưa có'} />
                <div className={styles.messageBlock} style={{ borderTop: '1px solid var(--border-color)', margin: '12px 0', padding: '6px 0' }}>
                    <p className='text_6' style={{ marginBottom: '4px' }}>Nội dung/Kết quả:</p>
                    <p className={`${styles.historyMessage} text_6_400`}>
                        {recipientData.details || 'Không có chi tiết.'}
                    </p>
                </div>
                <div className={styles.statusRow} style={{ justifyContent: 'flex-start' }}>
                    <p className='text_6'>Trạng thái:</p>
                    <div className={`${styles.statusBadge} ${isSuccess ? styles.success : styles.error}`}>
                        <span className={styles.dot} />
                        {isSuccess ? 'Thành công' : 'Thất bại'}
                    </div>
                </div>
            </div>
        </>
    );
};

const renderCareHistory = (histories, onHistoryClick, userPhone) => {
    if (!histories) return <Loading content="Đang tải lịch sử..." />;
    if (histories.length === 0) {
        return <div className={styles.emptyHistory}>Chưa có lịch sử chăm sóc</div>;
    }
    return (
        <ul className={styles.historyList}>
            {histories.map(h => {
                const recipientData = h.recipients.find(r => r.phone === userPhone);
                if (!recipientData) return null;

                const actionText = ACTION_TYPE_MAP[h.actionType] || h.actionType;
                const isSuccess = recipientData.status === 'success';

                return (
                    <li key={h._id} className={styles.historyItem} onClick={() => onHistoryClick(h)}>
                        <div className={styles.historyHeader}>
                            <div className={styles.historyDate}>{recipientData.processedAt ? new Date(recipientData.processedAt).toLocaleDateString('vi-VN') : ''}</div>
                            <div className={styles.historyLabels}>{actionText}</div>
                        </div>
                        <p className={styles.historyMessage}>{h.jobName || 'Hành động trực tiếp'}</p>
                        <div className={`${styles.statusBadge} ${isSuccess ? styles.success : styles.error}`}>
                            <span className={styles.dot} />
                            {isSuccess ? 'Thành công' : 'Thất bại'}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};

// --- COMPONENT CHÍNH ---

export default function SidePanel({ open, row, labels = [], onClose, onSave }) {
    const firstInputRef = useRef(null);
    const [inputs, setInputs] = useState({ care: '', studyTry: '', study: '' });
    const [saving, setSaving] = useState(false);
    const [secondaryOpen, setSecondaryOpen] = useState(false);
    const [formOpen, setFormOpen] = useState(true);
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedHistory, setSelectedHistory] = useState(null);
    const [notiOpen, setNotiOpen] = useState(false);
    const [notiStatus, setNotiStatus] = useState(false);
    const [notiMes, setNotiMes] = useState('');

    const isCancelled = row?.remove && row.remove.trim() !== '';

    useEffect(() => {
        const handleEsc = e => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    useEffect(() => {
        if (row) {
            setInputs({
                care: row.care ?? '',
                studyTry: row.studyTry ?? '',
                study: row.study ?? '',
            });
        }
    }, [row]);

    useEffect(() => {
        if (open && formOpen) {
            const t = setTimeout(() => firstInputRef.current?.focus(), 300);
            return () => clearTimeout(t);
        }
    }, [open, formOpen]);

    const handleChange = key => e => setInputs(prev => ({ ...prev, [key]: e.target.value }));

    const handleToggleCancel = async () => {
        if (saving) return;
        setSaving(true);
        const newRemoveValue = isCancelled ? '' : 'Đã hủy';
        try {
            const res = await fetch('/api/client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: row.phone, remove: newRemoveValue }),
            });
            const result = await res.json();
            setNotiStatus(result.status === 2);
            setNotiMes(result.mes);
            setNotiOpen(true);
        } catch (err) {
            setNotiStatus(false);
            setNotiMes(isCancelled ? 'Bỏ hủy thất bại!' : 'Hủy đăng ký thất bại!');
            setNotiOpen(true);
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async e => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
            const res = await fetch('/api/client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: row.phone, ...inputs }),
            });
            const result = await res.json();
            setNotiStatus(result.status === 2);
            setNotiMes(result.mes);
            setNotiOpen(true);
        } catch (err) {
            setNotiStatus(false);
            setNotiMes('Cập nhật thất bại!');
            setNotiOpen(true);
        } finally {
            setSaving(false);
        }
    };

    const handleHistoryClick = useCallback(h => {
        setSelectedHistory(h);
        setDetailOpen(true);
    }, []);

    const renderContent = () => (
        <>
            <section className={styles.info}>
                <p className="text_4" style={{ marginBottom: 8 }}>Thông tin khách hàng</p>
                <InfoRow label="Họ và tên" value={row?.nameParent} />
                <InfoRow label="Số điện thoại" value={row?.phone} />
                <InfoRow label="Email" value={row?.email} />
                <InfoRow label="Tên học sinh" value={row?.nameStudent} />
                <InfoRow label="Khu vực" value={row?.area} />
                <InfoRow label="Nguồn data" value={row?.source} />
            </section>

            {labels.length > 0 && (
                <section className={styles.labelsBox}>
                    <p className="text_4" style={{ marginBottom: 8 }}>Nhãn</p>
                    <div className={styles.labelsWrap}>
                        {labels.map(l => <span key={l} className="chip">{l}</span>)}
                    </div>
                </section>
            )}

            <section className={styles.info}>
                <p className="text_4" style={{ marginBottom: 8 }}>Lịch sử chăm sóc</p>
                <InfoRow label="Giai đoạn chăm sóc" value={getCustomerType(row)} />
                <button
                    type="button"
                    className={styles.saveBtn}
                    style={{ marginTop: 8 }}
                    onClick={() => setSecondaryOpen(true)}
                >
                    Chi tiết chăm sóc
                </button>
            </section>

            <section className={styles.info}>
                <p className="text_4" style={{ marginBottom: 8 }}>Cập nhật ghi chú</p>
                <button
                    type="button"
                    style={{ background: 'var(--bg-secondary)' }}
                    className={styles.secondaryBtn}
                    onClick={() => setFormOpen(o => !o)}
                >
                    {formOpen ? 'Thu gọn' : 'Hiển thị'}
                </button>

                {formOpen && (
                    <form onSubmit={handleSubmit} className={styles.form} style={{ padding: '12px 0' }}>
                        {[
                            { key: 'care', label: 'Care', ref: firstInputRef },
                            { key: 'studyTry', label: 'Học thử' },
                            { key: 'study', label: 'Nhập học' },
                        ].map(({ key, label, ref }) => (
                            <label key={key} className={styles.formGroup}>
                                {label}
                                <textarea
                                    ref={ref}
                                    rows={2}
                                    value={inputs[key]}
                                    onChange={handleChange(key)}
                                    disabled={saving}
                                />
                            </label>
                        ))}

                        <div style={{ display: 'flex', gap: 8, marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                            <button
                                type="button"
                                onClick={handleToggleCancel}
                                disabled={saving}
                                className={styles.cancelBtn}
                                style={{ backgroundColor: isCancelled ? 'var(--green)' : 'var(--red)' }}
                            >
                                {isCancelled ? 'Bỏ hủy' : 'Hủy bỏ'}
                            </button>

                            <button
                                type="submit"
                                className={styles.saveBtn}
                                disabled={saving}
                            >
                                Lưu thông tin
                            </button>
                        </div>
                    </form>
                )}
            </section>
            {saving && <div className={styles.saving}><Loading /></div>}
        </>
    );

    return (
        <>
            <FlexiblePopup
                open={open}
                key={row?.phone ?? 'no-row'}
                onClose={onClose}
                title="Chi tiết khách hàng"
                size="md"
                renderItemList={() => row ? renderContent() : <Loading content="Đang tải chi tiết…" />}
                secondaryOpen={secondaryOpen}
                onCloseSecondary={() => setSecondaryOpen(false)}
                fetchDataSecondary={() => Data_History_User(row.phone).then(res => res.data)}
                renderSecondaryList={(histories) => renderCareHistory(histories, handleHistoryClick, row.phone)}
                secondaryTitle="Lịch sử chăm sóc"
            />
            <CenterPopup
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                globalZIndex={1001}
                size="md"
            >
                {renderDetailPopup({ selectedHistory, userPhone: row?.phone, onClose: () => setDetailOpen(false) })}
            </CenterPopup>
            <Noti
                open={notiOpen}
                onClose={() => setNotiOpen(false)}
                status={notiStatus}
                mes={notiMes}
                button={
                    <div onClick={() => { if (notiStatus) onSave(); setNotiOpen(false); }} className={styles.saveBtn} style={{ width: 'calc(100% - 52px)', display: 'flex', justifyContent: 'center' }}>
                        Tắt thông báo
                    </div>
                }
            />
        </>
    );
}
