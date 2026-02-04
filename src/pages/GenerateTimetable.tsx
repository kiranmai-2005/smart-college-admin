import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TimetableForm, TimetableFormData } from '@/components/documents/TimetableForm';
import { DocumentPreview } from '@/components/documents/DocumentPreview';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCollegeSettings } from '@/hooks/useCollegeSettings';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function GenerateTimetable() {
  const { user } = useAuth();
  const { settings: collegeSettings } = useCollegeSettings();
  const [generatedContent, setGeneratedContent] = useState('');
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleGenerate = async (data: TimetableFormData) => {
    setLoading(true);
    try {
      let requestBody: Record<string, any>;

      const collegeSettingsPayload = {
        college_name: collegeSettings.college_name,
        college_short_name: collegeSettings.college_short_name,
        affiliation: collegeSettings.affiliation,
        accreditation: collegeSettings.accreditation,
        certifications: collegeSettings.certifications,
      };

      if (data.type === 'daily') {
        // Daily class timetable
        requestBody = {
          type: 'daily-timetable',
          title: data.title,
          academicYear: data.academicYear,
          semesterStartDate: data.semesterStartDate ? format(data.semesterStartDate, 'dd-MM-yyyy') : '',
          documentDate: data.documentDate ? format(data.documentDate, 'dd.MM.yyyy') : format(new Date(), 'dd.MM.yyyy'),
          department: data.department,
          semester: data.semester,
          numberOfPeriods: data.numberOfPeriods,
          periodDuration: data.periodDuration,
          numberOfSections: data.numberOfSections,
          sectionNames: data.sectionNames,
          subjects: data.subjects.filter(s => s),
          faculty: data.faculty.filter(f => f),
          facultySubjectMapping: data.facultySubjectMapping,
          classrooms: data.classrooms.filter(c => c),
          breaks: data.breaks,
          classCoordinators: data.classCoordinators,
          daySchedules: data.daySchedules.map(ds => ({
            day: ds.day,
            periods: ds.periods.map(p => ({
              periodNumber: p.periodNumber,
              subject: p.subject,
              faculty: p.faculty,
              classroom: p.classroom
            }))
          })),
          instructions: data.instructions,
          collegeSettings: collegeSettingsPayload
        };
      } else {
        // Examination timetable
        const entries = data.entries.map(entry => ({
          date: entry.date ? format(entry.date, 'MMMM d, yyyy') : '',
          day: entry.day,
          subject: entry.subject,
          time: entry.time,
          duration: entry.duration
        }));

        requestBody = {
          type: 'timetable',
          title: data.title,
          examName: data.examName,
          department: data.department,
          semester: data.semester,
          venue: data.venue,
          instructions: data.instructions,
          entries,
          collegeSettings: collegeSettingsPayload
        };
      }

      const response = await supabase.functions.invoke('generate-document', {
        body: requestBody
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setGeneratedContent(response.data.content);
      setGeneratedTitle(data.title);
      toast.success(`${data.type === 'daily' ? 'Class' : 'Exam'} timetable generated successfully!`);
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Failed to generate timetable');
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
        document_type: 'timetable',
        content: generatedContent,
        status: 'draft'
      });

      if (error) throw error;
      toast.success('Timetable saved to history!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save timetable');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout 
      title="Generate Timetable" 
      description="Create examination or daily class timetables with constraint validation"
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <TimetableForm 
          onSubmit={handleGenerate} 
          loading={loading} 
        />
        <DocumentPreview 
          content={generatedContent} 
          title={generatedTitle || 'Timetable Preview'}
          type="timetable"
          onSave={handleSave}
          saving={saving}
          collegeSettings={collegeSettings}
        />
      </div>
    </DashboardLayout>
  );
}
