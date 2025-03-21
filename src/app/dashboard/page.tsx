import DashboardNavbar from "@/components/dashboard-navbar";
import TaskDashboard from "@/components/task-dashboard";
import { InfoIcon, UserCircle, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "../../../supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Fetch user's tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch user's teams (teams they created or are a member of)
  const { data: ownedTeams } = await supabase
    .from("teams")
    .select("id, name")
    .eq("created_by", user.id);

  const { data: memberTeams } = await supabase
    .from("team_members")
    .select(`
      team_id,
      teams:team_id (
        id,
        name
      )
    `)
    .eq("user_id", user.id)
    .neq("teams.created_by", user.id); // Exclude teams the user created

  // Format teams for the component
  const userTeams = [
    ...(ownedTeams || []).map(team => ({ id: team.id, name: team.name })),
    ...(memberTeams || []).filter(item => item.teams).map(item => ({ 
      id: item.teams.id, 
      name: item.teams.name 
    }))
  ];

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8 flex flex-col gap-8">
          {/* Header Section */}
          <header className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold">Task Dashboard</h1>
              <Link href="/teams">
                <Button variant="outline" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Manage Teams</span>
                </Button>
              </Link>
            </div>
            <div className="bg-secondary/50 text-sm p-3 px-4 rounded-lg text-muted-foreground flex gap-2 items-center">
              <InfoIcon size="14" />
              <span>Manage and organize your tasks efficiently</span>
            </div>
          </header>

          {/* Task Dashboard Section */}
          <section className="bg-card rounded-xl p-6 border shadow-sm">
            <TaskDashboard 
              initialTasks={tasks || []} 
              userTeams={userTeams}
              userId={user.id}
            />
          </section>
        </div>
      </main>
    </>
  );
}
