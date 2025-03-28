import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard-layout";
import TeamManagement from "@/components/team-management";
import { createClient } from "../../../supabase/server";
import { InfoIcon, Users } from "lucide-react";
import { TaskExport } from "@/components/task-export";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Team, TeamRole } from "@/types/teams";

// Define the interface locally to avoid type conflicts
interface LocalTeamWithRole extends Team {
  memberRole?: TeamRole;
}

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

  // Format member teams in a safer way
  const formattedMemberTeams: LocalTeamWithRole[] = [];
  
  memberTeams?.forEach(item => {
    const teamData = item.teams as any;
    if (teamData && teamData.id) {
      formattedMemberTeams.push({
        id: teamData.id,
        name: teamData.name || "",
        description: teamData.description || null,
        created_by: teamData.created_by || "",
        created_at: teamData.created_at || "",
        updated_at: teamData.updated_at || "",
        memberRole: item.role as TeamRole
      });
    } else {
      console.error("Team data is null or invalid for member team", item);
    }
  });
  
  // Get all team IDs the user is part of
  const allTeamIds = [
    ...(ownedTeams || []).map(team => team.id),
    ...formattedMemberTeams.map(team => team.id)
  ];
  
  // Check if we have any teams before proceeding
  let processedTasks: any[] = [];
  
  if (allTeamIds.length > 0) {
    try {
      // Fetch tasks for all teams
      const { data: teamTasks, error } = await supabase
        .from("tasks")
        .select(`
          *,
          subtasks (
            id,
            title,
            completed
          )
        `)
        .in("team_id", allTeamIds)
        .order("created_at", { ascending: false });
        
      if (error) {
        console.error("Error fetching team tasks:", error);
      } else if (teamTasks && teamTasks.length > 0) {
        // Get user information for assigned tasks
        const assignedTaskIds = teamTasks
          .filter(task => task.assigned_to)
          .map(task => task.assigned_to);
          
        let userMap: Record<string, any> = {};
        
        if (assignedTaskIds.length > 0) {
          const { data: assignedUsers, error: userError } = await supabase
            .from("users")
            .select("id, email, name, avatar_url")
            .in("id", assignedTaskIds);
            
          if (userError) {
            console.error("Error fetching assigned users:", userError);
          } else if (assignedUsers) {
            userMap = assignedUsers.reduce((acc, user) => {
              acc[user.id] = user;
              return acc;
            }, {} as Record<string, any>);
          }
        }
        
        // Process tasks to add computed properties
        processedTasks = teamTasks.map(task => {
          // Count completed subtasks
          const subtasks = task.subtasks || [];
          const subtasksCount = subtasks.length;
          const completedSubtasksCount = subtasks.filter((st: any) => st.completed).length;
          
          // Create assignee_data object with full user details if available
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
            subtasks_count: subtasksCount,
            completed_subtasks_count: completedSubtasksCount,
            status: task.status || 'todo', // Ensure status has a default
            assignee_data
          };
        });
      }
    } catch (err) {
      console.error("Error processing team tasks:", err);
    }
  }

  return (
    <DashboardLayout>
      {/* Header Section */}
      <header className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Team Management</h1>
          <div className="flex gap-2">
            {processedTasks.length > 0 && <TaskExport tasks={processedTasks} />}
            <Link href="/dashboard">
              <Button variant="outline" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Dashboard</span>
              </Button>
            </Link>
          </div>
        </div>
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