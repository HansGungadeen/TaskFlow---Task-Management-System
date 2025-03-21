import { redirect } from "next/navigation";
import DashboardNavbar from "@/components/dashboard-navbar";
import TeamManagement from "@/components/team-management";
import { createClient } from "../../../supabase/server";

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
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8 flex flex-col gap-8">
          {/* Header Section */}
          <header className="flex flex-col gap-4">
            <h1 className="text-3xl font-bold">Team Management</h1>
            <div className="bg-secondary/50 text-sm p-3 px-4 rounded-lg text-muted-foreground flex gap-2 items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
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
        </div>
      </main>
    </>
  );
} 