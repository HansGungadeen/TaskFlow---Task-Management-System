-- Create a new table for task attachments
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Policy for viewing attachments (must be team member or task owner)
CREATE POLICY "Users can view attachments of tasks they have access to" ON public.task_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            LEFT JOIN public.team_members tm ON t.team_id = tm.team_id
            WHERE t.id = task_attachments.task_id
            AND (
                t.user_id = auth.uid() OR
                tm.user_id = auth.uid() OR
                t.assigned_to = auth.uid()
            )
        )
    );

-- Policy for inserting attachments (must be team member or task owner)
CREATE POLICY "Users can add attachments to tasks they have access to" ON public.task_attachments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tasks t
            LEFT JOIN public.team_members tm ON t.team_id = tm.team_id
            WHERE t.id = task_id
            AND (
                t.user_id = auth.uid() OR
                tm.user_id = auth.uid() OR
                t.assigned_to = auth.uid()
            )
        )
    );

-- Policy for deleting attachments (must be attachment owner or task owner)
CREATE POLICY "Users can delete their own attachments or attachments on their tasks" ON public.task_attachments
    FOR DELETE USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.id = task_attachments.task_id
            AND t.user_id = auth.uid()
        )
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.task_attachments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at(); 