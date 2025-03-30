import { NextResponse } from "next/server";
import { createClient } from "@/utils/utils";

export async function GET() {
  try {
    const supabase = createClient();

    // Invoke the edge function with the correct slug format
    const { data, error } = await supabase.functions.invoke(
      "supabase-functions-task-reminders",
    );

    if (error) {
      console.error("Error invoking task-reminders function:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in task-reminders API route:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
