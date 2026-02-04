import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface DocumentFormData {
  title: string;
  eventName: string;
  eventDate: Date | undefined;
  documentDate: Date | undefined; // User-input date for document creation
  department: string;
  venue: string;
  instructions: string;
  additionalNotes: string;
}

interface DocumentFormProps {
  type: 'circular' | 'notice' | 'timetable';
  onSubmit: (data: DocumentFormData) => Promise<void>;
  loading: boolean;
}

const departments = [
  'Computer Science',
  'Electronics',
  'Mechanical',
  'Civil',
  'Electrical',
  'Information Technology',
  'Chemistry',
  'Physics',
  'Mathematics',
  'Management Studies',
  'All Departments'
];

export function DocumentForm({ type, onSubmit, loading }: DocumentFormProps) {
  const [formData, setFormData] = useState<DocumentFormData>({
    title: '',
    eventName: '',
    eventDate: undefined,
    documentDate: new Date(), // Default to today
    department: '',
    venue: '',
    instructions: '',
    additionalNotes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const updateField = (field: keyof DocumentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'circular': return 'Circular';
      case 'notice': return 'Notice';
      case 'timetable': return 'Timetable';
    }
  };

  const getTypeDescription = () => {
    switch (type) {
      case 'circular': return 'Generate an official circular with formal academic formatting';
      case 'notice': return 'Create a notice for events, announcements, or important updates';
      case 'timetable': return 'Generate a structured timetable for classes or examinations';
    }
  };

  return (
    <Card className="card-academic">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          Generate {getTypeLabel()}
        </CardTitle>
        <CardDescription>{getTypeDescription()}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Title */}
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="title">Document Title *</Label>
              <Input
                id="title"
                placeholder={type === 'circular' ? 'Annual Day Celebration Circular' : 
                           type === 'notice' ? 'Workshop Registration Notice' : 
                           'Mid-Semester Examination Timetable'}
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                required
              />
            </div>

            {/* Event Name */}
            <div className="space-y-2">
              <Label htmlFor="eventName">
                {type === 'timetable' ? 'Exam/Schedule Name' : 'Event Name'} *
              </Label>
              <Input
                id="eventName"
                placeholder={type === 'timetable' ? 'Mid-Semester Exams' : 'Annual Day Celebration'}
                value={formData.eventName}
                onChange={(e) => updateField('eventName', e.target.value)}
                required
              />
            </div>

            {/* Event Date */}
            <div className="space-y-2">
              <Label>
                {type === 'timetable' ? 'Start Date' : 'Event Date'} *
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !formData.eventDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.eventDate ? format(formData.eventDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.eventDate}
                    onSelect={(date) => updateField('eventDate', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Document Date - for reference number */}
            <div className="space-y-2">
              <Label>Document Date (for Reference) *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !formData.documentDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.documentDate ? format(formData.documentDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.documentDate}
                    onSelect={(date) => updateField('documentDate', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => updateField('department', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Venue */}
            <div className="space-y-2">
              <Label htmlFor="venue">
                {type === 'timetable' ? 'Examination Venue' : 'Venue'}
              </Label>
              <Input
                id="venue"
                placeholder="Main Auditorium / Block A"
                value={formData.venue}
                onChange={(e) => updateField('venue', e.target.value)}
              />
            </div>

            {/* Instructions */}
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="instructions">
                {type === 'timetable' ? 'Examination Rules' : 'Instructions / Guidelines'} *
              </Label>
              <Textarea
                id="instructions"
                placeholder={type === 'timetable' 
                  ? 'Students must carry ID cards. Mobile phones are strictly prohibited. Report 30 minutes before exam time.'
                  : 'All students are required to attend. Formal dress code. Registration starts at 9 AM.'}
                value={formData.instructions}
                onChange={(e) => updateField('instructions', e.target.value)}
                rows={4}
                required
              />
            </div>

            {/* Additional Notes */}
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="additionalNotes">Additional Notes (Optional)</Label>
              <Textarea
                id="additionalNotes"
                placeholder="Any additional information to include in the document..."
                value={formData.additionalNotes}
                onChange={(e) => updateField('additionalNotes', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <Button 
            type="submit" 
            size="lg" 
            className="w-full sm:w-auto"
            disabled={loading || !formData.title || !formData.eventName || !formData.department || !formData.instructions}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating with AI...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate {getTypeLabel()}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
