import DashboardLayout from "@/components/dashboard-layout";
import TaskCalendar from "@/components/task-calendar";
import { InfoIcon, UserCircle, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "../../../../supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TaskExport } from "@/components/task-export";

export default async function CalendarView({ 
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
  const date = searchParams?.date as string | undefined;
  
  // Log for debugging
  console.log("Calendar view loaded with teamId:", teamId, "taskId:", taskId, "date:", date);

  // Fetch user's tasks
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(`
      *,
      subtasks (
        id,
        title,
        completed
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tasks:", error);
  }

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
  
  // Add assignee data to tasks
  const processedTasks = tasks?.map(task => {
    // Add assignee_data if task is assigned
    const assignee_data = task.assigned_to && userMap[task.assigned_to] 
      ? {
          id: userMap[task.assigned_to].id,
          email: userMap[task.assigned_to].email,
          name: userMap[task.assigned_to].name || null,
          avatar_url: userMap[task.assigned_to].avatar_url || null
        }
      : null;
      
    return {
      ...task,
      assignee_data
    };
  }) || [];

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
      id: (item.teams as any).id, 
      name: (item.teams as any).name 
    }))
  ];

  return (
    <DashboardLayout>
      {/* Header Section */}
      <header className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Calendar View</h1>
          <div className="flex gap-2">
            {processedTasks.length > 0 && <TaskExport tasks={processedTasks} />}
            <Link href="/dashboard">
              <Button variant="outline" className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                <span>Dashboard</span>
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
          <span>View your tasks in a calendar format for better scheduling</span>
        </div>
      </header>

      {/* Task Calendar Section */}
      <section className="bg-card rounded-xl p-6 border shadow-sm">
        <TaskCalendar 
          initialTasks={processedTasks} 
          userTeams={userTeams}
          userId={user.id}
          initialTeamFilter={teamId}
          initialTaskId={taskId}
          initialDate={date ? new Date(date) : undefined}
        />
      </section>
    </DashboardLayout>
  );
} 