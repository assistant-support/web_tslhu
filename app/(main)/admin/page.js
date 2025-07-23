// app/(main)/admin/page.js
// File này giờ là Server Component để fetch dữ liệu
import { getRunningJobs, getLabel } from "@/app/actions/campaignActions";
import AdminPageClient from "./AdminPageClient"; // Chúng ta sẽ tạo component này ngay sau đây

export default async function AdminPage() {
  // Gọi server action để lấy dữ liệu ngay trên server
  const [runningJobsData, campaignsData] = await Promise.all([
    getRunningJobs(),
    getLabel(),
  ]);

  // Truyền dữ liệu đã fetch được xuống cho Client Component
  return (
    <AdminPageClient
      initialRunningJobs={runningJobsData}
      initialCampaigns={campaignsData}
    />
  );
}
