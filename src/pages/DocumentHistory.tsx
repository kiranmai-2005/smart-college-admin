import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  ScrollText, 
  Bell, 
  Calendar, 
  Search, 
  Eye, 
  Download,
  Trash2,
  Clock,
  Filter
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface GeneratedDocument {
  id: string;
  title: string;
  document_type: string;
  content: string;
  version: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function DocumentHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedDoc, setSelectedDoc] = useState<GeneratedDocument | null>(null);

  // Fetch documents
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['generated-documents', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('generated_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as GeneratedDocument[];
    },
    enabled: !!user
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from('generated_documents')
        .delete()
        .eq('id', docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generated-documents'] });
      toast.success('Document deleted');
      setSelectedDoc(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete document');
    }
  });

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || doc.document_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getDocIcon = (type: string) => {
    switch (type) {
      case 'circular': return ScrollText;
      case 'notice': return Bell;
      case 'timetable': return Calendar;
      default: return FileText;
    }
  };

  const getDocColor = (type: string) => {
    switch (type) {
      case 'circular': return 'bg-primary/10 text-primary';
      case 'notice': return 'bg-info/10 text-info';
      case 'timetable': return 'bg-secondary text-secondary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-success/10 text-success border-success/20">Published</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  const handleDownload = (doc: GeneratedDocument) => {
    const blob = new Blob([doc.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Document downloaded');
  };

  return (
    <DashboardLayout 
      title="Document History" 
      description="View and manage all your generated documents"
    >
      <div className="space-y-6">
        {/* Filters */}
        <Card className="card-academic">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="circular">Circulars</SelectItem>
                    <SelectItem value="notice">Notices</SelectItem>
                    <SelectItem value="timetable">Timetables</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="shimmer h-48 rounded-lg" />
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <Card className="card-academic">
            <CardContent className="py-16 text-center">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No documents found</h3>
              <p className="text-muted-foreground">
                {searchQuery || typeFilter !== 'all' 
                  ? 'Try adjusting your filters'
                  : 'Generate your first document to get started'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDocuments.map((doc) => {
              const Icon = getDocIcon(doc.document_type);
              return (
                <Card 
                  key={doc.id} 
                  className="card-academic cursor-pointer group"
                  onClick={() => setSelectedDoc(doc)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${getDocColor(doc.document_type)}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      {getStatusBadge(doc.status)}
                    </div>
                    <h3 className="font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {doc.title}
                    </h3>
                    <p className="text-sm text-muted-foreground capitalize mb-4">
                      {doc.document_type} • Version {doc.version}
                    </p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      {new Date(doc.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Document Preview Dialog */}
        <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {selectedDoc && (
                  <>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${getDocColor(selectedDoc.document_type)}`}>
                      {(() => {
                        const Icon = getDocIcon(selectedDoc.document_type);
                        return <Icon className="h-4 w-4" />;
                      })()}
                    </div>
                    {selectedDoc.title}
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            
            {selectedDoc && (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  {getStatusBadge(selectedDoc.status)}
                  <Badge variant="outline" className="capitalize">{selectedDoc.document_type}</Badge>
                  <span className="text-sm text-muted-foreground ml-auto">
                    Version {selectedDoc.version}
                  </span>
                </div>
                
                <div className="flex-1 overflow-auto bg-muted/50 rounded-lg p-6 mb-4">
                  <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed">
                    {selectedDoc.content}
                  </pre>
                </div>

                <div className="flex justify-between">
                  <Button 
                    variant="destructive" 
                    onClick={() => deleteMutation.mutate(selectedDoc.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                  <Button onClick={() => handleDownload(selectedDoc)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
