// components/(layout)/login/index.js
"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import styles from "./index.module.css";
import { Svg_ArowRight, Svg_Eye, Svg_unEye } from "@/components/(icon)/svg";
import { loginUser } from "@/app/actions/authActions"; // Import Server Action của bạn
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

// --- Component InputField (Đã được sửa lại) ---
// Giờ đây nó không cần quản lý state `value` nữa, chỉ cần nhận `name`.
const InputField = ({ label, name, type }) => {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasValue, setHasValue] = useState(false);

  const handleFocus = () => setFocused(true);
  const handleBlur = (e) => {
    if (e.target.value === "") {
      setFocused(false);
    }
  };
  const handleChange = (e) => {
    setHasValue(e.target.value !== "");
  };

  const inputType =
    type === "password" ? (showPassword ? "text" : "password") : type;
  const isLabelUp = focused || hasValue;

  return (
    <div className={styles.inputContainer} data-focused={focused}>
      <input
        id={name} // Thêm id để label có thể liên kết
        name={name} // QUAN TRỌNG: Thuộc tính `name` để Server Action đọc dữ liệu
        type={inputType}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        className={styles.inputField}
        required // Thêm yêu cầu bắt buộc của trình duyệt
      />
      <label
        htmlFor={name}
        className={`${styles.inputLabel} ${isLabelUp ? styles.up : ""}`}
      >
        {label}
      </label>
      {type === "password" && (
        <div
          onClick={() => setShowPassword(!showPassword)}
          className={styles.eyeIcon}
        >
          {showPassword ? (
            <Svg_Eye w={18} h={18} c={"gray"} />
          ) : (
            <Svg_unEye w={18} h={18} c={"gray"} />
          )}
        </div>
      )}
    </div>
  );
};

// --- Component Nút Submit Mới ---
// Phải là component con của form để dùng được useFormStatus
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${styles.submitButton} ${
        pending ? styles.unsubmit : styles.submit
      }`}
    >
      {pending ? (
        <div className={styles.spinner}></div>
      ) : (
        <Svg_ArowRight w={28} h={28} c={"white"} />
      )}
    </button>
  );
}

// --- Component Login Chính (Đã tái cấu trúc) ---
const LoginPage = () => {
  // Dùng useFormState để gọi Server Action và nhận kết quả
  // `initialState` là undefined, `loginUser` là action sẽ được gọi
  const router = useRouter(); // Khởi tạo router
  const [state, formAction] = useActionState(loginUser, undefined);

  useEffect(() => {
    // Nếu action trả về trạng thái success
    if (state?.success) {
      // BƯỚC 1: Làm mới dữ liệu từ server để nhận cookie mới
      router.refresh();

      if (state.role === "Admin") {
        router.push("/admin"); // Điều hướng Admin đến trang quản lý
      } else {
        router.push("/"); // Điều hướng Employee và các vai trò khác về trang chủ
      }
    }
  }, [state, router]);
  return (
    <>
      <p className="text_2">Đăng nhập</p>
      <div className={styles.formWrapper}>
        {/* Thẻ form giờ sẽ gọi Server Action */}
        <form action={formAction}>
          <InputField label="Email" name="email" type="email" />
          <InputField label="Mật khẩu" name="password" type="password" />

          <label className={styles.checkboxContainer}>
            <input
              type="checkbox"
              name="rememberMe" // Thuộc tính name cho checkbox
              className={styles["custom-checkbox"]}
            />
            <p className="text_5_400">Ghi nhớ tôi</p>
          </label>

          {/* Hiển thị lỗi trả về từ Server Action (nếu có) */}
          {state?.error && <p className={styles.errorMessage}>{state.error}</p>}

          <div className={styles.submitContainer}>
            <SubmitButton />
          </div>
        </form>
      </div>
    </>
  );
};

export default LoginPage;
