-- Drop existing policies on task_attachments (if any)
DROP POLICY IF EXISTS "Users can view attachments of tasks they have access to" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can add attachments to tasks they have access to" ON public.task_attachments;
DROP POLICY IF EXISTS "Users can delete their own attachments or attachments on their tasks" ON public.task_attachments;

-- 1. Policy for viewing attachments
CREATE POLICY "Users can view task attachments" ON public.task_attachments
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() OR
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
        )
    );

-- 2. Policy for adding attachments
CREATE POLICY "Users can add attachments to tasks" ON public.task_attachments
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() AND
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
        )
    );

-- 3. Policy for updating attachments
CREATE POLICY "Users can update their own attachments" ON public.task_attachments
    FOR UPDATE USING (
        auth.uid() IS NOT NULL AND
        user_id = auth.uid()
    );

-- 4. Policy for deleting attachments
CREATE POLICY "Users can delete their own attachments" ON public.task_attachments
    FOR DELETE USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.tasks t
                WHERE t.id = task_attachments.task_id
                AND t.user_id = auth.uid()
            )
        )
    );

-- Also ensure the storage policies match
-- Update or create storage bucket policies for task-attachments bucket
DROP POLICY IF EXISTS "Users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files or files on their tasks" ON storage.objects;

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload files to task-attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'task-attachments' AND auth.uid() IS NOT NULL);

-- Allow users to view files they have access to
CREATE POLICY "Allow users to view files they have access to"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'task-attachments' AND 
    auth.uid() IS NOT NULL AND (
        -- Check if the file path matches a task attachment the user has access to
        EXISTS (
            SELECT 1 FROM task_attachments ta
            JOIN tasks t ON ta.task_id = t.id
            LEFT JOIN team_members tm ON t.team_id = tm.team_id
            WHERE ta.storage_path = name
            AND (
                ta.user_id = auth.uid() OR
                t.user_id = auth.uid() OR
                tm.user_id = auth.uid() OR
                t.assigned_to = auth.uid()
            )
        )
    )
);

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete their own files"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'task-attachments' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
        SELECT 1 FROM task_attachments ta
        JOIN tasks t ON ta.task_id = t.id
        WHERE ta.storage_path = name
        AND (ta.user_id = auth.uid() OR t.user_id = auth.uid())
    )
); 