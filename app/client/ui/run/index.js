'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './index.module.css';
import FlexiblePopup from '@/components/(features)/(popup)/popup_right';
import { Get_user } from '@/data/users'; // Import hàm lấy dữ liệu

const renderRecipientListPopup = ({ job, removedIds, onToggleTask }) => (
    <div className={styles.taskList}>
        {job.tasks.map(task => {
            const isRemoved = removedIds.has(task._id);
            const isProcessed = task.status !== 'pending';
            return (
                <div key={task._id} className={`${styles.taskItem} ${isRemoved ? styles.removed : ''} ${isProcessed ? styles.processed : ''}`}>
                    <div className={styles.taskInfo}>
                        <span className={styles.taskName}>{task.person.name}</span>
                        <span className={styles.taskStatus}>{isProcessed ? `Đã ${task.status}` : 'Đang chờ'}</span>
                    </div>
                    <button
                        onClick={() => onToggleTask(task._id)}
                        className={`${styles.toggleTaskBtn} ${isRemoved ? styles.reAdd : styles.remove}`}
                        disabled={isProcessed}
                    >
                        {isRemoved ? 'Thêm lại' : 'Bỏ'}
                    </button>
                </div>
            );
        })}
    </div>
);

const renderDetailPopupContent = ({ job, onEditRecipients, onSave, onStop, isSubmitting, timeLeft }) => {
    const stats = job.statistics;
    const successRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
    const failureRate = stats.total > 0 ? (stats.failed / stats.total) * 100 : 0;

    return (
        <div className={styles.popupContainer}>
            <div className={styles.popupGroup}>
                <p className={styles.popupLabel}>Tên lịch trình</p>
                <p className={styles.popupValue}>{job.jobName}</p>
            </div>
            <div className={styles.popupGroup}>
                <p className={styles.popupLabel}>Thông tin chung</p>
                <div className={styles.statGrid}>
                    <div>
                        <span className={styles.statTitle}>Trạng thái</span>
                        <span className={`${styles.statValue} ${styles.statusProcessing}`}>{job.status}</span>
                    </div>
                    <div>
                        <span className={styles.statTitle}>Hành động</span>
                        <span className={styles.statValue}>{job.actionType}</span>
                    </div>
                    <div>
                        <span className={styles.statTitle}>Tốc độ</span>
                        <span className={styles.statValue}>{job.config.actionsPerHour} / giờ</span>
                    </div>
                </div>
            </div>
            <div className={styles.popupGroup}>
                <p className={styles.popupLabel}>Tiến độ & Tỉ lệ</p>
                <div className={styles.statGrid}>
                    <div>
                        <span className={styles.statTitle}>Hoàn thành</span>
                        <span className={styles.statValue}>{stats.completed} / {stats.total}</span>
                    </div>
                    <div>
                        <span className={styles.statTitle}>Thất bại</span>
                        <span className={styles.statValue}>{stats.failed}</span>
                    </div>
                    <div>
                        <span className={styles.statTitle}>Thành công</span>
                        <span className={`${styles.statValue} ${styles.successRate}`}>{successRate.toFixed(1)}%</span>
                    </div>
                    <div>
                        <span className={styles.statTitle}>Thất bại</span>
                        <span className={`${styles.statValue} ${styles.failureRate}`}>{failureRate.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
            <div className={styles.popupGroup}>
                <p className={styles.popupLabel}>Thời gian</p>
                <div className={styles.statGrid}>
                    <div>
                        <span className={styles.statTitle}>Bắt đầu</span>
                        <span className={styles.statValue}>{new Date(job.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                    <div>
                        <span className={styles.statTitle}>Dự kiến xong</span>
                        <span className={styles.statValue}>{new Date(job.estimatedCompletionTime).toLocaleString('vi-VN')}</span>
                    </div>
                    <div>
                        <span className={styles.statTitle}>Còn lại</span>
                        <span className={styles.statValue}>{timeLeft}</span>
                    </div>
                </div>
            </div>
            <div className={styles.popupGroup}>
                <div className={styles.recipientSummary}>
                    <p className={styles.popupLabel}>Danh sách người nhận</p>
                    <button className={styles.editRecipientsBtn} onClick={onEditRecipients}>Chỉnh sửa</button>
                </div>
            </div>
            <div className={styles.popupActions}>
                <button onClick={onStop} className={`${styles.actionButton} ${styles.stopButton}`} disabled={isSubmitting}>
                    Dừng & Hủy
                </button>
                <button onClick={onSave} className={`btn`} disabled={isSubmitting} style={{ borderRadius: 5, margin: 0, transform: 'none' }}>
                    {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
            </div>
        </div>
    );
};

export default function Run() {
    const [userData, setUserData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState('');
    const [isDetailPopupOpen, setIsDetailPopupOpen] = useState(false);
    const [isRecipientPopupOpen, setIsRecipientPopupOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [removedTaskIds, setRemovedTaskIds] = useState(() => new Set());

    const { runningJob } = userData || {};

    const fetchData = useCallback(async () => {
        try {
            const data = await Get_user();
            setUserData(data);
        } catch (error) {
            console.error("Failed to fetch user data:", error);
            setUserData(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(); // Gọi lần đầu khi component mount
        const intervalId = setInterval(fetchData, 60000); // Thiết lập lặp lại mỗi 60 giây
        return () => clearInterval(intervalId); // Dọn dẹp interval khi component unmount
    }, [fetchData]);

    useEffect(() => {
        if (!runningJob?.estimatedCompletionTime) return;
        const timer = setInterval(() => {
            const difference = +new Date(runningJob.estimatedCompletionTime) - +new Date();
            let timeLeftString = "Hoàn thành";
            if (difference > 0) {
                const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((difference / 1000 / 60) % 60);
                timeLeftString = hours > 0 ? `~ ${hours}h ${minutes}m` : `~ ${minutes} phút`;
            }
            setTimeLeft(timeLeftString);
        }, 1000);
        return () => clearInterval(timer);
    }, [runningJob?.estimatedCompletionTime]);

    const handleOpenDetailPopup = useCallback(() => {
        if (runningJob) {
            setRemovedTaskIds(new Set());
            setIsDetailPopupOpen(true);
        }
    }, [runningJob]);

    const handleToggleTask = useCallback((taskId) => {
        setRemovedTaskIds(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    }, []);

    const handleUpdateJob = useCallback(async () => {
        if (removedTaskIds.size === 0) {
            setIsDetailPopupOpen(false);
            return;
        }
        setIsSubmitting(true);
        console.log("Lưu thay đổi, các task ID cần xóa:", Array.from(removedTaskIds));
        await new Promise(r => setTimeout(r, 1000));
        setIsSubmitting(false);
        setIsDetailPopupOpen(false);
        fetchData(); // Tải lại dữ liệu sau khi cập nhật
    }, [removedTaskIds, fetchData]);

    const handleStopJob = useCallback(async () => {
        setIsSubmitting(true);
        console.log("Dừng lịch trình:", runningJob._id);
        await new Promise(r => setTimeout(r, 1000));
        setIsSubmitting(false);
        setIsDetailPopupOpen(false);
        fetchData();
    }, [runningJob, fetchData]);

    const truncatedJobName = useMemo(() => {
        const name = runningJob?.jobName || '';
        return name.length > 15 ? `${name.substring(0, 15)}...` : name;
    }, [runningJob?.jobName]);

    const progressStats = useMemo(() => {
        if (!runningJob?.statistics) return { completed: 0, total: 0 };
        return runningJob.statistics;
    }, [runningJob?.statistics]);

    if (isLoading) {
        return <div className={styles.loadingState}>Đang tải thông tin lịch trình...</div>;
    }

    if (!runningJob) {
        return null;
    }

    return (
        <>
            <div style={{ display: 'flex' }}>
                <div className={styles.container}>
                    <div className={styles.loadingContainer}>
                        <div className={styles.spinner} />
                    </div>
                    <div className={styles.jobInfo}>
                        <span className={styles.jobName} title={runningJob.jobName}>{truncatedJobName}</span>
                        <span className={styles.progressText}>({progressStats.completed}/{progressStats.total})</span>
                    </div>
                    <div className={styles.timeLeft}>
                        {timeLeft}
                    </div>
                </div>
                <button className={styles.updateButton} onClick={handleOpenDetailPopup}>
                    <p className='text_6_400'>Chi tiết</p>
                </button>
            </div>

            <FlexiblePopup
                open={isDetailPopupOpen}
                onClose={() => setIsDetailPopupOpen(false)}
                title="Chi tiết lịch trình"
                width={450}
                renderItemList={() => renderDetailPopupContent({
                    job: runningJob,
                    onEditRecipients: () => setIsRecipientPopupOpen(true),
                    onSave: handleUpdateJob,
                    onStop: handleStopJob,
                    isSubmitting,
                    timeLeft
                })}
                secondaryOpen={isRecipientPopupOpen}
                onCloseSecondary={() => setIsRecipientPopupOpen(false)}
                secondaryTitle="Chỉnh sửa danh sách người nhận"
                renderSecondaryList={() => renderRecipientListPopup({
                    job: runningJob,
                    removedIds: removedTaskIds,
                    onToggleTask: handleToggleTask
                })}
            />
        </>
    );
}