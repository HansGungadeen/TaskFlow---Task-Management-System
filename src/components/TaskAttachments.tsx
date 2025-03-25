import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, File, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
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
  const supabase = createClientComponentClient()

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `task-attachments/${taskId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Create attachment record in database
      const { error: dbError } = await supabase
        .from('task_attachments')
        .insert({
          task_id: taskId,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          storage_path: filePath
        })

      if (dbError) throw dbError

      toast({
        title: 'File uploaded successfully',
        description: `${file.name} has been attached to the task.`
      })

      onAttachmentAdded()
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
    try {
      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('task-attachments')
        .remove([attachment.storage_path])

      if (storageError) throw storageError

      // Delete record from database
      const { error: dbError } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', attachment.id)

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
    try {
      const { data, error } = await supabase.storage
        .from('task-attachments')
        .download(attachment.storage_path)

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
          disabled={isUploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {isUploading ? 'Uploading...' : 'Upload File'}
        </Button>
        <input
          id="file-upload"
          type="file"
          className="hidden"
          onChange={handleFileUpload}
          disabled={isUploading}
        />
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-2 rounded-md border bg-background"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <File className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{attachment.file_name}</span>
                <span className="text-sm text-muted-foreground">
                  ({formatFileSize(attachment.file_size)})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadFile(attachment)}
                >
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(attachment)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 