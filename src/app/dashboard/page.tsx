import DashboardNavbar from "@/components/dashboard-navbar";
import TaskDashboard from "@/components/task-dashboard";
import { InfoIcon, UserCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "../../../supabase/server";

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

  return (
    <>
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8 flex flex-col gap-8">
          {/* Header Section */}
          <header className="flex flex-col gap-4">
            <h1 className="text-3xl font-bold">Task Dashboard</h1>
            <div className="bg-secondary/50 text-sm p-3 px-4 rounded-lg text-muted-foreground flex gap-2 items-center">
              <InfoIcon size="14" />
              <span>Manage and organize your tasks efficiently</span>
            </div>
          </header>

          {/* Task Dashboard Section */}
          <section className="bg-card rounded-xl p-6 border shadow-sm">
            <TaskDashboard initialTasks={tasks || []} />
          </section>
        </div>
      </main>
    </>
  );
}
