import { redirect } from "next/navigation";
import TaskAnalytics from "@/components/task-analytics";
import DashboardLayout from "@/components/dashboard-layout";
import { createClient } from "../../../../../supabase/server";

export default async function TeamAnalyticsPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  
  // Check if the user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Check if user is a member of this team
  const { data: teamMember, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("team_id", params.id)
    .eq("user_id", user.id)
    .single();

  if (error || !teamMember) {
    redirect("/dashboard");
  }

  // Get team data for display purposes
  const { data: team } = await supabase
    .from("teams")
    .select("name, description")
    .eq("id", params.id)
    .single();

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{team?.name} Analytics</h1>
          {team?.description && (
            <p className="text-muted-foreground mt-2">{team.description}</p>
          )}
        </div>
        <TaskAnalytics teamId={params.id} />
      </div>
    </DashboardLayout>
  );
} 