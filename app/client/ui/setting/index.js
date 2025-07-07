'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Svg_Setting } from '@/components/(icon)/svg';
import FlexiblePopup from '@/components/(features)/(popup)/popup_right';
import Noti from '@/components/(features)/(noti)/noti';
import styles from './index.module.css';
import TextNoti from '@/components/(features)/(noti)/textnoti';
import { Data_account, Re_acc } from '@/data/users';
import Loading from '@/components/(ui)/(loading)/loading';

const renderAddAccountForm = ({ newToken, setNewToken, onSubmit, onBack, error, isSubmitting }) => (
    <div className={styles.add_account_form_container}>
        <TextNoti
            title='Nhập token tài khoản'
            mes="Phải dán đầy đủ token của tài khoản vào, sau bước kiểm tra của hệ thống mới có thể sử dụng!"
        />
        <textarea
            className='input'
            style={{ height: 300, resize: 'vertical' }}
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            placeholder='{"client_version":"...", "cookies":"...", ...}'
            disabled={isSubmitting}
        />
        {error && <p className={styles.form_error}>{error}</p>}
        <div className={styles.form_actions}>
            <button onClick={onBack} className='input' style={{ padding: 8, cursor: 'pointer' }} disabled={isSubmitting}>Quay lại</button>
            <button onClick={onSubmit} className='btn' style={{ padding: 8, margin: 0, transform: 'none', borderRadius: 5 }} disabled={isSubmitting}>
                {isSubmitting ? 'Đang thêm...' : 'Thêm tài khoản'}
            </button>
        </div>
    </div>
);

const renderAccountList = ({ accounts, selectedAccountId, onSelect, onDeselect, onAddClick, isSubmitting }) => {
    const selectedAccount = accounts.find(acc => acc.uid === selectedAccountId);
    const availableAccounts = accounts.filter(acc => acc.uid !== selectedAccountId);

    return (
        <div className={styles.account_list_container}>
            <div className={styles.current_selection_section}>
                <h4 className={styles.section_title}>Tài khoản đang sử dụng</h4>
                {selectedAccount ? (
                    <div className={`${styles.account_item} ${styles.selected_item}`}>
                        <img src={selectedAccount.avt} alt={selectedAccount.name} className={styles.account_avatar} />
                        <div className={styles.account_info}>
                            <span className={styles.account_name}>{selectedAccount.name}</span>
                            <span className={styles.account_phone}>{selectedAccount.phone}</span>
                        </div>
                        <button onClick={() => onDeselect()} className={styles.deselect_btn} disabled={isSubmitting}>Bỏ chọn</button>
                    </div>
                ) : (
                    <div className={styles.no_account_selected}>
                        <p>Chưa chọn tài khoản nào</p>
                    </div>
                )}
            </div>

            {availableAccounts.length > 0 && (
                <>
                    <div className={styles.separator}></div>
                    <div className={styles.available_list_section}>
                        <h4 className={styles.section_title}>Chọn từ các tài khoản khác</h4>
                        <div className={styles.account_list}>
                            {availableAccounts.map(acc => (
                                <div key={acc.uid} className={`${styles.account_item} ${styles.clickable}`} onClick={() => onSelect(acc)}>
                                    <img src={acc.avt} alt={acc.name} className={styles.account_avatar} />
                                    <div className={styles.account_info}>
                                        <span className={styles.account_name}>{acc.name}</span>
                                        <span className={styles.account_phone}>{acc.phone}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <div className={styles.separator}></div>

            <button onClick={onAddClick} className='btn' style={{ padding: 10, width: '100%', borderRadius: 5, justifyContent: 'center' }}>
                Thêm tài khoản mới
            </button>
        </div>
    );
};

const LimitInputRow = ({ label, value, onChange }) => {
    const handleInputChange = (e) => {
        const inputValue = e.target.value;
        if (inputValue === '') { onChange(''); return; }
        onChange(Number(inputValue));
    };
    const handleInputBlur = () => {
        let num = parseInt(value, 10);
        if (isNaN(num) || num < 1) { num = 1; }
        else if (num > 50) { num = 50; }
        onChange(num);
    };
    const increment = () => {
        const nextValue = (Number(value) || 0) + 1;
        onChange(nextValue > 50 ? 50 : nextValue);
    };
    const decrement = () => {
        const nextValue = (Number(value) || 0) - 1;
        onChange(nextValue < 1 ? 1 : nextValue);
    };
    return (
        <div className={styles.limit_row}>
            <label className='text_6_400'>{label}</label>
            <div className={styles.stepper_container}>
                <button onClick={decrement} className={styles.stepper_btn} disabled={value <= 1}>-</button>
                <input
                    type="number"
                    value={value}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    className={styles.limit_input}
                />
                <button onClick={increment} className={styles.stepper_btn} disabled={value >= 50}>+</button>
            </div>
        </div>
    );
};

export default function Setting({ user }) {
    const router = useRouter();
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [isSecondaryOpen, setIsSecondaryOpen] = useState(false);
    const [secondaryContentType, setSecondaryContentType] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [newToken, setNewToken] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [rateLimit, setRateLimit] = useState(50);
    const [isLoading, setIsLoading] = useState(false);
    const [loadfull, setloadfull] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState(null);
    const [notification, setNotification] = useState({ open: false, status: true, mes: '' });

    useEffect(() => {
        setSelectedAccountId(user?.zalo?.uid || null);
    }, [user]);

    const loadAllAccounts = useCallback(async () => {
        if (accounts.length > 0) return;
        setIsLoading(true);
        try {
            const accountData = await Data_account();
            setAccounts(accountData || []);
            if (accountData?.length > 0) {
                setRateLimit(accountData[0].rateLimitPerHour || 50);
            }
        } catch (error) {
            console.error("Lỗi khi lấy danh sách tài khoản:", error);
        } finally {
            setIsLoading(false);
        }
    }, [accounts.length]);

    const handleOpenPrimaryPopup = useCallback(() => {
        setIsPopupOpen(true);
        loadAllAccounts();
    }, [loadAllAccounts]);

    const openSecondaryPopup = useCallback((type) => {
        setSecondaryContentType(type);
        setIsSecondaryOpen(true);
    }, []);

    const closeSecondaryPopup = useCallback(() => {
        setIsSecondaryOpen(false);
        setTimeout(() => {
            setSecondaryContentType(null);
            setNewToken('');
            setSubmitError('');
        }, 300);
    }, []);

    const updateAccountSelection = useCallback(async (zaloAccountId) => {
        setIsSubmitting(true);
        try {
            setloadfull(true)
            const response = await fetch('/api/pickzalo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ zaloAccountId }),
            });
            const result = await response.json();
            if (result.status !== 2) {
                throw new Error(result.mes || 'Lỗi không xác định');
            }
            setNotification({ open: true, status: true, mes: result.mes });
        } catch (error) {
            setNotification({ open: true, status: false, mes: error.message });
        } finally {
            setloadfull(false);
            router.refresh();
            setIsSubmitting(false);
            closeSecondaryPopup();
        }
    }, [closeSecondaryPopup]);

    const handleSelectAccount = (account) => updateAccountSelection(account._id);
    const handleDeselectAccount = () => updateAccountSelection(null);

    const handleAddNewAccount = useCallback(async () => {
        setSubmitError('');
        setIsSubmitting(true);
        setloadfull(true);
        try {
            const response = await fetch('/api/acc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: newToken }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.mes || 'Đã xảy ra lỗi khi thêm tài khoản.');
            }
            if (result.status === 2) {
                setNotification({ open: true, status: true, mes: result.mes });
                setSecondaryContentType('accounts');
            } else {
                setNotification({ open: true, status: false, mes: result.mes || 'Không thể thêm tài khoản.' });
                setSubmitError(result.mes || 'Không thể thêm tài khoản.');
            }
        } catch (error) {
            setSubmitError(error.message);
        } finally {
            setloadfull(false);
            setIsSubmitting(false);
        }
    }, [newToken]);

    useEffect(() => {
        if (secondaryContentType === 'accounts') {
            const refetchData = async () => {
                setIsLoading(true);
                try {
                    const accountData = await Data_account();
                    setAccounts(accountData || []);
                } finally {
                    setIsLoading(false);
                }
            };
            refetchData();
        }
    }, [secondaryContentType]);

    const mainDisplayAccountName = useMemo(() => {
        return user?.zalo?.name || "Chưa chọn tài khoản";
    }, [user]);

    const handleCloseNotification = () => {
        setNotification({ ...notification, open: false });
        router.refresh();
    };

    const renderConfigList = () => (
        <div style={{ padding: '8px' }}>
            <div style={{ flexDirection: 'column', gap: 3, display: 'flex' }}>
                <div
                    className={`${styles.popup_t} ${styles.popup_t_first} ${styles.clickable}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}
                    onClick={() => openSecondaryPopup('accounts')}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Svg_Setting w={16} h={16} c="var(--main_d)" />
                        <p className='text_6' style={{ color: 'var(--main_d)' }}>Tài khoản</p>
                    </div>
                    <p className='text_6_400'>{mainDisplayAccountName}</p>
                </div>
                <div style={{ height: '1px', width: '100%', background: 'var(--border-color)' }}></div>
                <div className={`${styles.popup_t}`} style={{ padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Svg_Setting w={16} h={16} c="var(--main_d)" />
                        <p className='text_6' style={{ color: 'var(--main_d)' }}>Giới hạn hành động</p>
                    </div>
                </div>
                <div className={styles.limit_container}>
                    <LimitInputRow label="Số hành động / giờ:" value={rateLimit} onChange={setRateLimit} />
                </div>
            </div>
        </div>
    );

    const getSecondaryPopupContent = () => {
        switch (secondaryContentType) {
            case 'accounts':
                return {
                    title: 'Quản lý tài khoản',
                    content: isLoading
                        ? <div style={{ padding: '20px', textAlign: 'center' }}>Đang tải danh sách...</div>
                        : renderAccountList({
                            accounts,
                            selectedAccountId,
                            onSelect: handleSelectAccount,
                            onDeselect: handleDeselectAccount,
                            onAddClick: () => setSecondaryContentType('add_account_form'),
                            isSubmitting,
                        })
                };
            case 'add_account_form':
                return {
                    title: 'Thêm tài khoản mới',
                    content: renderAddAccountForm({
                        newToken, setNewToken,
                        onSubmit: handleAddNewAccount,
                        onBack: () => setSecondaryContentType('accounts'),
                        error: submitError, isSubmitting
                    })
                };
            default:
                return { title: '', content: null };
        }
    };

    const secondaryContent = getSecondaryPopupContent();

    return (
        <>
            {loadfull && <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.8)', zIndex: 9999 }}>
                <Loading content={<p className='text_6_400' style={{ color: 'white' }}>Đang tải...</p>} />
            </div>}
            <div className='input' style={{ cursor: 'pointer', gap: 8, alignItems: 'center', display: 'flex', flex: 1, borderRadius: '0 5px 5px 0', background: '#e2e8f0' }} onClick={handleOpenPrimaryPopup}>
                <Svg_Setting w={16} h={16} c={'var(--main_b)'} />
                <p className='text_6_400'>Cấu hình</p>
            </div>
            <FlexiblePopup
                open={isPopupOpen}
                onClose={() => setIsPopupOpen(false)}
                title="Cài đặt & Cấu hình"
                renderItemList={renderConfigList}
                secondaryOpen={isSecondaryOpen}
                onCloseSecondary={closeSecondaryPopup}
                secondaryTitle={secondaryContent.title}
                renderSecondaryList={() => secondaryContent.content}
            />
            <Noti
                open={notification.open}
                onClose={handleCloseNotification}
                status={notification.status}
                mes={notification.mes}
                button={
                    <div onClick={handleCloseNotification} className='btn' style={{ justifyContent: 'center', width: 'calc(100% - 24px)' }}>
                        Tắt thông báo
                    </div>
                }
            />
        </>
    );
}