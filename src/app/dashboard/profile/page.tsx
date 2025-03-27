import { createClient } from "../../../../supabase/server";
import { redirect } from "next/navigation";
import ProfileEditor from "../../../components/profile-editor";
import DashboardLayout from "../../../components/dashboard-layout";

export default async function ProfilePage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/sign-in");
  }

  // Fetch the user profile data from the public users table
  const { data: userData, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error fetching user profile:", error);
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Edit Profile</h1>
          <p className="text-muted-foreground">Update your personal information</p>
        </div>
        
        <ProfileEditor user={userData} authUser={user} />
      </div>
    </DashboardLayout>
  );
} 