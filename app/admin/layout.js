'use client';

import { Svg_Menu } from '@/components/(icon)/svg';
import styles from './index.module.css';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

const SNAP_OFFSET = 5;
const MENU_GAP = 5;
export default function AdminPage({ children }) {
    const [position, setPosition] = useState({ x: -100, y: -100 });
    const [isDragging, setIsDragging] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const containerRef = useRef(null);
    const indicatorRef = useRef(null);
    const dragStartRef = useRef({ moved: false });

    useEffect(() => {
        if (containerRef.current && indicatorRef.current) {
            const container = containerRef.current;
            const indicator = indicatorRef.current;
            setPosition({
                x: container.offsetWidth - indicator.offsetWidth - SNAP_OFFSET,
                y: container.offsetHeight - indicator.offsetHeight - SNAP_OFFSET,
            });
        }
    }, []);

    const snapToEdge = useCallback(() => {
        if (!containerRef.current || !indicatorRef.current) return;

        const container = containerRef.current;
        const indicator = indicatorRef.current;
        const { x, y } = position;

        const distToLeft = x - SNAP_OFFSET;
        const distToRight = container.offsetWidth - indicator.offsetWidth - x - SNAP_OFFSET;
        const distToTop = y - SNAP_OFFSET;
        const distToBottom = container.offsetHeight - indicator.offsetHeight - y - SNAP_OFFSET;

        const minHorizontal = Math.min(distToLeft, distToRight);
        const minVertical = Math.min(distToTop, distToBottom);

        let newX = x;
        let newY = y;

        if (minHorizontal < minVertical) {
            newX = distToLeft < distToRight ? SNAP_OFFSET : container.offsetWidth - indicator.offsetWidth - SNAP_OFFSET;
        } else {
            newY = distToTop < distToBottom ? SNAP_OFFSET : container.offsetHeight - indicator.offsetHeight - SNAP_OFFSET;
        }

        setPosition({ x: newX, y: newY });
    }, [position]);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current.moved = false;
        setIsMenuOpen(false);
    }, []);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        if (!dragStartRef.current.moved) {
            setIsMenuOpen(prev => !prev);
        } else {
            snapToEdge();
        }
    }, [snapToEdge]);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;

        dragStartRef.current.moved = true;

        setPosition(prevPos => {
            const container = containerRef.current;
            const indicator = indicatorRef.current;
            if (!container || !indicator) return prevPos;

            let newX = prevPos.x + e.movementX;
            let newY = prevPos.y + e.movementY;

            const minX = SNAP_OFFSET;
            const minY = SNAP_OFFSET;
            const maxX = container.offsetWidth - indicator.offsetWidth - SNAP_OFFSET;
            const maxY = container.offsetHeight - indicator.offsetHeight - SNAP_OFFSET;

            newX = Math.max(minX, Math.min(newX, maxX));
            newY = Math.max(minY, Math.min(newY, maxY));

            return { x: newX, y: newY };
        });
    }, [isDragging]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const getMenuStyles = () => {
        if (!containerRef.current || !indicatorRef.current) return {};

        const container = containerRef.current;
        const indicator = indicatorRef.current;
        const styles = {};
        if (position.x + indicator.offsetWidth / 2 > container.offsetWidth / 2) {
            styles.right = container.offsetWidth - position.x + MENU_GAP;
        } else {
            styles.left = position.x + indicator.offsetWidth + MENU_GAP;
        }
        if (position.y + indicator.offsetHeight / 2 > container.offsetHeight / 2) {
            styles.bottom = container.offsetHeight - position.y + MENU_GAP;
        } else {
            styles.top = position.y + indicator.offsetHeight + MENU_GAP;
        }

        return styles;
    };

    return (
        <div ref={containerRef} className={styles.container}>
            {children}
            <div
                ref={indicatorRef}
                className={`${styles.indicator} ${isDragging ? styles.dragging : ''}`}
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                }}
                onMouseDown={handleMouseDown}
            >
                <Svg_Menu h={14} w={14} c={'white'} />
            </div>

            {isMenuOpen && (
                <div
                    className={styles.floatingMenu}
                    style={getMenuStyles()}
                >
                    <Link href={'/admin'} className='input'>Khách hàng</Link>
                    <Link href={'/admin/user'} className='input'>Sản Phẩm</Link>
                    <Link href={'/admin/settings'} className='input'>Cài Đặt</Link>
                </div>
            )}
        </div>
    );
}