import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Upload, 
  Clock, 
  TrendingUp,
  ScrollText,
  Bell,
  Calendar,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Stats {
  totalDocuments: number;
  uploadedPDFs: number;
  circulars: number;
  notices: number;
  timetables: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalDocuments: 0,
    uploadedPDFs: 0,
    circulars: 0,
    notices: 0,
    timetables: 0
  });
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;

      try {
        // Fetch generated documents count
        const { count: totalCount } = await supabase
          .from('generated_documents')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Fetch by type
        const { count: circularCount } = await supabase
          .from('generated_documents')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('document_type', 'circular');

        const { count: noticeCount } = await supabase
          .from('generated_documents')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('document_type', 'notice');

        const { count: timetableCount } = await supabase
          .from('generated_documents')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('document_type', 'timetable');

        // Fetch uploaded documents count
        const { count: uploadedCount } = await supabase
          .from('uploaded_documents')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Fetch recent documents
        const { data: recent } = await supabase
          .from('generated_documents')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        setStats({
          totalDocuments: totalCount || 0,
          uploadedPDFs: uploadedCount || 0,
          circulars: circularCount || 0,
          notices: noticeCount || 0,
          timetables: timetableCount || 0
        });

        setRecentDocs(recent || []);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [user]);

  const statCards = [
    { 
      label: 'Total Documents', 
      value: stats.totalDocuments, 
      icon: FileText, 
      color: 'bg-primary text-primary-foreground',
      trend: '+12%'
    },
    { 
      label: 'Uploaded PDFs', 
      value: stats.uploadedPDFs, 
      icon: Upload, 
      color: 'bg-accent text-accent-foreground',
      trend: '+5%'
    },
    { 
      label: 'Circulars', 
      value: stats.circulars, 
      icon: ScrollText, 
      color: 'bg-secondary text-secondary-foreground',
      trend: '+8%'
    },
    { 
      label: 'Notices', 
      value: stats.notices, 
      icon: Bell, 
      color: 'bg-info text-card',
      trend: '+3%'
    },
  ];

  const quickActions = [
    { 
      title: 'Generate Circular', 
      description: 'Create official circulars with AI assistance',
      icon: ScrollText,
      to: '/generate/circular',
      gradient: 'from-primary to-navy-light'
    },
    { 
      title: 'Generate Notice', 
      description: 'Draft notices for events and announcements',
      icon: Bell,
      to: '/generate/notice',
      gradient: 'from-accent to-teal'
    },
    { 
      title: 'Generate Timetable', 
      description: 'Create class schedules and exam timetables',
      icon: Calendar,
      to: '/generate/timetable',
      gradient: 'from-secondary to-gold'
    },
    { 
      title: 'Upload Reference', 
      description: 'Add PDFs for AI context learning',
      icon: Upload,
      to: '/upload',
      gradient: 'from-navy-light to-primary'
    },
  ];

  return (
    <DashboardLayout 
      title="Dashboard" 
      description="Welcome to your AI-powered document management system"
    >
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat, index) => (
          <Card key={index} className="card-academic stat-card animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {loading ? '...' : stat.value}
                  </p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-success">
                <TrendingUp className="mr-1 h-4 w-4" />
                {stat.trend} from last month
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            Quick Actions
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {quickActions.map((action, index) => (
              <Card 
                key={index} 
                className="card-academic cursor-pointer group animate-fade-in"
                style={{ animationDelay: `${(index + 4) * 100}ms` }}
                onClick={() => navigate(action.to)}
              >
                <CardContent className="p-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient} mb-4`}>
                    <action.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                  <div className="mt-4 flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Get started <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Documents */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gold" />
            Recent Documents
          </h2>
          <Card className="card-academic">
            <CardContent className="p-4">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="shimmer h-16 rounded-lg" />
                  ))}
                </div>
              ) : recentDocs.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No documents yet</p>
                  <Button 
                    variant="link" 
                    className="mt-2"
                    onClick={() => navigate('/generate/circular')}
                  >
                    Create your first document
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentDocs.map((doc) => (
                    <div 
                      key={doc.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/history`)}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        doc.document_type === 'circular' ? 'bg-primary/10 text-primary' :
                        doc.document_type === 'notice' ? 'bg-info/10 text-info' :
                        'bg-secondary text-secondary-foreground'
                      }`}>
                        {doc.document_type === 'circular' ? <ScrollText className="h-5 w-5" /> :
                         doc.document_type === 'notice' ? <Bell className="h-5 w-5" /> :
                         <Calendar className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{doc.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{doc.document_type}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
