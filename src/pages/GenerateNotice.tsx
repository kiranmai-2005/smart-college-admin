import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DocumentForm, DocumentFormData } from '@/components/documents/DocumentForm';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCollegeSettings } from '@/hooks/useCollegeSettings';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function GenerateNotice() {
  const { user } = useAuth();
  const { settings: collegeSettings } = useCollegeSettings();
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleGenerate = async (data: DocumentFormData) => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('generate-document', {
        body: {
          type: 'notice',
          title: data.title,
          eventName: data.eventName,
          eventDate: data.eventDate ? format(data.eventDate, 'MMMM d, yyyy') : '',
          documentDate: data.documentDate ? format(data.documentDate, 'dd.MM.yyyy') : format(new Date(), 'dd.MM.yyyy'),
          department: data.department,
          venue: data.venue,
          instructions: data.instructions,
          additionalNotes: data.additionalNotes,
          collegeSettings: {
            college_name: collegeSettings.college_name,
            college_short_name: collegeSettings.college_short_name,
            affiliation: collegeSettings.affiliation,
            accreditation: collegeSettings.accreditation,
            certifications: collegeSettings.certifications,
          }
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setGeneratedContent(response.data.content);
      setGeneratedTitle(data.title);
      toast.success('Notice generated successfully!');
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Failed to generate notice');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !generatedContent) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from('generated_documents').insert({
        user_id: user.id,
        title: generatedTitle,
        document_type: 'notice',
        content: generatedContent,
        status: 'draft'
      });

      if (error) throw error;
      toast.success('Notice saved to history!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save notice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout 
      title="Generate Notice" 
      description="Create notices for events and announcements"
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <DocumentForm 
          type="notice" 
          onSubmit={handleGenerate} 
          loading={loading} 
        />
        <DocumentPreview 
          content={generatedContent} 
          title={generatedTitle || 'Notice Preview'}
          type="notice"
          onSave={handleSave}
          saving={saving}
          collegeSettings={collegeSettings}
        />
      </div>
    </DashboardLayout>
  );
}
