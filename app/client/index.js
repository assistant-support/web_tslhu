'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import styles from './index.module.css';
import Label from './ui/label';
import AddLabelButton from './ui/addlabel';
import Setting from './ui/setting';
import Run from './ui/run';
import Schedule from './ui/schedule';

const useSelection = (idKey = '_id') => {
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const toggleOne = useCallback(id => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);
    return { selectedIds, toggleOne, setSelectedIds, size: selectedIds.size };
};

const Row = React.memo(function Row({ row, rowIndex, onToggle, checked }) {
    return (
        <div className={styles.gridRow} style={{ backgroundColor: row.remove ? '#ffd9dd' : 'white' }}>
            <div className={`${styles.gridCell} ${styles.colTiny}`} style={{ flex: .5, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                <input type="checkbox" className={styles.bigCheckbox} checked={checked} onChange={() => onToggle(row)} />
            </div>
            <div className={`${styles.gridCell} ${styles.colSmall} text_6_400`} style={{ flex: .5, textAlign: 'center', fontWeight: 600 }}>{rowIndex + 1}</div>
            <div className={`${styles.gridCell} text_6_400`}>{row.phone}</div>
            <div className={`${styles.gridCell} text_6_400`}>{row.name}</div>
            <div className={`${styles.gridCell} text_6_400`}>{row.status}</div>
            <div className={`${styles.gridCell} text_6_400`}>{row.uid}</div>
        </div>
    );
});

export default function Client({ initialData, initialPagination, initialLabels, user }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const { selectedIds, toggleOne: toggleSelectRow, setSelectedIds, size: selectedCount } = useSelection('_id');

    const [selectedCustomerMap, setSelectedCustomerMap] = useState(new Map());
    const [viewMode, setViewMode] = useState('all');
    const [query, setQuery] = useState(searchParams.get('query') || '');

    const serverPage = initialPagination?.page || 1;
    const serverTotalPages = initialPagination?.totalPages || 1;
    const serverLimit = initialPagination?.limit || 10;

    const handleNavigation = useCallback((name, value) => {
        const params = new URLSearchParams(searchParams);
        if (value) {
            params.set(name, value);
        } else {
            params.delete(name);
        }
        if (name !== 'page') {
            params.set('page', '1');
        }
        startTransition(() => {
            setViewMode('all');
            router.push(`${pathname}?${params.toString()}`);
        });
    }, [pathname, router, searchParams]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query !== (searchParams.get('query') || '')) {
                handleNavigation('query', query);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query, searchParams, handleNavigation]);

    const handleRefresh = useCallback(() => {
        startTransition(() => router.refresh());
    }, [router]);

    const uniqueLabels = useMemo(() => {
        if (!initialLabels) return [];
        return [...new Set(initialLabels.map(l => l.title))].sort((a, b) => a.localeCompare(b, 'vi'));
    }, [initialLabels]);

    const inlineLabels = useMemo(() => uniqueLabels.slice(0, 6), [uniqueLabels]);
    const currentSelectedLabels = useMemo(() => new Set((searchParams.get('label') || '').split(',').filter(Boolean)), [searchParams]);

    const handleLabelToggle = useCallback((labelTitle) => {
        const newSelected = new Set(currentSelectedLabels);
        newSelected.has(labelTitle) ? newSelected.delete(labelTitle) : newSelected.add(labelTitle);
        handleNavigation('label', Array.from(newSelected).join(','));
    }, [currentSelectedLabels, handleNavigation]);

    const allOnPageChecked = useMemo(() => initialData?.length > 0 && initialData.every(r => selectedIds.has(r._id)), [initialData, selectedIds]);

    const toggleRowAndStoreData = useCallback((row) => {
        setSelectedCustomerMap(prevMap => {
            const newMap = new Map(prevMap);
            newMap.has(row._id) ? newMap.delete(row._id) : newMap.set(row._id, row);
            return newMap;
        });
        toggleSelectRow(row._id);
    }, [toggleSelectRow]);

    const handleTogglePageAndStoreData = useCallback(() => {
        setSelectedCustomerMap(prevMap => {
            const newMap = new Map(prevMap);
            if (allOnPageChecked) {
                initialData.forEach(row => newMap.delete(row._id));
            } else {
                initialData.forEach(row => newMap.set(row._id, row));
            }
            return newMap;
        });
        setSelectedIds(prev => {
            const next = new Set(prev);
            const pageIds = new Set(initialData.map(r => r._id));
            if (allOnPageChecked) {
                pageIds.forEach(id => next.delete(id));
            } else {
                pageIds.forEach(id => next.add(id));
            }
            return next;
        });
    }, [initialData, setSelectedIds, allOnPageChecked]);

    const accountDisplayName = useMemo(() => user?.zalo?.name || "Chưa chọn tài khoản", [user]);
    const scheduleData = useMemo(() => Array.from(selectedCustomerMap.values()), [selectedCustomerMap]);

    const rowsToDisplay = useMemo(() => viewMode === 'selected' ? scheduleData : initialData, [viewMode, scheduleData, initialData]);
    const totalDisplayPages = useMemo(() => viewMode === 'selected' ? 1 : serverTotalPages, [viewMode, serverTotalPages]);
    const currentDisplayPage = useMemo(() => viewMode === 'selected' ? 1 : serverPage, [viewMode, serverPage]);

    return (
        <div className={styles.container}>
            <div className={styles.filterSection}>
                <div className={styles.filterHeader}>
                    <p className='text_3' style={{ color: 'white' }}>Danh sách khách hàng</p>
                    <button className={`${styles.btnAction} ${styles.btnReload}`} onClick={handleRefresh} disabled={isPending}>
                        {isPending ? 'Đang làm mới...' : 'Làm mới dữ liệu'}
                    </button>
                </div>
                <div className={styles.filterChips}>
                    <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="text_6">Lọc theo chiến dịch:</span>
                        {inlineLabels.map(lbl => {
                            const active = currentSelectedLabels.has(lbl);
                            return (<button key={lbl} className={`${styles.chip}${active ? ` ${styles.chipActive}` : ''}`} onClick={() => handleLabelToggle(lbl)}>{lbl}{active && <span className={styles.chipRemove}>×</span>}</button>);
                        })}
                        {uniqueLabels.length > 6 && (<button className={styles.chip} onClick={() => setShowLabelPopup(true)}>…</button>)}
                        <AddLabelButton onCreated={handleRefresh} />
                    </div>
                    <Label data={initialLabels} reload={handleRefresh} />
                </div>
                <div className={styles.filterControls}>
                    <div className={styles.filterGroup}>
                        <label htmlFor="nameFilter" className="text_6">Tìm kiếm (tên/SĐT):</label>
                        <input id="nameFilter" className={styles.filterInput} placeholder="Nhập tên hoặc số điện thoại..." value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                    <div className={styles.filterGroup}>
                        <label htmlFor="statusFilter" className="text_6">Trạng thái chăm sóc:</label>
                        <select id="statusFilter" className={styles.filterSelect} defaultValue={searchParams.get('status') || ''} onChange={(e) => handleNavigation('status', e.target.value)}>
                            <option value="">-- Tất cả --</option>
                            <option value="Mới">Mới</option>
                            <option value="Đang chăm sóc">Đang chăm sóc</option>
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <label htmlFor="uidFilter" className="text_6">Trạng thái UID:</label>
                        <select id="uidFilter" className={styles.filterSelect} defaultValue={searchParams.get('uidStatus') || ''} onChange={(e) => handleNavigation('uidStatus', e.target.value)}>
                            <option value="">-- Tất cả --</option>
                            <option value="exists">Có UID</option>
                            <option value="missing">Thiếu UID</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className={styles.messageSection}>
                <div className={styles.accountSelector} style={{ flex: 1 }}>
                    <label className="text_6">Gửi từ tài khoản:</label>
                    <div style={{ display: 'flex' }}>
                        <div className='input' style={{ width: 150, padding: '8px 12px', color: '#495057', borderRight: 'none', borderRadius: '5px 0 0 5px', display: 'flex', alignItems: 'center' }}>
                            <span className='text_6_400'>{accountDisplayName}</span>
                        </div>
                        <Setting user={user} onUserUpdate={handleRefresh} />
                    </div>
                    <Run data={user} />
                </div>
                <Schedule data={scheduleData} user={user} label={initialLabels} />
            </div>

            {isPending && <div className={styles.loading}>Đang tải dữ liệu...</div>}

            {!isPending && (
                <>
                    <div className={styles.dataGrid}>
                        <div className={styles.gridHeader}>
                            <div className={`${styles.gridCell} ${styles.colTiny}`} style={{ textAlign: 'center', flex: 0.5 }}>
                                <input type="checkbox" className={styles.bigCheckbox} checked={allOnPageChecked} onChange={handleTogglePageAndStoreData} disabled={viewMode === 'selected'} />
                                {selectedCount > 0 && (<span className={styles.selectedCount} style={{ color: 'white' }}>{selectedCount}</span>)}
                            </div>
                            <div className={`${styles.gridCell} ${styles.colSmall} text_6`} style={{ flex: 0.5, color: 'white' }}>STT</div>
                            <div className={`${styles.gridCell} text_6`} style={{ color: 'white' }}>SĐT</div>
                            <div className={`${styles.gridCell} text_6`} style={{ color: 'white' }}>Tên</div>
                            <div className={`${styles.gridCell} text_6`} style={{ color: 'white' }}>Trạng thái</div>
                            <div className={`${styles.gridCell} text_6`} style={{ color: 'white' }}>UID</div>
                        </div>
                        <div className={styles.gridBody}>
                            {rowsToDisplay.map((r, idx) => (
                                <Row key={r._id} row={r} rowIndex={(viewMode === 'all' ? ((serverPage - 1) * serverLimit) : 0) + idx} onToggle={toggleRowAndStoreData} checked={selectedIds.has(r._id)} />
                            ))}
                        </div>
                    </div>
                    {totalDisplayPages > 1 && (
                        <div className={styles.pagination}>
                            {currentDisplayPage > 1 && (<button onClick={() => handleNavigation('page', currentDisplayPage - 1)} className={styles.pageBtn}>&laquo; Trang trước</button>)}
                            <span className={`text_6_400`} style={{ color: 'white' }}>Trang {currentDisplayPage} / {totalDisplayPages}</span>
                            {currentDisplayPage < totalDisplayPages && (<button onClick={() => handleNavigation('page', currentDisplayPage + 1)} className={styles.pageBtn}>Trang sau &raquo;</button>)}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}