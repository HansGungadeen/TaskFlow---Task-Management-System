import DashboardLayout from "@/components/dashboard-layout";
import TaskDashboard from "@/components/task-dashboard";
import MiniCalendar from "@/components/mini-calendar";
import MiniTeamTasks from "@/components/mini-team-tasks";
import { InfoIcon, UserCircle, Users, Calendar, BarChart2, Clock, MessageSquare, ChevronRight, UserCheck, CheckCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "../../../supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TaskExport } from "@/components/task-export";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import TaskCreationCompletion from "@/components/task-creation-vs-completion";

export default async function Dashboard({ 
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
  
  // Log for debugging
  console.log("Dashboard loaded with teamId:", teamId, "taskId:", taskId);

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
      role,
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

  // Determine the primary team for activity feed
  const primaryTeamId = teamId || (userTeams.length > 0 ? userTeams[0].id : null);
  const primaryTeamName = userTeams.find(team => team.id === primaryTeamId)?.name || "Team";

  // Get team members data for the primary team
  const { data: teamMembers } = await supabase
    .from("team_members_with_users")
    .select("*")
    .eq("team_id", primaryTeamId);

  // Fetch recent team activity 
  const { data: recentActivity } = await supabase
    .from("task_history")
    .select(`
      id, 
      task_id, 
      user_id, 
      action_type, 
      created_at,
      details,
      user:user_id (
        name,
        email,
        avatar_url
      )
    `)
    .eq("team_id", primaryTeamId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <DashboardLayout>
      {/* Header Section */}
      <header className="flex flex-col gap-4 mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">TaskFlow Dashboard</h1>
          <div className="flex gap-2">
            <Link href="/dashboard/calendar">
              <Button variant="outline" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Calendar</span>
              </Button>
            </Link>
            <Link href="/teams">
              <Button variant="outline" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Teams</span>
              </Button>
            </Link>
            <Link href="/analytics">
              <Button variant="outline" className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                <span>Analytics</span>
              </Button>
            </Link>
            {processedTasks?.length > 0 && (
              <TaskExport tasks={processedTasks} buttonSize="sm" />
            )}
          </div>
        </div>
        <div className="bg-secondary/50 text-sm p-3 px-4 rounded-lg text-muted-foreground flex gap-2 items-center">
          <InfoIcon size="14" />
          <span>Welcome to your TaskFlow Dashboard - Manage tasks, view your calendar, and track team activity all in one place.</span>
        </div>
      </header>

      {/* Dashboard Content - Now in a grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Task Dashboard Section - Takes up 3/4 on desktop */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xl flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                My Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 py-2">
              <TaskDashboard 
                initialTasks={processedTasks} 
                userTeams={userTeams}
                userId={user.id}
                initialTeamFilter={teamId}
                initialTaskId={taskId}
              />
            </CardContent>
          </Card>
          
          {/* Task Creation vs Completion Chart */}
          <TaskCreationCompletion userId={user.id} teamId={teamId} />
        </div>

        {/* Right sidebar for calendar and activity feed */}
        <div className="space-y-6">
          {/* Mini Calendar Section */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Upcoming Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-2">
              <div className="p-2">
                <MiniCalendar 
                  tasks={processedTasks}
                  teamId={teamId}
                />
              </div>
            </CardContent>
            <CardFooter className="pt-0">
              <Link href="/dashboard/calendar" className="w-full">
                <Button variant="outline" className="w-full text-sm">
                  View Full Calendar
                </Button>
              </Link>
            </CardFooter>
          </Card>

          {/* Team Activity Feed Section */}
          {primaryTeamId && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Team Tasks
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[400px] overflow-y-auto pt-2">
                <MiniTeamTasks
                  tasks={processedTasks}
                  teamId={primaryTeamId}
                  userId={user.id}
                  maxTasks={8}
                />
              </CardContent>
              <CardFooter className="pt-0">
                {primaryTeamId && (
                  <Link href={`/teams/${primaryTeamId}`} className="w-full">
                    <Button variant="outline" className="w-full text-sm">
                      View Team Details
                    </Button>
                  </Link>
                )}
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
