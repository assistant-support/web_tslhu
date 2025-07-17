// components/(layout)/nav/index.js
"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import styles from "./index.module.css";
import {
  Svg_Dark,
  Svg_Left,
  Svg_Logout,
  Svg_Menu,
  Svg_Mode,
  Svg_Admin,
  Svg_Student,
  Svg_Dev,
  Svg_Setting,
} from "../../(icon)/svg"; // Giả sử Svg_Dev đã được tạo
import Menu from "../../(ui)/(button)/menu";
import Switch from "@/components/(ui)/(button)/swith";
import WrapIcon from "../../(ui)/(button)/hoveIcon";
import Loading from "@/components/(ui)/(loading)/loading";
import { logoutUser } from "@/app/actions/authActions";

const ITEM_HEIGHT = 82;

// --- 1. TÁCH DỮ LIỆU RA KHỎI LOGIC ---
// Mảng cấu hình cho các mục trên thanh menu chính
const NAV_CONFIG = [
  {
    href: "/",
    icon: (c) => <Svg_Student w={20} h={19} c={c} />,
    content: "Chăm sóc",
  },
  {
    href: "/admin",
    icon: (c) => <Svg_Admin w={20} h={20} c={c} />,
    content: "Quản lý",
    adminOnly: true, // Thêm cờ để đánh dấu mục chỉ dành cho Admin
  },
  {
    href: "/dev",
    icon: (c) => <Svg_Dev w={20} h={20} c={c} />, // Bạn cần tạo icon này
    content: "Dev",
    adminOnly: true,
  },
];

// --- 2. TÁI CẤU TRÚC CÁC COMPONENT CON CHO MENU ---

// Nội dung chính của Menu "Thêm"
const MainMenuContent = ({ onThemeClick, onLogout }) => (
  <div className={styles.menuContainer}>
    <div style={{ padding: 8, gap: 3 }} className="flex_col">
      <Link href={"/setting"} className={`${styles.menu_li} text_5_400`}>
        <Svg_Setting w={16} h={16} c={"var(--text-secondary)"} /> Cài đặt
      </Link>
      <p className={`${styles.menu_li} text_5_400`} onClick={onThemeClick}>
        <Svg_Mode w={16} h={16} c={"var(--text-secondary)"} /> Giao diện
      </p>
    </div>
    <div
      style={{ padding: 8, borderTop: "thin solid var(--border-color)" }}
      onClick={onLogout}
    >
      <p className={`${styles.menu_li} ${styles.logout} text_5_400`}>
        <Svg_Logout w={16} h={16} c={"white"} /> Đăng xuất
      </p>
    </div>
  </div>
);

// Nội dung của menu Giao diện
const ThemeMenuContent = ({ onBack, isDark, toggleTheme }) => (
  <div className={styles.menuContainer}>
    <div className={styles.menuHeader}>
      <div onClick={onBack}>
        <WrapIcon
          icon={<Svg_Left w={12} h={12} c={"var(--text-secondary)"} />}
          w={"32px"}
        />
      </div>
      <p className="text_5">Chế độ giao diện</p>
      <Svg_Mode w={16} h={16} c={"var(--text-secondary)"} />
    </div>
    <div style={{ padding: 8 }}>
      <div
        className={`${styles.menu_li} text_5_400`}
        style={{ justifyContent: "space-between" }}
        onClick={toggleTheme}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Svg_Dark w={18} h={18} c={"var(--text-secondary)"} />
          <p>Giao diện Tối</p>
        </div>
        <Switch checked={isDark} size="small" />
      </div>
    </div>
  </div>
);

// --- 3. COMPONENT NAV CHÍNH ĐÃ ĐƯỢC ĐƠN GIẢN HÓA ---
export default function Nav({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Lọc các mục nav mà người dùng có quyền xem
  const navItems = useMemo(() => {
    const isAdmin = Array.isArray(user?.role) && user.role.includes("Admin");
    return NAV_CONFIG.filter((item) => !item.adminOnly || isAdmin);
  }, [user]);

  // Đơn giản hóa logic tìm mục đang active
  const activeIndex = useMemo(() => {
    // Tìm mục khớp chính xác nhất (dài nhất)
    let bestMatch = -1;
    let bestMatchLength = -1;
    navItems.forEach((item, index) => {
      if (
        pathname.startsWith(item.href) &&
        item.href.length > bestMatchLength
      ) {
        bestMatchLength = item.href.length;
        bestMatch = index;
      }
    });
    return bestMatch === -1 ? 0 : bestMatch; // Mặc định là mục đầu tiên
  }, [pathname, navItems]);

  // Các state khác giữ nguyên
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState("main"); // Dùng chuỗi: 'main' hoặc 'theme'
  const [isDark, setIsDark] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // useEffect cho theme và thanh highlight
  useEffect(() => {
    const theme = localStorage.getItem("theme");
    if (theme === "dark") {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const newTheme = !prev;
      localStorage.setItem("theme", newTheme ? "dark" : "light");
      document.documentElement.classList.toggle("dark", newTheme);
      return newTheme;
    });
  };

  return (
    <>
      <div className={styles.mainNavContainer}>
        <div className={styles.logoContainer}>
          <p className="text_1">
            <span style={{ color: "var(--main_d)" }}>i</span>
            <span>Trail</span>
          </p>
        </div>
        <div className={styles.navLinksContainer}>
          <div
            className={styles.highlight}
            style={{ transform: `translateY(${activeIndex * ITEM_HEIGHT}px)` }}
          />
          {navItems.map(({ href, icon, content }) => (
            <div
              key={href}
              className={styles.navItem}
              onClick={() => startTransition(() => router.push(href))}
            >
              {icon(
                pathname.startsWith(href)
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
              )}
              <p className={styles.navText}>{content}</p>
            </div>
          ))}
        </div>
        <div>
          <Menu
            isOpen={isMenuOpen}
            onOpenChange={(isOpen) => {
              setIsMenuOpen(isOpen);
              if (!isOpen) setMenuView("main"); // Reset về menu chính khi đóng
            }}
            menuItems={
              menuView === "main" ? (
                <MainMenuContent
                  onThemeClick={() => setMenuView("theme")}
                  onLogout={logoutUser}
                />
              ) : (
                <ThemeMenuContent
                  onBack={() => setMenuView("main")}
                  isDark={isDark}
                  toggleTheme={toggleTheme}
                />
              )
            }
            menuPosition="top"
            customButton={
              <div className={styles.navItem} style={{ marginBottom: 8 }}>
                <Svg_Menu w={22} h={22} c={"var(--text-primary)"} />
                <p className={styles.navText} style={{ marginTop: 2 }}>
                  Thêm
                </p>
              </div>
            }
          />
        </div>
      </div>
      {isLoggingOut && (
        <div className={styles.loadingOverlay}>
          <Loading
            content={
              <p className="text_6_400" style={{ color: "white" }}>
                Đang đăng xuất...
              </p>
            }
          />
        </div>
      )}
    </>
  );
}
