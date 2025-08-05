// ++ ADDED: Component mới để hiển thị thông tin Zalo đồng bộ
import Image from "next/image";

const ZaloDisplay = ({
  name,
  phone,
  avatar,
  nameClass = "font-medium",
  phoneClass = "text-xs text-gray-500",
}) => {
  return (
    <div className="flex items-center gap-2">
      <Image
        src={avatar || "/images/placeholder.jpg"}
        alt={name || "Zalo Avatar"}
        width={32}
        height={32}
        className="rounded-full h-8 w-8 object-cover"
      />
      <div>
        <p className={nameClass}>{name || "N/A"}</p>
        {phone && <p className={phoneClass}>{phone}</p>}
      </div>
    </div>
  );
};

export default ZaloDisplay;
