'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FlexiblePopup from '@/components/(features)/(popup)/popup_right';
import Noti from '@/components/(features)/(noti)/noti';
import styles from './index.module.css';
import { Re_user } from '@/data/users';

const renderScheduleForm = ({
    jobName, setJobName,
    actionType, setActionType,
    message, setMessage,
    actionsPerHour, setActionsPerHour,
    maxLimit,
    estimatedTime,
    activeRecipientCount,
    onEditRecipients,
    onSubmit,
    isSubmitting
}) => (
    <div className={styles.formContainer}>
        <div className={styles.formGroup}>
            <p className='text_6'>Tên lịch trình</p>
            <input
                id="jobName" type="text" className="input"
                value={jobName} onChange={(e) => setJobName(e.target.value)}
                placeholder="Ví dụ: Gửi tin khuyến mãi tháng 7"
                disabled={isSubmitting}
            />
        </div>

        <div className={styles.formGroup}>
            <p className='text_6'>Hành động</p>
            <select id="actionType" className="input" value={actionType} onChange={(e) => setActionType(e.target.value)} disabled={isSubmitting}>
                <option value="sendMessage">Gửi tin nhắn</option>
                <option value="addFriend">Gửi lời mời kết bạn</option>
                <option value="findUid">Tìm kiếm UID</option>
            </select>
        </div>

        {actionType === 'sendMessage' && (
            <div className={styles.formGroup}>
                <p className='text_6'>Nội dung tin nhắn</p>
                <textarea
                    id="message" className="input" rows="5" value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Nhập nội dung tin nhắn của bạn..."
                    disabled={isSubmitting}
                />
            </div>
        )}
        <div className={styles.formGroup}>
            <LimitInputRow
                label="Số lượng gửi / giờ:"
                value={actionsPerHour}
                onChange={setActionsPerHour}
                min={1}
                max={maxLimit}
                disabled={isSubmitting}
            />
        </div>
        <div className={styles.summary}>
            <div className={styles.recipientSummary}>
                <p className='text_6_400'>Số người sẽ thực hiện: <strong>{activeRecipientCount} người</strong></p>
                <p className='text_6_400'>Thời gian hoàn thành dự kiến: <strong>~{estimatedTime}</strong></p>
            </div>
            <button className='input' onClick={onEditRecipients} style={{ cursor: 'pointer' }} disabled={isSubmitting}>Chỉnh sửa</button>
        </div>

        <button onClick={onSubmit} className="btn" disabled={isSubmitting} style={{ width: '100%', justifyContent: 'center', borderRadius: 5 }}>
            {isSubmitting ? 'Đang tạo lịch...' : `Bắt đầu lịch trình cho ${activeRecipientCount} người`}
        </button>
    </div>
);

const renderRecipientList = ({ currentRecipients, removedIds, onToggle }) => (
    <div className={styles.recipientListPopup}>
        {currentRecipients.map((customer, index) => {
            const isRemoved = removedIds.has(customer.phone);
            return (
                <div key={index} className={`${styles.recipientItem} ${isRemoved ? styles.removed : ''}`}>
                    <div className={styles.recipientInfo}>
                        <div className={styles.recipientName}>{customer.nameStudent || customer.nameParent}</div>
                        <div className={styles.recipientPhone}>{customer.phone}</div>
                    </div>
                    <button
                        onClick={() => onToggle(customer.phone)}
                        className={`${styles.toggleRecipientBtn} ${isRemoved ? styles.reAdd : styles.remove}`}
                    >
                        {isRemoved ? 'Thêm lại' : 'Bỏ'}
                    </button>
                </div>
            );
        })}
    </div>
);

const LimitInputRow = ({ label, value, onChange, min, max, disabled }) => {
    const handleInputChange = (e) => {
        if (disabled) return;
        const inputValue = e.target.value;
        if (inputValue === '') { onChange(''); return; }
        onChange(Number(inputValue));
    };
    const handleInputBlur = () => {
        if (disabled) return;
        let num = parseInt(value, 10);
        if (isNaN(num) || num < min) { num = min; }
        else if (num > max) { num = max; }
        onChange(num);
    };
    const increment = () => {
        const nextValue = (Number(value) || 0) + 1;
        if (nextValue <= max) onChange(nextValue);
    };
    const decrement = () => {
        const nextValue = (Number(value) || 0) - 1;
        if (nextValue >= min) onChange(nextValue);
    };
    return (
        <div className={styles.limit_row}>
            <p className='text_6'>{label}</p>
            <div className={styles.stepper_container}>
                <button onClick={decrement} className={styles.stepper_btn} disabled={disabled || value <= min}>-</button>
                <input
                    type="number"
                    value={value}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    className={styles.limit_input}
                    disabled={disabled}
                />
                <button onClick={increment} className={styles.stepper_btn} disabled={disabled || value >= max}>+</button>
            </div>
        </div>
    );
};


export default function Schedule({ data, user }) {
    const router = useRouter();
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [isRecipientPopupOpen, setIsRecipientPopupOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [jobName, setJobName] = useState('');
    const [actionType, setActionType] = useState('sendMessage');
    const [message, setMessage] = useState('');
    const [actionsPerHour, setActionsPerHour] = useState(50);
    const [currentRecipients, setCurrentRecipients] = useState([]);
    const [removedIds, setRemovedIds] = useState(() => new Set());
    const [notification, setNotification] = useState({ open: false, status: true, mes: '' });

    const activeRecipients = useMemo(() => {
        return currentRecipients.filter(c => !removedIds.has(c.phone));
    }, [currentRecipients, removedIds]);

    const handleOpenPopup = () => {
        if (!user?.zalo) {
            alert('Lỗi: Bạn phải chọn một tài khoản Zalo trong phần "Cấu hình" trước khi đặt lịch.');
            return;
        }
        if (!data || data.length === 0) {
            alert('Vui lòng chọn ít nhất một khách hàng để đặt lịch.');
            return;
        }
        setCurrentRecipients(data);
        setRemovedIds(new Set());
        setJobName('');
        setMessage('');
        setActionType('sendMessage');
        setActionsPerHour(user.zalo.rateLimitPerHour || 50);
        setIsPopupOpen(true);
    };

    const handleClosePopup = useCallback(() => setIsPopupOpen(false), []);

    const handleToggleRecipient = useCallback((phone) => {
        setRemovedIds(prev => {
            const next = new Set(prev);
            if (next.has(phone)) {
                next.delete(phone);
            } else {
                next.add(phone);
            }
            return next;
        });
    }, []);

    const handleSubmitSchedule = useCallback(async () => {
        setIsSubmitting(true);
        try {
            const scheduleData = {
                jobName: jobName || `Lịch trình cho ${activeRecipients.length} người`,
                actionType,
                config: {
                    messageTemplate: message,
                    actionsPerHour: actionsPerHour,
                },
                zaloAccountId: user.zalo._id,
                tasks: activeRecipients.map(customer => ({
                    person: { name: customer.nameStudent || customer.nameParent, phone: customer.phone }
                }))
            };

            const response = await fetch('/api/runca', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scheduleData)
            });

            const result = await response.json();

            if (result.status !== 2) {
                throw new Error(result.mes || 'Tạo lịch trình thất bại.');
            } else {
                setNotification({ open: true, status: true, mes: result.mes });
                handleClosePopup();
            }
        } catch (error) {
            setNotification({ open: true, status: false, mes: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }, [jobName, actionType, message, actionsPerHour, activeRecipients, user, handleClosePopup]);

    const estimatedTime = useMemo(() => {
        if (!user?.zalo || activeRecipients.length === 0) return '0 phút';
        const totalTasks = activeRecipients.length;
        const hoursNeeded = Math.ceil(totalTasks / actionsPerHour);
        if (hoursNeeded < 1) {
            return `${Math.ceil((totalTasks * 60) / actionsPerHour)} phút`;
        }
        return `${hoursNeeded} giờ`;
    }, [activeRecipients, user, actionsPerHour]);

    const handleCloseNotification = () => {
        setNotification({ ...notification, open: false });
        router.refresh();
        window.location.reload();
    };

    return (
        <>
            <div className="btn" style={{ borderRadius: 5, margin: 0 }} onClick={handleOpenPopup}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" height="16" width="16" fill="white">
                    <path d="M96 32l0 32L48 64C21.5 64 0 85.5 0 112l0 48 448 0 0-48c0-26.5-21.5-48-48-48l-48 0 0-32c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 32L160 64l0-32c0-17.7-14.3-32-32-32S96 14.3 96 32zM448 192L0 192 0 464c0 26.5 21.5 48 48 48l352 0c26.5 0 48-21.5 48-48l0-272zM224 248c13.3 0 24 10.7 24 24l0 56 56 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-56 0 0 56c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-56-56 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l56 0 0-56c0-13.3 10.7-24 24-24z" />
                </svg>
                <p className="text_6" style={{ color: 'white' }}>Đặt lịch trình</p>
            </div>

            <FlexiblePopup
                open={isPopupOpen}
                onClose={handleClosePopup}
                title={`Đặt lịch trình`}
                renderItemList={() => renderScheduleForm({
                    jobName, setJobName,
                    actionType, setActionType,
                    message, setMessage,
                    actionsPerHour, setActionsPerHour,
                    maxLimit: user?.zalo?.rateLimitPerHour || 50,
                    estimatedTime,
                    activeRecipientCount: activeRecipients.length,
                    onEditRecipients: () => setIsRecipientPopupOpen(true),
                    onSubmit: handleSubmitSchedule,
                    isSubmitting
                })}
                secondaryOpen={isRecipientPopupOpen}
                onCloseSecondary={() => setIsRecipientPopupOpen(false)}
                secondaryTitle={`Chỉnh sửa danh sách (${activeRecipients.length}/${currentRecipients.length})`}
                renderSecondaryList={() => renderRecipientList({
                    currentRecipients,
                    removedIds,
                    onToggle: handleToggleRecipient
                })}
            />

            <Noti
                open={notification.open}
                onClose={() => setNotification({ ...notification, open: false })}
                status={notification.status}
                mes={notification.mes}
                button={
                    <div onClick={() => {
                        if (notification.status) {
                            handleCloseNotification();
                        } else {
                            setNotification({ ...notification, open: false })
                        }
                    }} className='btn' style={{ width: 'calc(100% - 24px)', justifyContent: 'center', borderRadius: 5 }}>
                        Tắt thông báo
                    </div>
                }
            />
        </>
    );
}