// ++ ADDED: Component mới để hiển thị thông tin User đồng bộ
const UserDisplay = ({
  name,
  phone,
  nameClass = "font-medium",
  phoneClass = "text-xs text-gray-500",
}) => {
  return (
    <div>
      <p className={nameClass}>{name || "N/A"}</p>
      {phone && <p className={phoneClass}>{phone}</p>}
    </div>
  );
};

export default UserDisplay;
