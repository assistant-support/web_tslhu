export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import Layout_Login from "@/app/(auth)/login";
import Nav from "@/components/(layout)/nav";
import "@/styles/all.css";
import air from "./layout.module.css";
import { Get_user } from "@/data/users";
import { PanelProvider } from "./contexts/PanelContext";
import PanelContainer from "@/components/panels/PanelContainer";

export const metadata = {
  title: "iTrail",
  description: "Chăm sóc tuyển sinh tự động",
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.token)?.value;
  let userData = null;

  if (token) {
    try {
      const response = await fetch(`${process.env.URL}/api/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ source: 1 }),
        cache: "no-store",
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 2) {
          userData = result.data; // Gán dữ liệu người dùng vào biến userData
        }
      }
    } catch (error) {
      console.error("Lỗi khi kiểm tra token:", error);
      // Nếu có lỗi, userData vẫn là null và sẽ hiển thị trang login
    }
  }

  return (
    <html lang="en">
      <body>
        <PanelProvider>
          {userData ? (
            <div className={air.layout}>
              <div className={air.nav}>
                <Nav user={userData} />
              </div>
              <main className={air.main}>{children}</main>
              {/* Đặt PanelContainer ở đây để nó hiển thị đè lên trên */}
              <PanelContainer />
            </div>
          ) : (
            <Layout_Login />
          )}
        </PanelProvider>
      </body>
    </html>
  );
}
