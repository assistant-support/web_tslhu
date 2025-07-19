// app/layout.js
export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/session"; // Import hàm quản lý session mới
import Nav from "@/components/(layout)/nav";
import "@/styles/all.css";
import air from "./layout.module.css";
import { PanelProvider } from "@/contexts/PanelContext";
import PanelManager from "@/components/(features)/panel/PanelManager";
import { CampaignProvider } from "@/contexts/CampaignContext";

export const metadata = {
  title: "iTrail",
  description: "Chăm sóc tuyển sinh tự động",
};

export default async function RootLayout({ children }) {
  // Gọi hàm đã được cache để lấy thông tin user
  const userData = await getCurrentUser();

  return (
    <html lang="vi">
      <body>
        <CampaignProvider>
          <PanelProvider>
            <div className={air.layout}>
              {/* Thanh Nav chỉ hiển thị nếu user đã đăng nhập */}
              {userData && (
                <div className={air.nav}>
                  <Nav user={userData} />
                </div>
              )}
              <div className={air.main}>{children}</div>
            </div>
            <PanelManager />
          </PanelProvider>
        </CampaignProvider>
      </body>
    </html>
  );
}
