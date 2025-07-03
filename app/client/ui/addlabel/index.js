'use client';

import React, { useCallback, useState } from 'react';
import styles from './index.module.css';
import Loading from '@/components/(ui)/(loading)/loading';
import Noti from '@/components/(features)/(noti)/noti';                // ⬅ thay đường dẫn nếu cần
import { Re_Label } from '@/data/client';

export default function AddLabelButton({ onCreated }) {
    /* -------- local state -------- */
    const [open, setOpen] = useState(false);              // modal form
    const [loading, setLoading] = useState(false);        // spinner form
    const [form, setForm] = useState({                    // form fields
        title: '',
        content: '',
        desc: '',
    });

    /* -------- Noti state -------- */
    const [showNoti, setShowNoti] = useState(false);
    const [notiStatus, setNotiStatus] = useState(false);  // true = success
    const [notiMes, setNotiMes] = useState('');

    /* -------- handlers -------- */
    const handleChange = useCallback(
        (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value })),
        [],
    );

    /** Đóng modal + reset form */
    const closeForm = useCallback(() => {
        setOpen(false);
        setForm({ title: '', content: '', desc: '' });
    }, []);

    /** Đóng thông báo */
    const closeNoti = useCallback(() => setShowNoti(false), []);

    /** Lưu nhãn */
    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/label', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            const json = await res.json();                // { status, data, mes }
            const isSuccess = json.status === 2;

            /* ----- hiển thị thông báo ----- */
            setNotiStatus(isSuccess);
            setNotiMes(json.mes || (isSuccess ? 'Thành công!' : 'Thất bại!'));
            setShowNoti(true);

            /* ----- hành động khi thành công ----- */
            if (isSuccess) {
                Re_Label()
                closeForm();
                onCreated?.();                            // reload list
            }
        } catch (err) {
            console.error('[LABEL_ADD]', err);

            setNotiStatus(false);
            setNotiMes('Không kết nối được máy chủ!');
            setShowNoti(true);
        } finally {
            setLoading(false);
        }
    };

    /* ------------------------------------------------------------------ */
    /* -----------------------------  RENDER ---------------------------- */
    /* ------------------------------------------------------------------ */
    return (
        <>
            {/* ===== Chip mở form ===== */}
            <button
                className={`${styles.chip} ${styles.addChip}`}
                onClick={() => setOpen(true)}
                title="Thêm nhãn mới"
            >
                + Nhãn
            </button>

            {/* ===== Form Modal ===== */}
            {open && (
                <div className={styles.backdrop} onClick={closeForm}>
                    <div
                        className={styles.modal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div
                            style={{
                                padding: 16,
                                borderBottom: 'thin solid var(--border-color)',
                            }}
                        >
                            <p className="text_4">Thêm nhãn mới</p>
                        </div>

                        {/* Overlay spinner */}
                        {loading && (
                            <div className={styles.loadingOverlay}>
                                <Loading />
                            </div>
                        )}

                        {/* Form */}
                        <form className={styles.form} onSubmit={handleSave}>
                            <label className={styles.group}>
                                Tiêu đề
                                <input
                                    required
                                    value={form.title}
                                    onChange={handleChange('title')}
                                    placeholder="Tiêu đề nhãn"
                                    className={styles.input}
                                    disabled={loading}
                                />
                            </label>

                            <label className={styles.group}>
                                Miêu tả
                                <textarea
                                    rows={3}
                                    value={form.desc}
                                    onChange={handleChange('desc')}
                                    placeholder="Mô tả ngắn (tuỳ chọn)…"
                                    className={styles.input}
                                    disabled={loading}
                                />
                            </label>

                            <label className={styles.group}>
                                Nội dung
                                <textarea
                                    rows={3}
                                    value={form.content}
                                    onChange={handleChange('content')}
                                    placeholder="Nội dung…"
                                    className={styles.input}
                                    disabled={loading}
                                />
                            </label>

                            <div className={styles.actions}>
                                <button
                                    type="button"
                                    className={styles.btnCancel}
                                    onClick={closeForm}
                                    disabled={loading}
                                >
                                    Huỷ
                                </button>
                                <button
                                    type="submit"
                                    className={styles.btnSave}
                                    disabled={loading}
                                >
                                    {loading ? 'Đang lưu…' : 'Lưu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== Thông báo kết quả ===== */}
            <Noti
                open={showNoti}
                onClose={closeNoti}
                status={notiStatus}   /* true nếu status === 2 */
                mes={notiMes}
                button={
                    <button
                        className={styles.button}
                        onClick={closeNoti}
                    >
                        Tắt thông báo
                    </button>
                }
            />
        </>
    );
}
