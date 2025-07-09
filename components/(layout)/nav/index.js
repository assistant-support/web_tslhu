"use client";

import { useState, useEffect, useMemo, startTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import air from "./index.module.css";
import {
  Svg_Dark,
  Svg_Left,
  Svg_Logout,
  Svg_Menu,
  Svg_Mode,
  Svg_Student,
  Svg_Course,
  Svg_Canlendar,
  Svg_Setting,
} from "../../(icon)/svg";
import Menu from "../../(ui)/(button)/menu";
import Switch from "@/components/(ui)/(button)/swith";
import WrapIcon from "../../(ui)/(button)/hoveIcon";
import Loading from "@/components/(ui)/(loading)/loading";
import Link from "next/link";

const ITEM_HEIGHT = 82;

// Icon mới cho mục Quản lý (bạn có thể thay bằng icon của mình)
const Svg_Admin = ({ w, h, c }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    height={h}
    width={w}
    fill={c}
  >
    <path d="M256 0c4.6 0 9.2 1 13.4 2.9L457.7 82.8c22 9.3 38.4 31 38.3 57.2c-.5 99.2-41.3 280.7-213.6 363.2c-16.7 8-36.1 8-52.8 0C61.3 420.7 20.5 239.2 20 140c-.1-26.2 16.3-47.9 38.3-57.2L242.7 2.9C246.8 1 251.4 0 256 0zm0 64C253.1 64 250.2 65 247.4 66.1l-192 80c-5.8 2.4-9.4 8.2-9.4 14.5c-.5 84.2 33.1 243.1 186.3 318.7c14.9 7.4 32.1 7.4 47.1 0C456.1 403.7 489.6 244.8 489.1 160.6c0-6.3-3.6-12.1-9.4-14.5l-192-80C261.8 65 258.9 64 256 64z" />
  </svg>
);

// Icon Chăm sóc khách hàng
const Svg_CustomerCare = ({ w, h, c }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 640 512"
    height={h}
    width={w}
    fill={c}
  >
    <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c10 0 18.8-4.9 24.2-12.5l-99.2-99.2c-14.9-14.9-23.3-35.1-23.3-56.1l0-33c-15.9-4.7-32.8-7.2-50.3-7.2l-91.4 0zM384 224c-17.7 0-32 14.3-32 32l0 82.7c0 17 6.7 33.3 18.7 45.3L478.1 491.3c18.7 18.7 49.1 18.7 67.9 0l73.4-73.4c18.7-18.7 18.7-49.1 0-67.9L512 242.7c-12-12-28.3-18.7-45.3-18.7L384 224zm24 80a24 24 0 1 1 48 0 24 24 0 1 1 -48 0z" />
  </svg>
);

const navItems = [
  {
    href: "/",
    icon: (
      <div style={{ marginBottom: 1 }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 640 512"
          height={19}
          width={20}
          fill={"var(--text-secondary)"}
        >
          <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c10 0 18.8-4.9 24.2-12.5l-99.2-99.2c-14.9-14.9-23.3-35.1-23.3-56.1l0-33c-15.9-4.7-32.8-7.2-50.3-7.2l-91.4 0zM384 224c-17.7 0-32 14.3-32 32l0 82.7c0 17 6.7 33.3 18.7 45.3L478.1 491.3c18.7 18.7 49.1 18.7 67.9 0l73.4-73.4c18.7-18.7 18.7-49.1 0-67.9L512 242.7c-12-12-28.3-18.7-45.3-18.7L384 224zm24 80a24 24 0 1 1 48 0 24 24 0 1 1 -48 0z" />
        </svg>
      </div>
    ),
    content: "Chăm sóc",
  },
];

export default function Nav({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  // const [load, setload] = useState(false);

  const navItems = useMemo(() => {
    const baseItems = [
      {
        href: "/",
        icon: <Svg_CustomerCare w={20} h={19} c={"var(--text-secondary)"} />,
        content: "Chăm sóc",
      },
    ];

    const isAdmin = Array.isArray(user?.role) && user.role.includes("Admin");

    if (isAdmin) {
      baseItems.push({
        href: "/admin", // Đường dẫn cho trang quản lý
        icon: <Svg_Admin w={20} h={20} c={"var(--text-secondary)"} />,
        content: "Quản lý",
      });
    }

    // Bạn có thể thêm các mục khác ở đây nếu cần
    return baseItems;
  }, [user]);

  const activeIndex = useMemo(() => {
    let bestMatchIndex = -1;
    navItems.forEach((item, index) => {
      if (item.href === "/") {
        if (pathname === "/") {
          if (
            bestMatchIndex === -1 ||
            item.href.length > navItems[bestMatchIndex].href.length
          ) {
            bestMatchIndex = index;
          }
        }
      } else if (pathname.startsWith(item.href)) {
        if (
          bestMatchIndex === -1 ||
          item.href.length > navItems[bestMatchIndex].href.length
        ) {
          bestMatchIndex = index;
        }
      }
    });
    return bestMatchIndex === -1 ? 0 : bestMatchIndex;
  }, [pathname]);

  const targetOffset = activeIndex * ITEM_HEIGHT;
  const [barOffset, setBarOffset] = useState(targetOffset);

  useEffect(() => {
    setBarOffset(targetOffset);
  }, [targetOffset]);

  const [activeMenu, setActiveMenu] = useState(1);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [isDark, setIsDark] = useState(false);
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
      if (newTheme) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
      return newTheme;
    });
  };
  const [load, setload] = useState(false);
  const logout = async () => {
    setload(true);
    try {
      const res = await fetch("/api/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setload(false);
      window.location.reload();
    }
  };

  const menuItems = (
    <div
      style={{
        listStyle: "none",
        margin: 0,
        width: 180,
        borderRadius: 12,
        background: "var(--bg-secondary)",
        boxShadow: "var(--boxshaw)",
        marginBottom: 8,
      }}
    >
      <div style={{ padding: 8, gap: 3 }} className="flex_col">
        <Link
          href={"/setting"}
          className={`${air.menu_li} text_5_400`}
          onClick={() => setActiveMenu(2)}
        >
          <Svg_Setting w={16} h={16} c={"var(--text-secondary)"} />
          Cài đặt
        </Link>
        <p
          className={`${air.menu_li} text_5_400`}
          onClick={() => setActiveMenu(2)}
        >
          <Svg_Mode w={16} h={16} c={"var(--text-secondary)"} />
          Giao diện
        </p>
      </div>

      <div
        style={{ padding: 8, borderTop: "thin solid var(--border-color)" }}
        onClick={logout}
      >
        <p className={`${air.menu_li} ${air.logout} text_5_400`}>
          <Svg_Logout w={16} h={16} c={"white"} />
          Đăng xuất
        </p>
      </div>
    </div>
  );

  const menuMode = (
    <div
      style={{
        listStyle: "none",
        margin: 0,
        width: 210,
        borderRadius: 12,
        background: "var(--bg-secondary)",
        boxShadow: "var(--boxshaw)",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          padding: 8,
          borderBottom: "thin solid var(--border-color)",
          justifyContent: "start",
          gap: 8,
        }}
        className="flex_center"
      >
        <div onClick={() => setActiveMenu(1)}>
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
          className={`${air.menu_li} text_5_400`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
          onClick={toggleTheme}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <Svg_Dark w={18} h={18} c={"var(--text-secondary)"} />
            <p style={{ flex: 1, marginLeft: 8 }}>Giao diện Tối</p>
          </div>
          <Switch
            checked={isDark}
            size="small"
            activeColor="#ffffff"
            inactiveColor="#ddd"
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div
        className="flex_col"
        style={{
          justifyContent: "space-between",
          height: "100%",
          alignItems: "center",
        }}
      >
        <div style={{ height: 100, width: 100 }} className="flex_center">
          <p className="text_1">
            <span style={{ color: "var(--main_d)" }}>i</span>
            <span>Trail</span>
          </p>
        </div>
        <div className={air.container}>
          <div
            className={air.highlight}
            style={{
              transform: `translateY(${barOffset}px)`,
              transition: "transform .2s .1s ease",
            }}
          />
          {navItems.map(({ href, icon, content }) => (
            <div
              key={href}
              className={air.navItem}
              onClick={() => startTransition(() => router.push(href))}
            >
              {icon}
              <p className={air.navText}>{content}</p>
            </div>
          ))}
        </div>
        <div>
          <Menu
            isOpen={isMenuOpen}
            menuItems={activeMenu === 1 ? menuItems : menuMode}
            menuPosition="top"
            customButton={
              <div className={air.navItem} style={{ marginBottom: 8 }}>
                <Svg_Menu w={22} h={22} c={"var(--text-primary)"} />
                <p className={air.navText} style={{ marginTop: 2 }}>
                  Thêm
                </p>
              </div>
            }
            style={`display: 'flex'`}
            onOpenChange={(isOpen) => {
              setIsMenuOpen(isOpen);
              if (!isOpen) setActiveMenu(1);
            }}
          />
        </div>
      </div>
      {load && (
        <div className={air.loading}>
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
