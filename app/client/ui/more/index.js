'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import FlexiblePopup from '@/components/(features)/(popup)/popup_right';
import CenterPopup from '@/components/(features)/(popup)/popup_center';
import Loading from '@/components/(ui)/(loading)/loading';
import { Data_History_User, Re_Client } from '@/data/client';
import Noti from '@/components/(features)/(noti)/noti';
import styles from './index.module.css';
import Title from '@/components/(features)/(popup)/title';


export default function SidePanel({ open, row, labels = [], onClose, onSave }) {
    const firstInputRef = useRef(null);
    const [inputs, setInputs] = useState({ care: '', studyTry: '', study: '' });
    const [saving, setSaving] = useState(false);
    const [secondaryOpen, setSecondaryOpen] = useState(false);
    const [formOpen, setFormOpen] = useState(true);

    // State cho popup chi tiết lịch sử
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedHistory, setSelectedHistory] = useState(null);

    // State cho Noti
    const [notiOpen, setNotiOpen] = useState(false);
    const [notiStatus, setNotiStatus] = useState(false);
    const [notiMes, setNotiMes] = useState('');

    // Kiểm tra xem khách hàng đã hủy chưa
    const isCancelled = row?.remove && row.remove.trim() !== '';

    /* Close on ESC */
    useEffect(() => {
        const handleEsc = e => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    /* Sync inputs khi row thay đổi */
    useEffect(() => {
        if (row) {
            setInputs({
                care: row.care ?? '',
                studyTry: row.studyTry ?? '',
                study: row.study ?? '',
            });
        }
    }, [row]);

    /* Focus first textarea khi form mở */
    useEffect(() => {
        if (open && formOpen) {
            const t = setTimeout(() => firstInputRef.current?.focus(), 300);
            return () => clearTimeout(t);
        }
    }, [open, formOpen]);

    const handleChange = key => e =>
        setInputs(prev => ({ ...prev, [key]: e.target.value }));

    /* Toggle hủy / bỏ hủy */
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
            console.error(err);
            setNotiStatus(false);
            setNotiMes(isCancelled
                ? 'Bỏ hủy thất bại!'
                : 'Hủy đăng ký thất bại!');
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
            console.error(err);
            setNotiStatus(false);
            setNotiMes('Cập nhật thất bại!');
            setNotiOpen(true);
        } finally {
            setSaving(false);
        }
    };

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
                {/* <InfoRow label="Số lần chăm sóc" value={12} /> */}
                <InfoRow label="Giai đoạn chăm sóc" value={row?.source} />
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
                <p className="text_4" style={{ marginBottom: 8 }}>Cập nhật giai đoạn chăm sóc</p>
                <button
                    type="button"
                    style={{ background: 'var(--bg-secondary)' }}
                    className={styles.secondaryBtn}
                    onClick={() => setFormOpen(o => !o)}
                >
                    {formOpen ? 'Thu gọn cập nhật' : 'Hiển thị cập nhật'}
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

                        <div style={{
                            display: 'flex',
                            gap: 8,
                            marginTop: 16,
                            borderTop: '1px solid var(--border-color)',
                            paddingTop: 12,
                        }}>
                            <button
                                type="button"
                                onClick={handleToggleCancel}
                                disabled={saving}
                                className={styles.saveBtn}
                                style={{
                                    backgroundColor: isCancelled ? 'var(--green)' : 'var(--red)',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width={14} height={14} fill="white">
                                    <path d="M135.2 17.7C140.6 6.8 151.7 0 163.8 0L284.2 0c12.1 0 23.2 6.8 28.6 17.7L320 32l96 0c17.7 0
                                        32 14.3 32 32s-14.3 32-32 32L32 96C14.3 96 0 81.7 0 64S14.3 32 32 32l96 0 7.2-14.3zM32 128l384 0
                                        0 320c0 35.3-28.7 64-64 64L96 512c-35.3 0-64-28.7-64-64l0-320zm96 64c-8.8 0-16 7.2-16 16l0 224
                                        c0 8.8 7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16l0 224c0 8.8
                                        7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16zm96 0c-8.8 0-16 7.2-16 16l0 224c0 8.8
                                        7.2 16 16 16s16-7.2 16-16l0-224c0-8.8-7.2-16-16-16z"/>
                                </svg>
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

            {saving && (
                <div className={styles.saving}>
                    <Loading />
                </div>
            )}
        </>
    );

    const renderCareHistory = useCallback(histories => {
        if (!histories.length) {
            return <div className={styles.emptyHistory}>Chưa có lịch sử chăm sóc</div>;
        }
        return (
            <div className={styles.moreInfo}>
                <ul className={styles.historyList}>
                    {histories.map(h => (
                        <li key={h._id} style={{ listStyle: 'none' }}>
                            <div
                                style={{
                                    borderBottom: '1px solid var(--border-color)',
                                    padding: 16,
                                    cursor: 'pointer'
                                }}
                                onClick={() => {
                                    setSelectedHistory(h);
                                    setDetailOpen(true);
                                }}
                            >
                                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                    <div className="text_6_400" style={{
                                        padding: '4px 8px',
                                        backgroundColor: '#e4ddff',
                                        borderRadius: 4
                                    }}>
                                        {new Date(h.sentAt).toLocaleString()}
                                    </div>
                                    <div className="text_6_400" style={{
                                        padding: '4px 8px',
                                        backgroundColor: '#f0f0f0',
                                        borderRadius: 4
                                    }}>
                                        {h.labels.join(', ') || '—'}
                                    </div>
                                </div>
                                <div className="text_6_400" style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <span style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: 'var(--green)'
                                    }} />
                                    Thành công
                                </div>
                                <div style={{
                                    display: 'flex',
                                    gap: 4,
                                    paddingTop: 8,
                                    borderTop: '1px solid var(--border-color)',
                                    marginTop: 8
                                }}>
                                    <p className="text_6">Nội dung:</p>
                                    <p className="text_6_400" style={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        margin: 0,
                                        flex: 1
                                    }}>
                                        {h.message}
                                    </p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }, []);

    return (
        <>
            <FlexiblePopup
                open={open}
                key={row?.phone ?? 'no-row'}
                onClose={onClose}
                title="Chi tiết khách hàng"
                size="md"
                renderItemList={() =>
                    row ? renderContent() : <Loading content="Đang tải chi tiết…" />
                }
                secondaryOpen={secondaryOpen}
                onCloseSecondary={() => setSecondaryOpen(false)}
                fetchDataSecondary={() =>
                    Data_History_User(row.phone).then(res => res.data)
                }
                renderSecondaryList={renderCareHistory}
                secondaryTitle="Lịch sử chăm sóc"
            />

            <CenterPopup
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                globalZIndex={1001}
            >
                {selectedHistory ? (
                    <>
                        <Title
                            content={
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <p>Chi tiết gửi tin</p>
                                    <div className="text_6_400" style={{
                                        padding: '4px 8px',
                                        backgroundColor: '#e4ddff',
                                        borderRadius: 4
                                    }}>
                                        {new Date(selectedHistory.sentAt).toLocaleString()}
                                    </div>
                                    <div className="text_6_400" style={{
                                        padding: '4px 8px',
                                        backgroundColor: selectedHistory.recipients[0].status === 'success'
                                            ? 'var(--green)' : 'var(--red)',
                                        color: 'white',
                                        borderRadius: 4
                                    }}>
                                        {selectedHistory.recipients[0].status === 'success'
                                            ? 'Thành công' : 'Thất bại'}
                                    </div>
                                </div>
                            }
                            click={() => setDetailOpen(false)}
                        />
                        <div style={{ padding: 16 }}>
                            <p className="text_6" style={{ paddingBottom: 8 }}>
                                Nhãn gán tin nhắn:
                            </p>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div className="text_6_400" style={{
                                        padding: '4px 8px',
                                        backgroundColor: '#f0f0f0',
                                        borderRadius: 4
                                    }}>
                                        {selectedHistory.labels.join(', ') || '—'}
                                    </div>
                                </div>
                            </div>
                            <p className="text_6" style={{
                                borderTop: 'thin solid var(--border-color)',
                                padding: '8px 0'
                            }}>
                                Nội dung gửi đi:
                            </p>
                            <p className="text_6_400" style={{
                                margin: 0,
                                flex: 1,
                                marginBottom: 16
                            }}>
                                {selectedHistory.message}
                            </p>
                        </div>
                    </>
                ) : (
                    <Loading content="Đang tải chi tiết…" />
                )}
            </CenterPopup>

            <Noti
                open={notiOpen}
                onClose={() => setNotiOpen(false)}
                status={notiStatus}
                mes={notiMes}
                button={
                    <div
                        style={{
                            width: 'calc(100% - 52px)',
                            display: 'flex',
                            justifyContent: 'center'
                        }}
                        className={styles.saveBtn}
                        onClick={() => {
                            if (notiStatus) {
                                onSave();
                            }
                            setNotiOpen(false)
                        }}
                    >
                        Tắt thông báo
                    </div>
                }
            />
        </>
    );
}

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
