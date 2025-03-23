import DashboardNavbar from "@/components/dashboard-navbar";
import KanbanTaskView from "@/components/kanban-task-view";
import { InfoIcon, UserCircle, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "../../../../supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Define simple interface for team display
interface TeamInfo {
  id: string;
  name: string;
}

export default async function KanbanPage({ 
  searchParams 
}: { 
  searchParams?: { [key: string]: string | string[] | undefined } 
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }
  
  // Get the team ID from search params if present
  const teamId = searchParams?.team as string | undefined;
  const taskId = searchParams?.taskId as string | undefined;
  
  // Fetch user's tasks with all necessary related data
  let query = supabase
    .from("tasks")
    .select(`
      *,
      subtasks:subtasks (
        id,
        title,
        completed
      )
    `);
  
  // Only filter if there's a teamId  
  if (teamId) {
    query = query.eq("team_id", teamId);
  } else {
    // If no team filter, get all user-related tasks
    query = query.or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`);
  }
    
  const { data: tasks, error } = await query.order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching tasks:", error);
  }
  
  console.log("Server fetched tasks:", tasks?.length || 0);

  // Get user information for assigned tasks
  const assignedTaskIds = tasks
    ?.filter(task => task.assigned_to)
    .map(task => task.assigned_to) || [];
    
  let userMap: Record<string, any> = {};
  
  if (assignedTaskIds.length > 0) {
    const { data: assignedUsers } = await supabase
      .from("users")
      .select("id, email, name, avatar_url")
      .in("id", assignedTaskIds as string[]);
      
    if (assignedUsers) {
      userMap = assignedUsers.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<string, any>);
    }
  }

  // Process tasks to add computed properties
  const processedTasks = tasks?.map(task => {
    // Count completed subtasks
    const subtasksCount = task.subtasks?.length || 0;
    const completedSubtasksCount = task.subtasks?.filter((st: any) => st.completed)?.length || 0;
    
    // Create assignee_data object with full user details if available
    const assignee_data = task.assigned_to && userMap[task.assigned_to] 
      ? {
          id: userMap[task.assigned_to].id,
          email: userMap[task.assigned_to].email,
          name: userMap[task.assigned_to].name || null,
          avatar_url: userMap[task.assigned_to].avatar_url || null
        }
      : null;
    
    const processedTask = {
      ...task,
      subtasks_count: subtasksCount,
      completed_subtasks_count: completedSubtasksCount,
      has_dependencies: false,
      dependencies_completed: true,
      status: task.status || 'todo', // Ensure status has a default
      assignee_data
    };
    
    return processedTask;
  }) || [];
  
  console.log("Server processed tasks:", processedTasks.length, 
    "Status distribution:", {
      todo: processedTasks.filter(t => t.status === 'todo').length,
      in_progress: processedTasks.filter(t => t.status === 'in_progress').length,
      done: processedTasks.filter(t => t.status === 'done').length
    },
    "Sample tasks:", processedTasks.slice(0, 2)
  );

  // Fetch user's teams
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
    .neq("teams.created_by", user.id); 

  // Format teams for the component
  const userTeams: TeamInfo[] = [];
  
  // Add owned teams
  if (ownedTeams) {
    for (const team of ownedTeams) {
      userTeams.push({
        id: team.id,
        name: team.name
      });
    }
  }
  
  // Add member teams
  if (memberTeams) {
    for (const member of memberTeams) {
      // Use type assertion to tell TypeScript about the structure
      const teamData = member.teams as any;
      if (teamData && teamData.id && teamData.name) {
        userTeams.push({
          id: teamData.id,
          name: teamData.name
        });
      }
    }
  }

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8 flex flex-col gap-8">
          {/* Header Section */}
          <header className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold">Kanban Board</h1>
              <div className="flex gap-2">
                <Link href="/dashboard">
                  <Button variant="outline" className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />
                    <span>My Tasks</span>
                  </Button>
                </Link>
                <Link href="/teams">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Teams</span>
                  </Button>
                </Link>
              </div>
            </div>
            <div className="bg-secondary/50 text-sm p-3 px-4 rounded-lg text-muted-foreground flex gap-2 items-center">
              <InfoIcon size="14" />
              <span>Drag and drop tasks to update their status</span>
            </div>
          </header>

          {/* Kanban Board Section */}
          <section className="bg-card rounded-xl p-6 border shadow-sm">
            <KanbanTaskView 
              initialTasks={processedTasks} 
              userTeams={userTeams}
              userId={user.id}
              initialTeamFilter={teamId}
              initialTaskId={taskId}
            />
          </section>
        </div>
      </main>
    </>
  );
} 