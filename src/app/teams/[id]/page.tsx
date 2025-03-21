import { redirect } from "next/navigation";
import DashboardNavbar from "@/components/dashboard-navbar";
import { createClient } from "../../../../supabase/server";
import TeamDetail from "@/components/team-detail";
import { ArrowLeft } from "lucide-react";
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
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8 flex flex-col gap-8">
          {/* Header Section */}
          <header className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Link href="/teams" className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-3xl font-bold">{team.name}</h1>
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
        </div>
      </main>
    </>
  );
} 