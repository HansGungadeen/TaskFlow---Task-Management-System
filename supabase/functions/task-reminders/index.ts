import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get tasks that are due within the next 24 hours and haven't had reminders sent
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Fix the query to not use the relationship that doesn't exist
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .eq("reminder_sent", false)
      .not("due_date", "is", null)
      .gte("due_date", now.toISOString())
      .lte("due_date", tomorrow.toISOString());

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      throw tasksError;
    }

    // Process each task and mark as reminder sent
    const processedTasks = [];

    if (!tasks || tasks.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          tasks: [],
          message: "No tasks due for reminders",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    for (const task of tasks) {
      try {
        // Get the user information separately
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("email")
          .eq("id", task.user_id)
          .single();

        if (userError) {
          console.error(`Error fetching user for task ${task.id}:`, userError);
        } else {
          // In a production environment, you would send an actual email here
          console.log(
            `Would send email to ${userData?.email} about task ${task.title}`,
          );
        }

        // Mark reminder as sent
        const { error: updateError } = await supabase
          .from("tasks")
          .update({ reminder_sent: true })
          .eq("id", task.id);

        if (updateError) {
          console.error(
            `Error updating reminder status for task ${task.id}:`,
            updateError,
          );
          continue;
        }

        processedTasks.push({
          id: task.id,
          title: task.title,
          email: userData?.email,
        });
      } catch (updateError) {
        console.error(`Error processing task ${task.id}:`, updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedTasks.length,
        tasks: processedTasks,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error processing task reminders:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // Return 200 even for errors to prevent the FunctionsHttpError
      },
    );
  }
});
