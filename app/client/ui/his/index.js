'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import FlexiblePopup from '@/components/(features)/(popup)/popup_right';
import CenterPopup from '@/components/(features)/(popup)/popup_center';
import Title from '@/components/(features)/(popup)/title';
import { Data_History } from '@/data/client';
import styles from './index.module.css';

export default function HistoryPopup({ open, onClose, datauser }) {
    const [centerOpen, setCenterOpen] = useState(false);
    const [selectedHistory, setSelected] = useState(null);
    const [showRecipients, setShowRec] = useState(false);
    const [filterText, setFilterText] = useState('');
    const [historyList, setHistoryList] = useState(null);
    useEffect(() => {
        Data_History().then(res => setHistoryList(res.data));
    }, []);
    const handleItemClick = useCallback(h => {
        setSelected(h);
        setShowRec(false);
        setFilterText('');
        setCenterOpen(true);
    }, []);

    const renderItemList = useCallback(histories => (
        <div className={styles.historyList}>
            {histories.map(h => {
                const successCount = h.recipients.filter(r => r.status === 'success').length;
                const errorCount = h.recipients.length - successCount;
                return (
                    <div
                        key={h._id}
                        style={{
                            borderBottom: '1px solid var(--border-color)',
                            padding: 16,
                            cursor: 'pointer'
                        }}
                        onClick={() => handleItemClick(h)}
                    >
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <div className='text_6_400' style={{ padding: '4px 8px', backgroundColor: '#e4ddff', borderRadius: 4 }}>
                                {new Date(h.sentAt).toLocaleString()}
                            </div>
                            <div className='text_6_400' style={{ padding: '4px 8px', backgroundColor: '#f0f0f0', borderRadius: 4 }}>
                                {h.labels.join(', ') || '—'}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 16 }}>
                            <div className='text_6_400' style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
                                {successCount} Thành công
                            </div>
                            <div className='text_6_400' style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' }} />
                                {errorCount} Thất bại
                            </div>
                        </div>
                        <div style={{
                            display: 'flex',
                            gap: 4,
                            paddingTop: 8,
                            borderTop: '1px solid var(--border-color)',
                            marginTop: 8
                        }}>
                            <p className='text_6'>Nội dung:</p>
                            <p style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                margin: 0,
                                flex: 1
                            }} className='text_6_400'>
                                {h.message}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    ), [handleItemClick])
    const filteredRecipients = useMemo(() => {
        if (!selectedHistory) return [];
        return selectedHistory.recipients
            .map(r => {
                const user = datauser.find(u => u.phone === r.phone) || {};
                return { phone: r.phone, name: user.nameParent, status: r.status || '—' };
            })
            .filter(({ name, phone }) =>
                
                name.toLowerCase().includes(filterText.toLowerCase()) ||
                phone.includes(filterText)
            );
    }, [selectedHistory, datauser, filterText]);

    return (
        <>
            <FlexiblePopup
                open={open}
                onClose={onClose}
                data={historyList || []}
                title="Lịch sử gửi tin nhắn"
                renderItemList={renderItemList}
                globalZIndex={1000}
            />
            <CenterPopup
                open={centerOpen}
                onClose={() => setCenterOpen(false)}
                size="md"
                globalZIndex={1001}
            >
                {selectedHistory && (
                    <>
                        <Title
                            content={
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <p>Chi tiết gửi tin</p>
                                    <div className='text_6_400' style={{ padding: '4px 8px', backgroundColor: '#e4ddff', borderRadius: 4 }}>
                                        {new Date(selectedHistory.sentAt).toLocaleString()}
                                    </div>
                                </div>
                            }
                            click={() => setCenterOpen(false)}
                        />
                        <div style={{ padding: 16 }}>
                            <p className='text_6' style={{
                                paddingBottom: 8
                            }}>Nhãn gán tin nhắn:</p>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div className='text_6_400' style={{ padding: '4px 8px', backgroundColor: '#f0f0f0', borderRadius: 4 }}>
                                        {selectedHistory.labels.join(', ') || '—'}
                                    </div>
                                </div>
                            </div>
                            <p className='text_6' style={{
                                borderTop: 'thin solid var(--border-color)',
                                padding: '8px 0'
                            }}>Nội dung gửi đi:</p>
                            <p className='text_6_400'
                                style={{
                                    margin: 0,
                                    flex: 1,
                                    marginBottom: 16
                                }}>
                                {selectedHistory.message}
                            </p>
                            <p className='text_6' style={{
                                borderTop: 'thin solid var(--border-color)',
                                padding: '8px 0'
                            }}>
                                Chi tiết từng người nhận:
                            </p>

                            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                                <div className='text_6_400' style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
                                    {selectedHistory.recipients.filter(r => r.status === 'success').length} Thành công
                                </div>
                                <div className='text_6_400' style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' }} />
                                    {selectedHistory.recipients.length - selectedHistory.recipients.filter(r => r.status === 'success').length} Thất bại
                                </div>
                                <button
                                    type="button"
                                    className={styles.toggleButton}
                                    onClick={() => setShowRec(v => !v)}
                                >
                                    <p className='text_6_400'>{showRecipients ? 'Ẩn người nhận' : 'Hiển thị tất cả'}</p>
                                </button>
                            </div>
                            {showRecipients && <div style={{ border: 'thin solid var(--border-color)', padding: '8px', borderRadius: 12 }}>
                                <input
                                    type="text"
                                    className={'input'}
                                    style={{ width: 'calc(100% - 24px)', marginBottom: 8 }}
                                    placeholder="Tìm theo tên hoặc số..."
                                    value={filterText}
                                    onChange={e => setFilterText(e.target.value)}
                                />

                                <ul className={styles.recipientList}>
                                    {filteredRecipients.map((u, idx) => {
                                        return (
                                            <li key={idx} className={`${styles.recipientItem} text_6_400`}>
                                                <p>
                                                    {u.name} — {u.phone}
                                                </p>
                                                <div>{u.status === 'success' ?
                                                    <p style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} /> :
                                                    <p style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} />}</div>
                                            </li>
                                        )
                                    })}
                                    {filteredRecipients.length === 0 && (
                                        <li className={`${styles.noResults} text_6_400`}>
                                            Không tìm thấy người phù hợp
                                        </li>
                                    )}
                                </ul>

                            </div>}

                        </div>
                    </>
                )}
            </CenterPopup>
        </>
    );
}
