// app/layout.js
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import Nav from "@/components/(layout)/nav";
import "@/styles/all.css";
import air from "./layout.module.css";
import { PanelProvider } from "@/contexts/PanelContext"; // Import PanelProvider
import PanelManager from "@/components/(features)/panel/PanelManager"; // Import PanelManager
import { CampaignProvider } from "@/contexts/CampaignContext"; // Import CampaignProvider

// Hàm helper để lấy thông tin user, có thể tái sử dụng
async function getUserData() {
  const token = cookies().get("token")?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
}

export const metadata = {
  title: "iTrail",
  description: "Chăm sóc tuyển sinh tự động",
};

export default async function RootLayout({ children }) {
  // Lấy dữ liệu người dùng một lần duy nhất ở đây
  const userData = await getUserData();

  return (
    <html lang="en">
      <body>
        {/* Middleware đã đảm bảo rằng nếu code chạy đến đây,
                  người dùng chắc chắn đã được xác thực (trừ khi họ ở trang /login).
                  Chúng ta chỉ cần truyền userData xuống cho các component con.
                */}
        <CampaignProvider>
          <PanelProvider>
            <div className={air.layout}>
              {/* Thanh Nav chỉ hiển thị nếu có userData */}
              {userData && (
                <div className={air.nav}>
                  <Nav user={userData} />
                </div>
              )}
              <div className={air.main}>{children}</div>
            </div>
            {/* PanelManager render bên ngoài layout chính để có z-index cao nhất */}
            <PanelManager />
          </PanelProvider>
        </CampaignProvider>
      </body>
    </html>
  );
}
