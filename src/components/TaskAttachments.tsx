import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, File, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/utils/utils' // Import the same client used in task-view-card
import { formatFileSize } from '@/lib/utils'

interface TaskAttachment {
  id: string
  file_name: string
  file_size: number
  file_type: string
  storage_path: string
  created_at: string
  user_id: string
}

interface TaskAttachmentsProps {
  taskId: string
  attachments: TaskAttachment[]
  onAttachmentAdded: () => void
  onAttachmentDeleted: () => void
}

export function TaskAttachments({ taskId, attachments, onAttachmentAdded, onAttachmentDeleted }: TaskAttachmentsProps) {
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()
  // Use the same client as in the task-view-card component
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)

  // Get and store user ID on component mount
  useEffect(() => {
    const getUserId = async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        setUserId(data.user.id)
      }
      console.log('DEBUG - User authenticated:', !!data?.user, 'User ID:', data?.user?.id)
    }
    
    getUserId()
  }, [supabase.auth])

  // Log initial props and state
  useEffect(() => {
    console.log('DEBUG - TaskAttachments component initialized with:', { 
      taskId, 
      attachmentsCount: attachments.length,
      isAuthenticated: !!userId,
      userId
    });
  }, [taskId, attachments.length, userId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    console.log('DEBUG - File upload started:', { 
      fileName: file.name, 
      fileSize: file.size, 
      fileType: file.type, 
      taskId: taskId,
      userId: userId
    })

    if (!userId) {
      console.error('DEBUG - User not authenticated for file upload')
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in to upload files.',
        variant: 'destructive'
      })
      return
    }

    try {
      setIsUploading(true)

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}.${fileExt}`
      const filePath = `task-attachments/${taskId}/${fileName}`

      console.log('DEBUG - Uploading to storage path:', filePath)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file)

      console.log('DEBUG - Upload result:', { uploadData, uploadError })
      
      if (uploadError) throw uploadError

      // Create attachment record in database
      const { data: dbData, error: dbError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: taskId,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          storage_path: filePath,
          user_id: userId
        })
        .select()

      console.log('DEBUG - Database insert result:', { dbData, dbError })
      
      if (dbError) throw dbError

      toast({
        title: 'File uploaded successfully',
        description: `${file.name} has been attached to the task.`
      })

      onAttachmentAdded()
      
      // Clear the file input
      event.target.value = ''
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        title: 'Upload failed',
        description: 'There was an error uploading your file. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (attachment: TaskAttachment) => {
    console.log('DEBUG - Delete attachment started:', attachment)
    
    if (!userId) {
      console.error('DEBUG - User not authenticated for file deletion')
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in to delete files.',
        variant: 'destructive'
      })
      return
    }
    
    try {
      // Delete file from storage
      console.log('DEBUG - Deleting from storage:', attachment.storage_path)
      const { data: storageData, error: storageError } = await supabase.storage
        .from('task-attachments')
        .remove([attachment.storage_path])

      console.log('DEBUG - Storage delete result:', { storageData, storageError })
      
      if (storageError) throw storageError

      // Delete record from database
      console.log('DEBUG - Deleting from database, attachment ID:', attachment.id)
      const { data: dbData, error: dbError } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachment.id)
        .select()

      console.log('DEBUG - Database delete result:', { dbData, dbError })
      
      if (dbError) throw dbError

      toast({
        title: 'File deleted',
        description: `${attachment.file_name} has been removed.`
      })

      onAttachmentDeleted()
    } catch (error) {
      console.error('Error deleting file:', error)
      toast({
        title: 'Delete failed',
        description: 'There was an error deleting the file. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const downloadFile = async (attachment: TaskAttachment) => {
    console.log('DEBUG - Download started:', attachment)
    
    try {
      console.log('DEBUG - Fetching from storage:', attachment.storage_path)
      const { data, error } = await supabase.storage
        .from('task-attachments')
        .download(attachment.storage_path)

      console.log('DEBUG - Download result:', { dataReceived: !!data, error })
      
      if (error) throw error

      // Create a download link
      const blob = new Blob([data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.file_name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      console.log('DEBUG - Download completed successfully')
    } catch (error) {
      console.error('Error downloading file:', error)
      toast({
        title: 'Download failed',
        description: 'There was an error downloading the file. Please try again.',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.getElementById('file-upload')?.click()}
          disabled={isUploading || !userId}
        >
          <Upload className="mr-2 h-4 w-4" />
          {isUploading ? 'Uploading...' : 'Upload File'}
        </Button>
        <input
          id="file-upload"
          type="file"
          className="hidden"
          onChange={handleFileUpload}
          disabled={isUploading || !userId}
        />
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex flex-col xs:flex-row xs:items-center justify-between p-2 rounded-md border bg-background gap-2"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <File className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{attachment.file_name}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  ({formatFileSize(attachment.file_size)})
                </span>
              </div>
              <div className="flex items-center gap-1 justify-end w-full xs:w-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => downloadFile(attachment)}
                >
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handleDelete(attachment)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {!userId && (
        <div className="text-yellow-500 text-sm mt-2">
          You must be logged in to upload or manage files.
        </div>
      )}
    </div>
  )
} 