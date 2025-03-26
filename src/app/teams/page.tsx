import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard-layout";
import TeamManagement from "@/components/team-management";
import { createClient } from "../../../supabase/server";
import { InfoIcon, Users } from "lucide-react";

export default async function TeamsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Fetch user's teams (teams they created or are a member of)
  const { data: ownedTeams } = await supabase
    .from("teams")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  const { data: memberTeams } = await supabase
    .from("team_members")
    .select(`
      team_id,
      role,
      teams:team_id (
        id,
        name,
        description,
        created_by,
        created_at,
        updated_at
      )
    `)
    .eq("user_id", user.id)
    .neq("teams.created_by", user.id);  // Exclude teams the user created

  // Format member teams
  const formattedMemberTeams = memberTeams?.map(item => ({
    ...item.teams,
    memberRole: item.role
  })) || [];

  return (
    <DashboardLayout>
      {/* Header Section */}
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Team Management</h1>
        <div className="bg-secondary/50 text-sm p-3 px-4 rounded-lg text-muted-foreground flex gap-2 items-center">
          <InfoIcon size="14" />
          <span>Create and manage teams to collaborate on tasks</span>
        </div>
      </header>

      {/* Team Management Section */}
      <section className="bg-card rounded-xl p-6 border shadow-sm">
        <TeamManagement 
          ownedTeams={ownedTeams || []} 
          memberTeams={formattedMemberTeams}
          currentUserId={user.id}
        />
      </section>
    </DashboardLayout>
  );
} 