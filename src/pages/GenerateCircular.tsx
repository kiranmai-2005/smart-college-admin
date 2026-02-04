import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DocumentForm, DocumentFormData } from '@/components/documents/DocumentForm';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCollegeSettings } from '@/hooks/useCollegeSettings';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function GenerateCircular() {
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
          type: 'circular',
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
      toast.success('Circular generated successfully!');
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Failed to generate circular');
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
        document_type: 'circular',
        content: generatedContent,
        status: 'draft'
      });

      if (error) throw error;
      toast.success('Circular saved to history!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save circular');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout 
      title="Generate Circular" 
      description="Create official circulars with AI-powered generation"
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <DocumentForm 
          type="circular" 
          onSubmit={handleGenerate} 
          loading={loading} 
        />
        <DocumentPreview 
          content={generatedContent} 
          title={generatedTitle || 'Circular Preview'}
          type="circular"
          onSave={handleSave}
          saving={saving}
          collegeSettings={collegeSettings}
        />
      </div>
    </DashboardLayout>
  );
}
