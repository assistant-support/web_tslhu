// File: app/actions/zaloAccountActions.js
"use server";

import connectDB from "@/config/connectDB";
import ZaloAccount from "@/models/zalo";
import User from "@/models/users";
import { revalidatePath } from "next/cache";
import { revalidateAndBroadcast } from "@/lib/revalidation";

/**
 * Lấy tất cả tài khoản Zalo CÓ PHÂN TRANG.
 */
export async function getZaloAccounts({ page = 1, limit = 10 } = {}) {
  try {
    await connectDB();
    const skip = (page - 1) * limit;
    const [accounts, total] = await Promise.all([
      ZaloAccount.find({})
        .populate("users", "name email phone role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ZaloAccount.countDocuments({}),
    ]);

    return {
      success: true,
      data: JSON.parse(JSON.stringify(accounts)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  } catch (error) {
    console.error("Lỗi khi lấy danh sách tài khoản Zalo:", error);
    return { success: false, error: error.message, data: [], pagination: {} };
  }
}

/**
 * Lấy tất cả user trong hệ thống (để gán quyền).
 * @returns {Promise<Array>} Mảng các user.
 */
export async function getAllUsers() {
  try {
    await connectDB();
    const users = await User.find({}).select("name email phone role").lean(); // Lấy thêm phone và role
    return JSON.parse(JSON.stringify(users));
  } catch (error) {
    console.error("Lỗi khi lấy danh sách người dùng:", error);
    return [];
  }
}

/**
 * Gán hoặc thu hồi quyền truy cập của một user vào một tài khoản Zalo.
 * @param {string} accountId - ID của tài khoản Zalo.
 * @param {string} userId - ID của user.
 * @returns {Promise<object>} Kết quả { success: true } hoặc { error: '...' }.
 */
export async function toggleUserAccess(accountId, userId) {
  try {
    await connectDB();
    const account = await ZaloAccount.findById(accountId);
    if (!account) throw new Error("Không tìm thấy tài khoản Zalo.");

    const userIndex = account.users.findIndex((id) => id.toString() === userId);

    if (userIndex > -1) {
      // Nếu đã có -> Xóa (thu hồi quyền)
      account.users.splice(userIndex, 1);
    } else {
      // Nếu chưa có -> Thêm (gán quyền)
      account.users.push(userId);
    }

    await account.save();
    revalidateAndBroadcast("zalo_accounts");
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Lấy thông tin chi tiết của một tài khoản Zalo, bao gồm cả các user được gán.
 * @param {string} accountId - ID của tài khoản Zalo.
 * @returns {Promise<object|null>} Chi tiết tài khoản hoặc null.
 */
export async function getZaloAccountDetails(accountId) {
  try {
    await connectDB();
    const account = await ZaloAccount.findById(accountId)
      .populate("users", "name email phone role") // Lấy thêm phone và role
      .lean();
    if (!account) return null;
    return JSON.parse(JSON.stringify(account));
  } catch (error) {
    console.error("Lỗi khi lấy chi tiết tài khoản Zalo:", error);
    return null;
  }
}

// ++ ADDED: Hàm mới để cập nhật chi tiết tài khoản
/**
 * Cập nhật các trường thông tin cho một tài khoản Zalo.
 * @param {string} accountId - ID của tài khoản Zalo.
 * @param {object} dataToUpdate - Dữ liệu cần cập nhật.
 * @returns {Promise<object>} Kết quả thực thi.
 */
export async function updateZaloAccountDetails(accountId, dataToUpdate) {
  try {
    await connectDB();
    const updatedAccount = await ZaloAccount.findByIdAndUpdate(
      accountId,
      { $set: dataToUpdate },
      { new: true, runValidators: true },
    );
    if (!updatedAccount)
      throw new Error("Không tìm thấy tài khoản để cập nhật.");
    revalidateAndBroadcast("zalo_accounts");
    return { success: true, data: JSON.parse(JSON.stringify(updatedAccount)) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ++ ADDED: Hàm mới để xóa tài khoản Zalo
/**
 * Xóa một tài khoản Zalo khỏi hệ thống.
 * @param {string} accountId - ID của tài khoản Zalo.
 * @returns {Promise<object>} Kết quả thực thi.
 */
export async function deleteZaloAccount(accountId) {
  try {
    await connectDB();
    // Thêm các bước kiểm tra an toàn khác ở đây nếu cần (ví dụ: không cho xóa nếu đang có chiến dịch chạy)
    await ZaloAccount.findByIdAndDelete(accountId);
    revalidateAndBroadcast("zalo_accounts");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Tạo một tài khoản Zalo mới.
 * @param {object} accountData - Dữ liệu tài khoản.
 * @returns {Promise<object>} Kết quả thực thi.
 */
export async function createZaloAccount(accountData) {
  try {
    await connectToDB();
    const { name, phone, action: scriptAction, avt } = accountData;

    if (!name || !phone) {
      throw new Error("Tên tài khoản và Số điện thoại là bắt buộc.");
    }

    const newAccount = await ZaloAccount.create({
      ...accountData,
      rateLimitPerHour: 30, // Giá trị mặc định
      rateLimitPerDay: 200, // Giá trị mặc định
      avt:
        avt ||
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxATEhUSEhIVFRUVFRUYFRUVFRcWFxUVFRUWFhcSFRUYHSggGBolHRUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGhAQFy0fHSUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAOEA4QMBEQACEQEDEQH/xAAbAAEAAQUBAAAAAAAAAAAAAAAABgECAwQFB//EAD8QAAIBAgMECAMGBAQHAAAAAAABAgMRBCExBQYSUSJBYXGBkaGxMlLBEyNictHhM0KCsgcVovAUJDRDc4PC/8QAGgEBAAMBAQEAAAAAAAAAAAAAAAECBAMFBv/EACwRAQACAgEDAwMEAgMBAAAAAAABAgMRBBIhMQUTQSIyURVSYXEUM0KBkSP/2gAMAwEAAhEDEQA/APcQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFLhCkpJaspa8VjcymZ01am0ILrv3Z+piyepYKdt7lznLWGCW1eUfNmO/rP7auU5/xDG9qT+Vepy/Wb/FYP8j+FVtSfyr1I/Wcn7IR/kMkNqrrjY709YrP3V0vHIj8NiljoS/mt35G7Fz8GTxbS9ctZbNzXE78OgWFQAAAAAAAAAAAAAAAAAAAAUkyJnUbHPxW0Uso5vn1fuePyvVK1npp3cb5ojw5eIxV/ik32fseJlz5Ms/VLNN5lrSxD6l9fYpFZntCIiWSNCtLSMvK3uaKcPNbxVeMdp+GRbNr8v8AUjtHpuf9qfasPZtfl/qRb9NzftPZssnRrR1hLyv7Ga3DzV81VnHMfCxV+aOE0ms+O6um1h8XJZqWXI74eXlxT2lauS1XVwuPjLJ5P0fce/xfUcebtbtLTTLFuzcTPRdVQAAAAAAAAAAAAAAAAABbKSWpFrRWNyiXGx2NcsllH3Pmubz7ZZ6KeGXLlme0Obxyk+GCefL/AHkefjx2vOq95corvw6OF2L11H4J+7Pb4/pXzllorh/Lq0MNCHwxS8Mz1KYMdI+mrtFYjwzHZYuBo4rbOGpu060E+V7vyRE3iPMrRW0taO82CeX28fFSXuivuVn5T7dvw2Yyw9ddGUJ9sWm15Zo53w4ssamHO1PzDSxWx2s6b8H9GeVn9L1G8bhbD+GjGedpZNeZ4t6Wxz37SzTEw6uBx38svB/qezwPUJ+zI0Ys3xLqXPd3220qkgAAAAAAAAAAAAAABQDlbUxLfQXj+h8/6py5mfbr/wBs2a8+IcuFOVSXBHz5dp5vH49s1umHGleqdLtqbYo4NfZwXHVazXLtm+ruWZ9JixY+PXtHd6OLj9kQx28OKqvpVZRXywbgvTN+LZE5LT8tdcVY+GisVUWaqTv+aX6ldz+VumPw26O3cXHSvU8Xxf3XJi94R0V/DHitr4mplOtNrley8lkJvM+ZIpWPhpJFdraB5SupzcXxRbTWjTs13NExMwiYiUq2BvlKLVPEvii7JVbdKP5+a7dTvTLPiWe+H5hMMXg4VYqSebScZLrTzXeinK4dM9f5ZL44t5ceKabjJZrX9T5fLjtivNZYrVmsutszFX6L1Wnce96Zy5yR0Wnu04r77S6CPXd1QAAAAAAAAAAAAAALZ6O3IpeZis6RKKTrSeVuk8nzvc+QvS9sk/M7YJ3MtnaOLWDwzl/3Z5JP5n9Esz6Hj4o4+L+ZehgxeIedTm5Nyk7tttt6tvVsie70I7QtISACYQt4gLmwLFIkXXAtkwiUs3F264SWGqPoyf3b+WXy9z9+874r67OGXH8pftjC8S44rpR6ucetGT1Hi+5Tqr5YstNxtxoYxpppZ3/2jwcE2pkiY8stbaslVN5I+xpO6xLdC4skAAAAAAAAAAAAABRhDm7IpqSnUaTcqkrPs0Vis4qb3ru5447bQrfrGceI4FpTjb+qWbflYyZp7t+GOyOHHbuACRSTArSoOUZz6oJX75NJL1b8BsY5SJVZcDhXVqRgsrvXWy5kWnSaxtdjsHOjLhmu59UlzTIidpmNNYlCsZNNNOzWj5PqZKNPXtgY9V6FOr1tdJcpLKS8zdSdwxXrqdMO1qUYOnUSStNcVlr3+RHsY99XT3Zska1MOvE6O6oAAAAAAAAAAAAAAFlV2TfYwi3aJaWxP4MO2/uxKmLw8v2zV4sRWlzq1PJSaXokefkndnpY41WGoUXCdIUbArhqE6klCCu35Lm2+pEWnR5l29t0I0cPClF5yleT+Zpa912VrO+69o1CPHRzS3djZjivtJK0pKyXKOvmzjadu1Y02d4cDx0pWXSh0o+Gq8URX6ZTaNxtCTQ4BAnf+G2K6FWk3pKM1/UrP+1eZpwTuNM+aO+0m27C9GXZZ+TNMMeX7W3hZ3hF84p+gleviGUhYAAAAAAAAAAAAABjr/DLufsFbeJc3Z2JjChBvPWyXeZuVyaceI6nOl4rXu8wxj+8qP8AHP8AuZl6uv6oepj1NYlhC6yUyyNt3AbJq1mmlwx+aWS8F1lJtELRWZS/Z2zKdGForpPWT1f6LsKT4XiNI3t3jrV3GnFy4Ojlpf8Amu9E+rwJxzEeUX7z2b+x93eFqdW0mtI6pPt5v0Fp/BEJJGNiISsrorPZaEarbBX2FkvvIubT5ridovwsWi6s07Iydo7w5SkW5GO+yrTyvxU2rdqlF/qUycj2a9Wts3JnprtNq2PjVo1FazUXk/c0cPmV5E+NSwzki1ZdDZv8KH5V7G2fLpj+2GyQuAAAAAAAAAAAAAA1cfjKdKLlUkox0u+vuQRMIzs3Hwqw4Y3+7bTurfE7q3gfP+tW3arJeJjtKHbUhatUX4m/PP6nfj23jh6+Cd44akmd3ZNMFsajC1oJyVrylm788zh1TLtFYh1I07ExCsyq4otoFBEaF1gBItlG5WY2mJ0xTWZSfK8d4QHa1DgrVI9XE2u55r3NNfDPaO7Z3c/jf0S+hj5v+ti5n2JFjseqMJSabuuGyfPO/wDpOPpdpjM82kTbtDv7ubdoV4xpwdpxirwlk8tWuaPo97bKxqNO4SsAAAAAAAAAAAABZOSSu9EQPLNtbSliKspvTSC+WPLx1ZSfKJdLdPSp3w9meD6t5qzZ/hy94qdq77Un9PoX4U7xt/Dn6GlgYcVWmuc4+5rnw2R5T+icau1mU6KgAAAAEDDV1KWXohm8y+/l2qL9LfQ7UcsnlTdqP3r7IP1aMfO+zTz+Z9um/vM/u4/+Rf2yKemf7J/phw/cj2HrShKM4u0otNPk0fQNL2LZWL+2o06unHFO3JtZrzLQmG2SkAAAAAAAAAAAGvj4t0qiWrhJLvcWQPIik+UJBum/4v8A6/aR4Xq/mrNn+GpvXG1SL5xfo/3K+nz9MtfB7xLn7H/6il+b6M328PRr5TqkcaO1mU6KAAAAAEDDV1KXXqhm87+/f5Y+37nbH4cr+WXdeOdR9iXq39DDz57Q83mz4bG9H8OP5/8A5ZHpf+yf6Y8PlGz32p65utQcMLRi9eBPPVcTcrepeEuqSAAAAAAAAAAAApYCAbz7uTpylVoxcqbbbjFXcG9cutX5aFJhDW3QvetdNP7vJ5fOeJ6vGorP9s+f4Y97fjh3P6HH0+Pplq4HiXK2VK1el+b3y+p6FvD0KzqU8panGjvZlOigAAAAA0MFTU5W7r1QTa9Tiq1G/na8I5fQ718ON57uruxHoTfOVvJL9TzPUJ7xDyubPeIZtvYWrUhGNOnKb4rvhTlZWau7dR19Kj65cMMd2fd3c6o5qpiFwwTT4Hm5Z6O2i9z6CIanoCRMCpIAAAAAAAAAAAABSxGhztrw+F253fkeN6xS1q1mI/LhniZhAN6p3qxXKP1/Yz+nxPTLTwftlx6VThnGXyyT8mmb58N70OlqzhXy7W8Mp0VAAAAAA1K9RJOT0Sbfcszl5lfxCAV6nE3J6ttvvbuaI7OEpXu5gKn/AA8ZqLalKTy6rPh01/lMHM42S1uqsbh5fLrNr9ko2DhpR4pSTV7JX/Q1+mYbU3No0pipNfLrnrOypIAAAAAAAAAAAAAAAUkr6lbVi3mB5fvhUTxc1HJRUY5c0rv1foYslYrOqw14axFXDqaFHVO9h4jjpQl18Nn3rJ+xw8S673V0S4AAAACkmRJDg7yYnhpcPXN28FnL6eZFI3O1rzqERqHaHGXqe5sf+Tpdqk/Ocjdi+1hyfdLtF/CipIAAAAAAAAAAAAAAAAMWJqqEXKWkU2+5K5EzpMd5eO4ms5zlN6zlKT75O/1PPnvO26I1DFLQJdndbaahL7Gek30X+PLo+NvNFL1+YXrPwmSKrLZySTb0Wb7hCJ7eUcrb0O74aa4U8uJu77ctDTXBE+ZZLcnU9oWPemaT+6jl+Jr6E+xCP8n+EjjXi4qd0k0nm0smrmaazDVFonu5+O25h4Zcak+UOl66E+3e3bSvvUqiu0toOtLitZJWir37y0U6exF+vu0prIkenbkVU8HT7HNeUmbMX2seX7nfOrmAAAAAAAAAAAAAAAAAEY382ioUFTT6VV2/ojZyfsvE4Zr6jUOuGu5287bMjXtjcyUMNeF4vu9VmiYEz3P2469NxqfxKdk5acSd7S78szneIh0jcu7iIcUZR5xa81YVmILxuNIPW2dWi2nSm89VFyXemrmyMlZju8+2O++0MbwVZ5KlO75xkl4tqw9ysfKPZvPw6NLdiT+Ool+VN+V9DPbkx8Q1V4s67y4G8FalTcqNGLvHKdSTu2/litEubtcRktbue1WqtD4Y9y9isukL2iNpTD/DraCXHh282+OPklJLyT8zVgt8MuavynZocAkAAAAAAAAAAAAAAAKMgee7wbKx+IrymqLUV0YJyh8K69dXm/EzZKTbw0Y7RWEfxexsZDXDVn+WPGvONynt2+XT3KtWGzcdN2hhKy/NTkvWSSHtye5DBtOhWopQqQcZyTSXOzs2ktc8u0jptHwmLRKS7m7Hr0VJ1YOH2nDwp/FZcV21qtes45Y7uuK0eUnjUtkzj1O3TvvDLkW3GlO8LJOKK7haImWCc7lYl16dQhe9O6+Ii5YmC+0pzblLhXSp98eta5m7HT6Nww3yR1TEuTs7EJx4b5r2KTCYlt3KrL6NaUJRnBuMou6a6i8T091ZrvtL0vdveOniY8LtGqlnDnb+aF9V7GumSLMl8c1d1M6uaoAAAAAAAAAAAAAAACgAARqDcuZjcPQjUVeVOMqqjwxlJXcVm+jf4e9GTk8iuH+5Ra+uzQcpSk5SMUWtbvZ6WOvTSIJ009S01iXWLTDBKg+o5zWXSLx8qKjIdMk3j4K0LWsRapS2/LY2fjJRdtVy9yv+RbBbfw8/nU6PrhZj90MDiPvFDglLPjpvgz5uOjfgetSaZaxaGeuWddmvjNxaMl0KkqcudlKN+t8LzXXlcn2YdIzWhpYTcCXE/tcQpRtlwQ4ZX7W216EexCffl2MDubhaclLpzlHNOUrWa6+jYvGKIUtlmUiR1c1QAAAAAAAAAAAAAAAFtSaSu3ZFbXrWNzJMtCttemtLy7tPNmDL6jhp47uVstYaM9r1JO0Uo+r7zz8nquSftjTnOaZ8LJzbd27vtMFctsmWJtO5Rhtu8bVPZe+EgAAtqQuitoKy16XxGLlfY4eoT/8AJsxxM4LoPzzM2DmZcMarPZ4lck1X0ttzXxRT7smb8fq1o+6rrGaXRw+1Kcuuz5PL1PRw8/Dk+dS6RkiW8bnQAAAAAAAAAAAAAAAAc3a2OdOyja79Eedz+XOCPp8ueS/T4cGtVlJ3k2+88DJmvkndpZZmZ7ysOaGWlWguvPuZEoZqVZS0v5WIrOpiU1nUxMM6PerO4iYfQ0ndYkLLgAAQMK+Js83m376ef6hk+mKsTxcO1PuMLymKUk84vL2ZYWhLYwuNqQ0eXJ5o14OXkxT9M7hauSYd7Z+OVRaWa1X1R73E5dc8eNS1Uv1Q3TYuAAAAAAAAAAAAAAjW2Z3qvsSXpf6nzXqF5tmmGTLP1NE89zALoxu7AbkI2ViiF6Z6/Dv1U1Pw9jhZOqnT+FTW2gACkmV8RO0MdNZHiZ79d5l4fJydeSZWV6d81qc4Z2qWSAAOhsSparbmmvqej6Xfpy6dcM90iR9I1KgAAAAAAAAAAABRoiUIni53nJ/iZ8pyr9WWzHed22wmZUAqpNZry59gG5Tmmroqhcjvx8nRdo42XovH4Xnsx429yO/eAlIBbPQzcq/RRm5WXooojxnh72w16tslr7ItA1iUgADY2fK1SH5kvPI1cO2s0L45+qEqPq2xUAAAAAAAAAAAALZvIredVlCHtnx+Sd2mWKfKhRAAArCbi7rTrX17yNIbqaauiJgXpnq8XN1V1L1+Hm6q9Mqmxt2EEzpYzxuTl67/AMPD5WX3L/wx1qlu/qX1OEQztQsASAAMlB2lF/iXujrgnWSv9rV8wlyPr48NqpIAAAAAAAAAAADHV0fcznk+yUT4RBHx9vMsMhAAAAF1Kpwvs61y7SJQ3Ey2LJ0WdMV5pbcL0e3Weqr3qWi9YmCTM/LzdNdQy8vN0V1HliqVLK/l2nk+XjtNtvN6stCQAAAAXQ1Xejpi++v9pr5TCJ9fXxDcqWAAAAAAAAAAAAUI/iRycfsi7coWT5dT7jyeV6b1zNqT3cr4993IrYecPii129XmePk4+TH2tVnmsx8MRxV0AAAF1Kpw/l5cu1ESNynNPQ28TNFY1Ldw8/T9MrKtVLv6lzMuXJ13mZZc+TrvMy1G23d6+y5Iq5gAAAEjJSoyl8Kb7jriw3yfbC0UmXUwWx3dSm7Wd0l2c2etxfTZiYtf/wAdaYfmXaSPahoVAAAAAAAAAAAAAAApwoiYifI1quApS1gvDL2M+TiYb+aqzSs+Yas9i03o5Lxv7mW3pWKfG4U9mssEth8p+a/c4W9I/FlfY/ljexKnVKPqcp9JyfFlZwysex634fP9jnPpmZE4bMf+T1upW7pFP0vMj2bC2RW+XzkR+m5/we1ZX/Ka3yrzJ/Tc/wCE+1ZetjVfw+f6IvX0vNPlPsyyR2HPrml3Js619Jv/AMrJjB+ZZ6exI9cm/Cxop6TSPMrRgj8tqls2jH+S/e2zVThYa+Kre3WPhtqCWiNUViPEOi4sAAAAAAAAAAAAAAAAAAAAUsBUAAGgAACAJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf//Z", // Avatar mặc định
    });

    revalidateAndBroadcast("zalo_accounts");
    return { success: true, data: JSON.parse(JSON.stringify(newAccount)) };
  } catch (error) {
    if (error.code === 11000) {
      return { success: false, error: "Số điện thoại đã tồn tại." };
    }
    return { success: false, error: error.message };
  }
}
