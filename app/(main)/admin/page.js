import {
  getRunningJobs,
  getLabel,
  getArchivedJobs,
} from "@/app/actions/campaignActions";
import AdminPageClient from "./AdminPageClient";

export default async function AdminPage() {
  const [runningJobsData, campaignsData, archivedJobsData] = await Promise.all([
    getRunningJobs(),
    getLabel(),
    getArchivedJobs(), // Gọi action mới
  ]);

  return (
    <AdminPageClient
      initialRunningJobs={runningJobsData}
      initialCampaigns={campaignsData}
      initialArchivedJobs={archivedJobsData} // Truyền dữ liệu mới xuống
    />
  );
}
