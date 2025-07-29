// app/(main)/layout.js
import { getCurrentUser } from "@/lib/session";
import Nav from "@/components/(layout)/nav";
import styles from "./layout.module.css";
import PanelManager from "@/components/(features)/panel/PanelManager";
import { PanelProvider } from "@/contexts/PanelContext";

export default async function MainLayout({ children }) {
  const userData = await getCurrentUser();

  return (
    <PanelProvider>
      <div className={styles.layout}>
        {userData && (
          <div className={styles.nav}>
            <Nav user={userData} />
          </div>
        )}
        <div className={styles.main}>
          {children}
          <PanelManager />
        </div>
      </div>
    </PanelProvider>
  );
}
