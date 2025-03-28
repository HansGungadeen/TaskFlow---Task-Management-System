import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard-layout";
import TimeReports from "@/components/time-reports";
import { createClient } from "../../../supabase/server";

export default async function ReportsPage() {
  const supabase = await createClient();
  
  // Check if the user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 px-4">
        <h1 className="text-3xl font-bold mb-6">Time Reports</h1>
        <TimeReports userId={user.id} />
      </div>
    </DashboardLayout>
  );
} 