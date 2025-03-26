import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard-layout";
import { createClient } from "../../../../supabase/server";
import TeamDetail from "@/components/team-detail";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";

export default async function TeamDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Fetch team details
  const { data: team } = await supabase
    .from("teams")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!team) {
    return redirect("/teams");
  }

  // Check if the user is a member of this team
  const { data: teamMember } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!teamMember) {
    return redirect("/teams");
  }

  // Fetch team members
  const { data: teamMembers } = await supabase
    .from("team_members_with_users")
    .select("*")
    .eq("team_id", params.id);

  // Fetch team tasks
  const { data: teamTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("team_id", params.id)
    .order("created_at", { ascending: false });

  return (
    <DashboardLayout>
      {/* Header Section */}
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Link href="/teams" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-3xl font-bold">{team.name}</h1>
          <div className="ml-auto">
            <span className="bg-secondary px-3 py-1 rounded-full text-sm flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              <span>{teamMembers?.length || 0} members</span>
            </span>
          </div>
        </div>
        {team.description && (
          <p className="text-muted-foreground">{team.description}</p>
        )}
      </header>

      {/* Team Detail Section */}
      <section className="bg-card rounded-xl p-6 border shadow-sm">
        <TeamDetail 
          team={team}
          currentUser={user}
          teamMembers={teamMembers || []}
          teamTasks={teamTasks || []}
          userRole={teamMember.role}
        />
      </section>
    </DashboardLayout>
  );
} 