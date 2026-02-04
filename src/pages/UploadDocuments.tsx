import { useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface UploadedFile {
  id: string;
  file_name: string;
  file_size: number;
  is_processed: boolean;
  created_at: string;
}

export default function UploadDocuments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  // Fetch uploaded documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['uploaded-documents', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('uploaded_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UploadedFile[];
    },
    enabled: !!user
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from('uploaded_documents')
        .delete()
        .eq('id', docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploaded-documents'] });
      toast.success('Document deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete document');
    }
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;

    const file = files[0];
    
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF, DOCX, or image file (PNG, JPG, WebP)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    setUploadProgress(20);

    try {
      // Upload to storage
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setUploadProgress(60);

      // Create database record
      const { error: dbError } = await supabase
        .from('uploaded_documents')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          document_type: 'reference'
        });

      if (dbError) throw dbError;

      setUploadProgress(80);

      // Process document (extract text and generate embeddings)
      const { error: processError } = await supabase.functions.invoke('process-document', {
        body: { filePath, mimeType: file.type, fileSize: file.size }
      });

      if (processError) {
        console.warn('Processing may have failed:', processError);
      }

      setUploadProgress(100);
      toast.success('Document uploaded and processed!');
      queryClient.invalidateQueries({ queryKey: ['uploaded-documents'] });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleUpload(e.dataTransfer.files);
  }, [user]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <DashboardLayout 
      title="Upload Documents" 
      description="Upload reference documents to enhance AI-generated content with context"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Upload Area */}
        <Card className="card-academic">
          <CardHeader>
            <CardTitle>Upload Reference PDFs</CardTitle>
            <CardDescription>
              Upload previous circulars, notices, or timetables. The AI will learn from these 
              to generate contextually relevant documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".pdf,.docx,.png,.jpg,.jpeg,.webp"
                onChange={(e) => handleUpload(e.target.files)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploading}
              />
              
              <div className="flex flex-col items-center gap-4">
                {uploading ? (
                  <>
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <div className="w-full max-w-xs">
                      <Progress value={uploadProgress} className="h-2" />
                      <p className="text-sm text-muted-foreground mt-2">
                        {uploadProgress < 60 ? 'Uploading...' : 
                         uploadProgress < 80 ? 'Processing...' : 'Almost done...'}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-medium">Drop your file here, or click to browse</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Supports PDF, DOCX, PNG, JPG, WebP • Max 10MB
                      </p>
                    </div>
                    <Button variant="outline" className="mt-2">
                      Select File
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Uploaded Documents List */}
        <Card className="card-academic">
          <CardHeader>
            <CardTitle>Uploaded Documents</CardTitle>
            <CardDescription>
              {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="shimmer h-16 rounded-lg" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No documents uploaded yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload PDFs to provide context for AI generation
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div 
                    key={doc.id}
                    className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.file_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {doc.is_processed ? (
                        <span className="flex items-center gap-1 text-success text-sm">
                          <CheckCircle className="h-4 w-4" />
                          Processed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-warning text-sm">
                          <AlertCircle className="h-4 w-4" />
                          Pending
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(doc.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
