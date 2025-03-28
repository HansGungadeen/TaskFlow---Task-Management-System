import { redirect } from "next/navigation";
import TaskAnalytics from "@/components/task-analytics";
import DashboardLayout from "@/components/dashboard-layout";
import { createClient } from "../../../supabase/server";

export default async function AnalyticsPage() {
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
        <TaskAnalytics userId={user.id} />
      </div>
    </DashboardLayout>
  );
} 