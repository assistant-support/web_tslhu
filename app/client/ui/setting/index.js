'use client';

import { useState, useEffect } from 'react';
import { Svg_Setting } from '@/components/(icon)/svg';
import FlexiblePopup from '@/components/(features)/(popup)/popup_right';
import styles from './index.module.css';
import TextNoti from '@/components/(features)/(noti)/textnoti';
import { Data_account } from '@/data/users'; // Import hàm lấy dữ liệu

const renderAddAccountForm = ({ newToken, setNewToken, onSubmit, onBack, error, isSubmitting }) => (
    <div className={styles.add_account_form_container}>
        <TextNoti
            title='Nhập token tài khoản'
            mes="Phải dán đầy đủ token của tài khoản vào, sau bước kiểm tra của hệ thống mới có thể sử dụng!"
        />
        <textarea
            className='input'
            style={{ height: 300 }}
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

const renderAccountList = ({ accounts, onAddClick }) => (
    <div className={styles.account_list_container}>
        <div className={styles.account_list}>
            {accounts.map(acc => (
                <div key={acc.uid} className={styles.account_item}>
                    <img src={acc.avt} alt={acc.name} className={styles.account_avatar} />
                    <div className={styles.account_info}>
                        <span className={styles.account_name}>{acc.name}</span>
                        <span className={styles.account_phone}>{acc.phone}</span>
                    </div>
                    <button className={styles.edit_btn}>Sửa</button>
                </div>
            ))}
        </div>
        <button onClick={onAddClick} className='btn' style={{ padding: 10, width: '100%', borderRadius: 5, justifyContent: 'center' }}>
            Thêm tài khoản
        </button>
    </div>
);

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
    console.log(user);
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [isSecondaryOpen, setIsSecondaryOpen] = useState(false);
    const [secondaryContentType, setSecondaryContentType] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [newToken, setNewToken] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    // State mới cho giới hạn hành động chung
    const [rateLimit, setRateLimit] = useState(50);

    const openSecondaryPopup = (type) => {
        setSecondaryContentType(type);
        setIsSecondaryOpen(true);
    };

    const closeSecondaryPopup = () => {
        setIsSecondaryOpen(false);
        setTimeout(() => {
            setSecondaryContentType(null);
            setNewToken('');
            setSubmitError('');
        }, 300);
    };

    const handleAddNewAccount = async () => {
        setSubmitError('');
        setIsSubmitting(true);
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
            if (result.success) {
                setSecondaryContentType('accounts');
            } else {
                setSubmitError(result.mes || 'Không thể thêm tài khoản.');
            }
        } catch (error) {
            setSubmitError(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Tự động gọi API để lấy danh sách tài khoản khi popup được mở
    useEffect(() => {
        if (isPopupOpen && accounts.length === 0) {
            const fetchData = async () => {
                try {
                    const accountData = await Data_account();
                    setAccounts(accountData || []);
                    if (accountData && accountData.length > 0) {
                        setRateLimit(accountData[0].rateLimitPerHour || 50);
                    }
                } catch (error) {
                    console.error("Lỗi khi lấy dữ liệu tài khoản:", error);
                }
            };
            fetchData();
        }
    }, [isPopupOpen, accounts.length]);

    // Cập nhật lại danh sách khi vừa thêm tài khoản thành công
    useEffect(() => {
        if (secondaryContentType === 'accounts') {
            const refetchData = async () => {
                const accountData = await Data_account();
                setAccounts(accountData || []);
            };
            refetchData();
        }
    }, [secondaryContentType]);

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
                    <p className='text_6_400'>{accounts.length > 0 ? `${accounts.length} tài khoản` : 'Chưa có tài khoản'}</p>
                </div>
                <div style={{ height: '1px', width: '100%', background: 'var(--border-color)' }}></div>
                <div className={`${styles.popup_t}`} style={{ padding: 12 }}  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Svg_Setting w={16} h={16} c="var(--main_d)" />
                        <p className='text_6' style={{ color: 'var(--main_d)' }}>Giới hạn hành động</p>
                    </div>
                </div>
                <div className={styles.limit_container}>
                    {/* Chỉ còn 1 input duy nhất */}
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
                    content: renderAccountList({
                        accounts: accounts,
                        onAddClick: () => setSecondaryContentType('add_account_form')
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
            <div className='input' style={{ cursor: 'pointer', gap: 8, alignItems: 'center', display: 'flex', flex: 1, borderRadius: '0 5px 5px 0', background: '#e2e8f0' }} onClick={() => setIsPopupOpen(true)}>
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
        </>
    );
}