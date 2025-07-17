// app/dev/page.js
import styles from "./dev.module.css";

export default function DevPage() {
  return (
    <div className={styles.container}>
      <iframe
        // THÊM CLASSNAME VÀO ĐÂY
        className={styles.iframe}
        src="https://docs.google.com/spreadsheets/d/1Hv5sRpvDsTHOfRIqf6b3akMpas9C2I6tshJQaxWkJMY/edit?gid=0#gid=0"
        title="Google Sheet Dev" // Thêm title để tốt cho SEO và người dùng khiếm thị
      ></iframe>
    </div>
  );
}
