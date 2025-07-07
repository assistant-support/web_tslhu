'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FlexiblePopup from '@/components/(features)/(popup)/popup_right';
import Noti from '@/components/(features)/(noti)/noti';
import styles from './index.module.css';

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

const ScheduleForm = ({
    jobName, setJobName, actionType, setActionType, message, setMessage,
    actionsPerHour, setActionsPerHour, activeRecipientCount, labels,
    selectedLabelId, onLabelChange, onSubmit, isSubmitting, onEditRecipients,
    estimatedTime, maxLimit
}) => (
    <div className={styles.formContainer}>
        <div className={styles.formGroup}>
            <p className='text_6'>Tên lịch trình</p>
            <input
                id="jobName" type="text" className="input" value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="Ví dụ: Gửi tin khuyến mãi tháng 7" disabled={isSubmitting}
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
            <>
                <div className={styles.formGroup}>
                    <p className='text_6'>Chọn nhãn (Tùy chọn)</p>
                    <select id="labelSelect" className="input" value={selectedLabelId} onChange={onLabelChange} disabled={isSubmitting}>
                        <option value="">-- Chọn nhãn có sẵn --</option>
                        {labels.map(label => (<option key={label._id} value={label._id}>{label.title}</option>))}
                    </select>
                </div>
                <div className={styles.formGroup}>
                    <p className='text_6'>Nội dung tin nhắn</p>
                    <textarea
                        id="message" className="input" rows="5" value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Nhập nội dung hoặc chọn một nhãn ở trên..." disabled={isSubmitting}
                    />
                </div>
            </>
        )}
        {/* ĐÃ BỔ SUNG LẠI INPUT CHỌN SỐ HÀNH ĐỘNG / GIỜ */}
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
            <div className={styles.summaryInfo}>
                <p className='text_6_400'>Số người thực hiện: <strong>{activeRecipientCount} người</strong></p>
                <p className='text_6_400'>Thời gian hoàn thành: <strong>~{estimatedTime}</strong></p>
            </div>
            <button className='input' onClick={onEditRecipients} style={{ cursor: 'pointer' }} disabled={isSubmitting}>Chỉnh sửa</button>
        </div>
        <button onClick={onSubmit} className="btn" disabled={isSubmitting} style={{ width: '100%', justifyContent: 'center', borderRadius: 5, marginTop: 16 }}>
            {isSubmitting ? 'Đang tạo lịch...' : `Bắt đầu lịch trình`}
        </button>
    </div>
);

const RecipientList = ({ recipients, removedIds, onToggle }) => (
    <div className={styles.recipientListPopup}>
        {recipients.map((customer, index) => {
            const isRemoved = removedIds.has(customer.phone);
            return (
                <div key={index} className={`${styles.recipientItem} ${isRemoved ? styles.removed : ''}`}>
                    <div className={styles.recipientInfo}>
                        <div className={styles.recipientName}>{customer.name}</div>
                        <div className={styles.recipientPhone}>{customer.phone}</div>
                    </div>
                    <button onClick={() => onToggle(customer.phone)} className={`${styles.toggleRecipientBtn} ${isRemoved ? styles.reAdd : styles.remove}`}>
                        {isRemoved ? 'Thêm lại' : 'Bỏ'}
                    </button>
                </div>
            );
        })}
    </div>
);

export default function Schedule({ data, user, label: labelsFromProps }) {
    const router = useRouter();
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [isRecipientPopupOpen, setIsRecipientPopupOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [jobName, setJobName] = useState('');
    const [actionType, setActionType] = useState('sendMessage');
    const [message, setMessage] = useState('');
    const [actionsPerHour, setActionsPerHour] = useState(50);
    const [selectedLabelId, setSelectedLabelId] = useState('');
    const [currentRecipients, setCurrentRecipients] = useState([]);
    const [removedIds, setRemovedIds] = useState(() => new Set());
    const [notification, setNotification] = useState({ open: false, status: true, mes: '' });

    const availableLabels = useMemo(() => labelsFromProps || [], [labelsFromProps]);
    const activeRecipients = useMemo(() => currentRecipients.filter(c => !removedIds.has(c.phone)), [currentRecipients, removedIds]);

    const estimatedTime = useMemo(() => {
        if (activeRecipients.length === 0 || !actionsPerHour || actionsPerHour <= 0) return '0 phút';
        const totalTasks = activeRecipients.length;
        const hoursNeeded = totalTasks / actionsPerHour;
        if (hoursNeeded < 1) {
            const minutesNeeded = Math.ceil(hoursNeeded * 60);
            return `${minutesNeeded} phút`;
        }
        return `${Math.ceil(hoursNeeded)} giờ`;
    }, [activeRecipients.length, actionsPerHour]);

    const handleOpenPopup = useCallback(() => {
        if (!user?.zalo) return alert('Lỗi: Bạn phải chọn một tài khoản Zalo trong phần "Cấu hình" trước.');
        if (!data || data.length === 0) return alert('Vui lòng chọn ít nhất một khách hàng để đặt lịch.');

        setCurrentRecipients(data);
        setRemovedIds(new Set());
        setJobName('');
        setMessage('');
        setActionType('sendMessage');
        setSelectedLabelId('');
        setActionsPerHour(user?.zalo?.rateLimitPerHour || 50);
        setIsPopupOpen(true);
    }, [data, user]);

    const handleClosePopup = useCallback(() => setIsPopupOpen(false), []);
    const handleCloseNotification = useCallback(() => setNotification(prev => ({ ...prev, open: false })), []);

    const handleToggleRecipient = useCallback((phone) => {
        setRemovedIds(prev => {
            const next = new Set(prev);
            next.has(phone) ? next.delete(phone) : next.add(phone);
            return next;
        });
    }, []);

    const handleLabelChange = useCallback((e) => {
        const labelId = e.target.value;
        setSelectedLabelId(labelId);
        const selectedLabel = availableLabels.find(l => l._id === labelId);
        setMessage(selectedLabel ? selectedLabel.content || '' : '');
    }, [availableLabels]);

    const handleSubmitSchedule = useCallback(async () => {
        if (activeRecipients.length === 0) return alert('Không có người nhận nào được chọn.');

        setIsSubmitting(true);
        try {
            const scheduleData = {
                jobName: jobName || `Lịch trình ngày ${new Date().toLocaleDateString('vi-VN')}`,
                actionType,
                config: { messageTemplate: message, actionsPerHour },
                zaloAccountId: user.zalo._id,
                tasks: activeRecipients.map(c => ({ person: { name: c.name, phone: c.phone, uid: c.uid } }))
            };
            const response = await fetch('/api/runca', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scheduleData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.mes || 'Tạo lịch trình thất bại.');

            setNotification({ open: true, status: true, mes: result.mes || 'Tạo lịch trình thành công!' });
            handleClosePopup();
            router.refresh();
        } catch (error) {
            setNotification({ open: true, status: false, mes: error.message });
        } finally {
            setIsSubmitting(false);
        }
    }, [jobName, actionType, message, actionsPerHour, activeRecipients, user, handleClosePopup, router]);

    return (
        <>
            <div className="btn" style={{ borderRadius: 5, margin: 0 }} onClick={handleOpenPopup}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" height="16" width="16" fill="white"><path d="M96 32l0 32L48 64C21.5 64 0 85.5 0 112l0 48 448 0 0-48c0-26.5-21.5-48-48-48l-48 0 0-32c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 32L160 64l0-32c0-17.7-14.3-32-32-32S96 14.3 96 32zM448 192L0 192 0 464c0 26.5 21.5 48 48 48l352 0c26.5 0 48-21.5 48-48l0-272zM224 248c13.3 0 24 10.7 24 24l0 56 56 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-56 0 0 56c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-56-56 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l56 0 0-56c0-13.3 10.7-24 24-24z" /></svg>
                <p className="text_6" style={{ color: 'white' }}>Đặt lịch trình</p>
            </div>

            <FlexiblePopup
                open={isPopupOpen}
                onClose={handleClosePopup}
                title={`Đặt lịch trình cho ${activeRecipients.length} người`}
                renderItemList={() => (
                    <ScheduleForm
                        jobName={jobName} setJobName={setJobName}
                        actionType={actionType} setActionType={setActionType}
                        message={message} setMessage={setMessage}
                        actionsPerHour={actionsPerHour} setActionsPerHour={setActionsPerHour}
                        activeRecipientCount={activeRecipients.length}
                        labels={availableLabels}
                        selectedLabelId={selectedLabelId}
                        onLabelChange={handleLabelChange}
                        onSubmit={handleSubmitSchedule}
                        isSubmitting={isSubmitting}
                        onEditRecipients={() => setIsRecipientPopupOpen(true)}
                        estimatedTime={estimatedTime}
                        maxLimit={user?.zalo?.rateLimitPerHour || 50}
                    />
                )}
                secondaryOpen={isRecipientPopupOpen}
                onCloseSecondary={() => setIsRecipientPopupOpen(false)}
                secondaryTitle={`Chỉnh sửa danh sách (${activeRecipients.length}/${currentRecipients.length})`}
                renderSecondaryList={() => (
                    <RecipientList
                        recipients={currentRecipients}
                        removedIds={removedIds}
                        onToggle={handleToggleRecipient}
                    />
                )}
            />

            <Noti
                open={notification.open}
                onClose={handleCloseNotification}
                status={notification.status}
                mes={notification.mes}
            />
        </>
    );
}