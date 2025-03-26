import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard-layout";
import { createClient } from "../../../../../supabase/server";
import TeamInbox from "@/components/team-inbox";
import { ArrowLeft, InfoIcon, MessageSquare } from "lucide-react";
import Link from "next/link";

export default async function TeamInboxPage({ params }: { params: { id: string } }) {
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

  // Pre-fetch initial inbox messages for server-side rendering
  const { data: initialMessages } = await supabase
    .rpc('get_team_inbox_messages', { team_id_param: params.id });

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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            {team.name} <span className="text-lg font-normal text-muted-foreground">Team Inbox</span>
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="bg-secondary px-3 py-1 rounded-full text-sm flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{initialMessages?.length || 0} messages</span>
            </span>
          </div>
        </div>
        <div className="bg-secondary/50 text-sm p-3 px-4 rounded-lg text-muted-foreground flex gap-2 items-center">
          <InfoIcon size="14" />
          <span>A shared space for team communication, updates, and tasks</span>
        </div>
      </header>

      {/* Team Inbox Section */}
      <section className="bg-card rounded-xl p-6 border shadow-sm">
        <TeamInbox 
          teamId={params.id} 
          teamName={team.name}
          currentUser={user}
          teamMembers={teamMembers || []}
          userRole={teamMember.role}
          initialMessages={initialMessages || []}
          initialTasks={teamTasks || []}
        />
      </section>
    </DashboardLayout>
  );
} 