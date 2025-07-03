'use client';

import React, {
    memo,
    useCallback,
    useDeferredValue,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import HistoryPopup from './ui/his';
import styles from './index.module.css';
import SidePanel from './ui/more';
import Senmes from './ui/senmes';
import {
    Data_Client,
    Data_Label,
    Re_Client,
    Re_History,
    Re_Label
} from '@/data/client';
import AddLabelButton from './ui/addlabel';
import Loading from '@/components/(ui)/(loading)/loading';

const PAGE_SIZE = 10;
const ACCOUNTS = [{ id: 1, name: 'Ai Robotic' }];

const toTitleCase = s =>
    s
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .map(w => w[0].toUpperCase() + w.slice(1))
        .join(' ');

const normalize = str =>
    str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

export const parseLabels = val => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(String);
    return val
        .toString()
        .replace(/[\[\]'"]/g, '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
};

const getCustomerType = row => {
    if (row.remove && row.remove.trim() !== '') return 'Đã hủy';
    if (row.study) return 'Nhập học';
    if (row.studyTry) return 'Học thử';
    if (row.care) return 'Có nhu cầu';
    return 'Mới';
};

const renderCustomerTypeBadge = type => {
    const badgeBy = {
        'Mới': styles.typeNew,
        'Có nhu cầu': styles.typeInterested,
        'Học thử': styles.typeTrial,
        'Nhập học': styles.typeEnrolled,
        'Đã hủy': styles.typeCancelled
    };
    return (
        <span className={`${styles.typeBadge} ${badgeBy[type] || styles.typeNew}`}>
            {type}
        </span>
    );
};

const applyFiltersToData = (data, { label, search, area, source, type }) =>
    data.filter(row => {
        if (label) {
            const rowLabels = parseLabels(row.labels).join(',').toLowerCase();
            const parts = label.toLowerCase().split(',').map(s => s.trim());
            if (!parts.some(p => p && rowLabels.includes(p))) return false;
        }
        if (search) {
            const q = normalize(search);
            const name = normalize(row.nameParent || '');
            const phone = normalize(row.phone || '');
            if (!name.includes(q) && !phone.includes(q)) return false;
        }
        if (!row.area.toString().toLowerCase().includes(area.toLowerCase()))
            return false;
        if (!row.source.toString().toLowerCase().includes(source.toLowerCase()))
            return false;
        if (!getCustomerType(row).toLowerCase().includes(type.toLowerCase()))
            return false;
        return true;
    });

const useSelection = () => {
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const toggleOne = useCallback(id => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);
    const clear = useCallback(() => setSelectedIds(new Set()), []);
    return {
        selectedIds,
        toggleOne,
        clear,
        setSelectedIds,
        size: selectedIds.size
    };
};

const Row = memo(function Row({
    row,
    rowIndex,
    visibleKeys,
    onOpen,
    onToggle,
    checked
}) {
    return (
        <div className={styles.gridRow} style={{ backgroundColor: row.remove != '' ? '#ffd9dd' : 'white' }}>
            <div
                className={`${styles.gridCell} ${styles.colTiny}`}
                style={{ textAlign: 'center', flex: 0.5 }}
                onClick={e => e.stopPropagation()}
            >
                <input
                    type="checkbox"
                    className={styles.bigCheckbox}
                    checked={checked}
                    onChange={() => onToggle(row.phone)}
                />
            </div>
            <div
                className={`${styles.gridCell} ${styles.colSmall}`}
                style={{ textAlign: 'center', fontWeight: 600, flex: 0.5 }}
                onClick={() => onOpen(row)}
            >
                {rowIndex + 1}
            </div>
            {visibleKeys.map(k => {
                if (k === 'labels') {
                    const valu = parseLabels(row[k]);
                    return (
                        <div key={k} className={styles.gridCell} onClick={() => onOpen(row)}>
                            {valu.length}
                        </div>
                    );
                }
                if (['source', 'care', 'studyTry', 'study', 'remove'].includes(k))
                    return null;
                return (
                    <div key={k} className={styles.gridCell} onClick={() => onOpen(row)}>
                        {k === 'type'
                            ? renderCustomerTypeBadge(getCustomerType(row))
                            : Array.isArray(row[k])
                                ? row[k].join(', ')
                                : row[k]}
                    </div>
                );
            })}
        </div>
    );
});

export default function Client() {

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [historyOpen, setHistoryOpen] = useState(false);
    const [data, setData] = useState([]);
    const [filters, setFilters] = useState({
        label: searchParams.get('label') || '',
        search: searchParams.get('search') || '',
        area: searchParams.get('area') || '',
        source: searchParams.get('source') || '',
        type: searchParams.get('type') || ''
    });
    const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
    const [showLabelPopup, setShowLabelPopup] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(1);
    const [isReloading, setIsReloading] = useState(false);

    const {
        selectedIds,
        size: selectedCount,
        toggleOne: toggleSelectRow,
        clear: clearSelection,
        setSelectedIds
    } = useSelection();

    const [selectedRow, setSelectedRow] = useState(null);
    const [panelOpen, setPanelOpen] = useState(false);

    const [labelsDB, setLabelsDB] = useState([]);

    const loadData = useCallback(async () => {
        setIsReloading(true);
        try {
            const res = await Data_Client();
            setData(res.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsReloading(false);
        }
    }, []);
    useEffect(() => {
        loadData();
    }, [loadData]);

    const loadLabels = useCallback(async () => {
        try {
            const res = await Data_Label();
            setLabelsDB(res.data || []);
        } catch (e) { }
    }, []);
    useEffect(() => {
        loadLabels();
    }, [loadLabels]);

    const deferredSearch = useDeferredValue(filters.search);
    const filteredData = useMemo(
        () => applyFiltersToData(data, { ...filters, search: deferredSearch }),
        [data, filters, deferredSearch]
    );
    const totalPages = Math.max(Math.ceil(filteredData.length / PAGE_SIZE), 1);
    const currentRows = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredData.slice(start, start + PAGE_SIZE);
    }, [filteredData, page]);
    const visibleKeys = useMemo(
        () => (currentRows[0] ? Object.keys(currentRows[0]) : []),
        [currentRows]
    );
    const uniqueAreas = useMemo(() => {
        const set = new Set();
        data.forEach(r => r.area && set.add(toTitleCase(r.area.toString().trim())));
        return [...set].sort();
    }, [data]);
    const uniqueSources = useMemo(() => {
        const set = new Set();
        data.forEach(r => r.source && set.add(toTitleCase(r.source.toString().trim())));
        return [...set].sort();
    }, [data]);
    const uniqueLabels = useMemo(
        () =>
            labelsDB
                .map(l => l.title)
                .sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' })),
        [labelsDB]
    );

    const inlineLabels = useMemo(() => uniqueLabels.slice(0, 6), [uniqueLabels]);
    const selectedLabelContent = useMemo(() => {
        if (!filters.label) return '';
        const first = filters.label.split(',').map(s => s.trim())[0];
        const found = labelsDB.find(l => l.title === first);
        return found?.content || '';
    }, [filters.label, labelsDB]);

    useEffect(() => {
        clearSelection();
    }, [filteredData, page, clearSelection]);

    useEffect(() => {
        const sp = new URLSearchParams();
        if (page > 1) sp.set('page', String(page));
        Object.entries(filters).forEach(([k, v]) => v && sp.set(k, v));
        router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    }, [page, filters, router, pathname]);

    const handleFilterChange = key => e => {
        setPage(1);
        setFilters(f => ({ ...f, [key]: e.target.value.trim() }));
    };
    const resetFilters = useCallback(() => {
        setFilters({ label: '', search: '', area: '', source: '', type: '' });
        setPage(1);
    }, []);
    const toggleLabel = useCallback(
        txt => {
            const labels = filters.label
                ? filters.label.split(',').map(l => l.trim())
                : [];
            const idx = labels.indexOf(txt);
            if (idx >= 0) labels.splice(idx, 1);
            else labels.push(txt);
            setFilters(f => ({ ...f, label: labels.join(', ') }));
            setPage(1);
        },
        [filters.label]
    );
    const reloadData = useCallback(async () => {
        await Re_Client();
        await Re_History();
        await Re_Label();
        window.location.reload();
    }, []);
    const reload = () => {
        router.refresh();
    };

    const selectedCustomers = useMemo(
        () => data.filter(r => selectedIds.has(r.phone)),
        [data, selectedIds]
    );

    const sendMessage = useCallback(async () => {
        if (!selectedCustomers.length) return;
        try {
            const res = await fetch('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clients: selectedCustomers,
                    accountId: selectedAccount,
                    defaultContent: selectedLabelContent
                })
            });
            if (!res.ok) throw new Error(await res.text());
        } catch (err) {
            console.error(err);
        }
    }, [selectedCustomers, selectedAccount, selectedLabelContent]);

    const closePanel = () => {
        setPanelOpen(false);
        setTimeout(() => {
            setSelectedRow(null);
        }, 310);
    };

    const saveNotes = async () => {
        setPanelOpen(false);
        await Re_Client();
        const res = await Data_Client();
        setData(res.data || []);
        router.refresh()

    };

    const headerCheckboxRef = useRef(null);
    const allChecked =
        filteredData.length > 0 &&
        filteredData.every(r => selectedIds.has(r.phone));
    const partialChecked =
        !allChecked && filteredData.some(r => selectedIds.has(r.phone));
    useEffect(() => {
        if (headerCheckboxRef.current)
            headerCheckboxRef.current.indeterminate = partialChecked;
    }, [partialChecked]);

    return (
        <div className={styles.container}>
            {/* Filters */}
            <div className={styles.filterSection}>
                <div className={styles.filterHeader}>
                    <h2 className={styles.filterTitle}>Chăm sóc khách hàng</h2>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <button
                            className={styles.btnAction}
                            onClick={() => setHistoryOpen(true)}
                        >
                            Xem lịch sử gửi
                        </button>
                        <button
                            className={`${styles.btnReset}${!Object.values(filters).some(Boolean) ? ` ${styles.btnDisabled}` : ''
                                }`}
                            onClick={resetFilters}
                            disabled={!Object.values(filters).some(Boolean)}
                        >
                            Xoá bộ lọc
                        </button>
                        <button
                            className={`${styles.btnAction} ${styles.btnReload}`}
                            onClick={reloadData}
                            disabled={isReloading}
                        >
                            {isReloading ? 'Đang tải...' : 'Làm mới dữ liệu'}
                        </button>
                    </div>
                </div>

                <div className={styles.filterChips}>
                    <span className="text_6">Nhãn phổ biến:</span>
                    {inlineLabels.map(lbl => {
                        const active = filters.label.includes(lbl);
                        return (
                            <button
                                key={lbl}
                                className={`${styles.chip}${active ? ` ${styles.chipActive}` : ''}`}
                                onClick={() => toggleLabel(lbl)}
                            >
                                {lbl}
                                {active && <span className={styles.chipRemove}>×</span>}
                            </button>
                        );
                    })}
                    {uniqueLabels.length > 6 && (
                        <button className={styles.chip} onClick={() => setShowLabelPopup(true)}>
                            …
                        </button>
                    )}
                    <AddLabelButton onCreated={loadLabels} />
                </div>

                <div className={styles.filterControls}>
                    {/* Tìm kiếm */}
                    <div className={styles.filterGroup}>
                        <label htmlFor="nameFilter" className="text_6">
                            Tìm kiếm (tên/SĐT):
                        </label>
                        <input
                            id="nameFilter"
                            className={styles.filterInput}
                            placeholder="Nhập tên hoặc số điện thoại..."
                            value={filters.search}
                            onChange={handleFilterChange('search')}
                        />
                    </div>

                    {/* Khu vực */}
                    <div className={styles.filterGroup}>
                        <label htmlFor="areaFilter" className="text_6">
                            Khu vực:
                        </label>
                        <select
                            id="areaFilter"
                            className={styles.filterSelect}
                            value={filters.area}
                            onChange={handleFilterChange('area')}
                        >
                            <option value="">-- Tất cả khu vực --</option>
                            {uniqueAreas.map(a => (
                                <option key={a} value={a}>
                                    {a}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Nguồn */}
                    <div className={styles.filterGroup}>
                        <label htmlFor="sourceFilter" className="text_6">
                            Nguồn:
                        </label>
                        <select
                            id="sourceFilter"
                            className={styles.filterSelect}
                            value={filters.source}
                            onChange={handleFilterChange('source')}
                        >
                            <option value="">-- Tất cả nguồn --</option>
                            {uniqueSources.map(s => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Loại khách hàng */}
                    <div className={styles.filterGroup}>
                        <label htmlFor="typeFilter" className="text_6">
                            Loại khách hàng:
                        </label>
                        <select
                            id="typeFilter"
                            className={styles.filterSelect}
                            value={filters.type}
                            onChange={handleFilterChange('type')}
                        >
                            <option value="">-- Tất cả loại --</option>
                            {[
                                'Mới',
                                'Có nhu cầu',
                                'Học thử',
                                'Nhập học',
                                'Đã hủy'
                            ].map(t => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Message section */}
            <div className={styles.messageSection}>
                <div className={styles.accountSelector} style={{ flex: 1 }}>
                    <label htmlFor="accountSelect" className="text_6">
                        Gửi từ tài khoản:
                    </label>
                    <select
                        id="accountSelect"
                        className={styles.accountSelect}
                        value={selectedAccount}
                        onChange={e => setSelectedAccount(Number(e.target.value))}
                    >
                        {ACCOUNTS.map(acc => (
                            <option key={acc.id} value={acc.id}>
                                {acc.name}
                            </option>
                        ))}
                    </select>
                </div>
                <Senmes
                    data={selectedCustomers}
                    labelOptions={uniqueLabels}
                    onSend={sendMessage}
                    label={labelsDB}
                />
            </div>

            {/* Data / Loading / Empty */}
            {data.length === 0 ? (
                <Loading content="Đang tải dữ liệu..." />
            ) : filteredData.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyStateIcon}>📋</div>
                    <p className={styles.emptyStateText}>
                        Không tìm thấy dữ liệu nào phù hợp với bộ lọc
                    </p>
                    <button className={styles.btnReset} onClick={resetFilters}>
                        Xoá bộ lọc
                    </button>
                </div>
            ) : (
                <>
                    {/* Grid */}
                    <div className={styles.dataGrid}>
                        <div className={styles.gridHeader}>
                            <div
                                className={`${styles.gridCell} ${styles.colTiny}`}
                                style={{ textAlign: 'center', flex: 0.5 }}
                            >
                                <input
                                    ref={headerCheckboxRef}
                                    type="checkbox"
                                    className={styles.bigCheckbox}
                                    checked={allChecked}
                                    onChange={() =>
                                        allChecked
                                            ? clearSelection()
                                            : setSelectedIds(
                                                new Set(filteredData.map(r => r.phone))
                                            )
                                    }
                                />
                                {selectedCount > 0 && (
                                    <span
                                        style={{
                                            fontSize: 14,
                                            marginLeft: 4,
                                            color: 'white'
                                        }}
                                    >
                                        {selectedCount} người
                                    </span>
                                )}
                            </div>
                            <div
                                className={`text_6 ${styles.colSmall}`}
                                style={{ padding: 16, color: 'white', flex: 0.5 }}
                            >
                                STT
                            </div>
                            {[
                                'Tên',
                                'SĐT',
                                'Tên học viên',
                                'Email',
                                'Tuổi',
                                'Khu vực',
                                'Số nhãn'
                            ].map(k => (
                                <div
                                    key={k}
                                    className="text_6"
                                    style={{ padding: 16, color: 'white' }}
                                >
                                    {k}
                                </div>
                            ))}
                        </div>
                        <div className={styles.gridBody}>
                            {currentRows.map((r, idx) => (
                                <Row
                                    key={idx}
                                    row={r}
                                    rowIndex={(page - 1) * PAGE_SIZE + idx}
                                    visibleKeys={visibleKeys}
                                    onOpen={row => {
                                        setSelectedRow(row);
                                        setPanelOpen(true);
                                    }}
                                    onToggle={toggleSelectRow}
                                    checked={selectedIds.has(r.phone)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className={styles.pagination}>
                            {page > 1 && (
                                <button
                                    onClick={() => setPage(page - 1)}
                                    className={styles.pageBtn}
                                >
                                    &laquo; Trang trước
                                </button>
                            )}
                            <div className={styles.pageNumbers}>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (page <= 3) pageNum = i + 1;
                                    else if (page >= totalPages - 2)
                                        pageNum = totalPages - 4 + i;
                                    else pageNum = page - 2 + i;
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setPage(pageNum)}
                                            className={`${styles.pageBtn}${pageNum === page ? ` ${styles.pageBtnActive}` : ''
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>
                            {page < totalPages && (
                                <button
                                    onClick={() => setPage(page + 1)}
                                    className={styles.pageBtn}
                                >
                                    Trang sau &raquo;
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Label Popup */}
            {showLabelPopup && (
                <div
                    className={styles.labelModalBackdrop}
                    onClick={() => setShowLabelPopup(false)}
                >
                    <div
                        className={styles.labelModal}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className={styles.labelModalTitle}>Chọn nhãn để lọc</h3>
                        <div className={styles.labelModalGrid}>
                            {uniqueLabels.map(lbl => {
                                const active = filters.label.includes(lbl);
                                return (
                                    <button
                                        key={lbl}
                                        className={`${styles.chipLarge}${active ? ` ${styles.chipActive}` : ''
                                            }`}
                                        onClick={() => {
                                            toggleLabel(lbl);
                                            setShowLabelPopup(false);
                                        }}
                                    >
                                        {lbl}
                                        {active && (
                                            <span className={styles.chipRemove}>×</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            className={styles.btnCloseModal}
                            onClick={() => setShowLabelPopup(false)}
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}

            {/* Side Panel */}
            <SidePanel
                open={panelOpen}
                row={selectedRow}
                labels={parseLabels(selectedRow?.labels || '')}
                onClose={closePanel}
                onSave={saveNotes}
            />

            {/* History Popup */}
            <HistoryPopup
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                datauser={data}
                type="all"
            />
        </div>
    );
}
