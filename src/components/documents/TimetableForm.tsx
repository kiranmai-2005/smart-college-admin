import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Loader2, Sparkles, Plus, Trash2, AlertTriangle, GraduationCap, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Examination timetable entry
export interface ExamEntry {
  date: Date | undefined;
  day: string;
  subject: string;
  time: string;
  duration: string;
}

// Faculty-Subject mapping for sections
export interface FacultySubjectMapping {
  subject: string;
  faculty: { [sectionName: string]: string };
}

// Daily class timetable entry
export interface ClassPeriod {
  periodNumber: number;
  subject: string;
  faculty: string;
  classroom: string;
}

export interface DaySchedule {
  day: string;
  periods: ClassPeriod[];
}

export interface TimetableFormData {
  type: 'examination' | 'daily';
  title: string;
  examName: string;
  department: string;
  semester: string;
  venue: string;
  instructions: string;
  entries: ExamEntry[];
  // Daily class specific fields
  academicYear: string;
  semesterStartDate: Date | undefined;
  documentDate: Date | undefined; // User-input document date
  numberOfPeriods: number;
  periodDuration: string;
  subjects: string[];
  faculty: string[];
  classrooms: string[];
  numberOfSections: number;
  sectionNames: string[];
  facultySubjectMapping: FacultySubjectMapping[];
  breaks: { afterPeriod: number; duration: string; name: string }[];
  daySchedules: DaySchedule[];
  classCoordinators: { [sectionName: string]: string }; // Class coordinator per section
}

interface TimetableFormProps {
  onSubmit: (data: TimetableFormData) => Promise<void>;
  loading: boolean;
}

const departments = [
  'Computer Science',
  'Electronics',
  'Mechanical',
  'Civil',
  'Electrical',
  'Information Technology',
  'All Departments'
];

const semesters = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const defaultBreaks = [
  { afterPeriod: 2, duration: '15 min', name: 'Short Break' },
  { afterPeriod: 4, duration: '45 min', name: 'Lunch Break' },
  { afterPeriod: 6, duration: '15 min', name: 'Afternoon Break' }
];

const academicYears = [
  '2024-2025',
  '2025-2026',
  '2026-2027',
  '2027-2028'
];

export function TimetableForm({ onSubmit, loading }: TimetableFormProps) {
  const [timetableType, setTimetableType] = useState<'examination' | 'daily'>('examination');
  const [formData, setFormData] = useState<TimetableFormData>({
    type: 'examination',
    title: '',
    examName: '',
    department: '',
    semester: '',
    venue: '',
    instructions: '',
    entries: [{ date: undefined, day: '', subject: '', time: '09:00 AM', duration: '3 hours' }],
    academicYear: '2025-2026',
    semesterStartDate: undefined,
    documentDate: new Date(), // Default to today
    numberOfPeriods: 8,
    periodDuration: '45 min',
    subjects: [''],
    faculty: [''],
    classrooms: [''],
    numberOfSections: 1,
    sectionNames: ['SEC-A'],
    facultySubjectMapping: [],
    breaks: defaultBreaks,
    daySchedules: days.map(day => ({
      day,
      periods: Array.from({ length: 8 }, (_, i) => ({
        periodNumber: i + 1,
        subject: '',
        faculty: '',
        classroom: ''
      }))
    })),
    classCoordinators: { 'SEC-A': '' }
  });
  
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [subjectInput, setSubjectInput] = useState('');
  const [facultyInput, setFacultyInput] = useState('');
  const [classroomInput, setClassroomInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate constraints for daily timetable
    if (timetableType === 'daily') {
      const validationErrors = validateConstraints();
      if (validationErrors.length > 0) {
        setConflicts(validationErrors);
        toast.error('Please fix the conflicts before generating');
        return;
      }
    }
    
    await onSubmit({ ...formData, type: timetableType });
  };

  const validateConstraints = useCallback((): string[] => {
    const errors: string[] = [];
    
    // Check for teacher conflicts in faculty mapping - same teacher can't be in two sections at same period
    const facultyAssignments = new Map<string, string[]>();
    
    formData.facultySubjectMapping.forEach(mapping => {
      Object.entries(mapping.faculty).forEach(([section, faculty]) => {
        if (faculty) {
          if (!facultyAssignments.has(faculty)) {
            facultyAssignments.set(faculty, []);
          }
          facultyAssignments.get(faculty)!.push(`${mapping.subject} (${section})`);
        }
      });
    });
    
    // Check day schedule conflicts
    formData.daySchedules.forEach(daySchedule => {
      const periodFacultyMap: Map<number, Map<string, string[]>> = new Map();
      
      daySchedule.periods.forEach(period => {
        if (period.faculty && period.classroom) {
          if (!periodFacultyMap.has(period.periodNumber)) {
            periodFacultyMap.set(period.periodNumber, new Map());
          }
          const facultyMap = periodFacultyMap.get(period.periodNumber)!;
          
          if (!facultyMap.has(period.faculty)) {
            facultyMap.set(period.faculty, []);
          }
          facultyMap.get(period.faculty)!.push(period.classroom);
        }
      });
      
      // Check for conflicts
      periodFacultyMap.forEach((facultyMap, periodNum) => {
        facultyMap.forEach((classrooms, faculty) => {
          if (classrooms.length > 1) {
            errors.push(`${faculty} is assigned to multiple classrooms (${classrooms.join(', ')}) during Period ${periodNum} on ${daySchedule.day}`);
          }
        });
      });
    });
    
    return errors;
  }, [formData.daySchedules, formData.facultySubjectMapping]);

  const updateField = (field: keyof TimetableFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'daySchedules' || field === 'facultySubjectMapping') {
      // Re-validate on schedule change
      setTimeout(() => {
        const errors = validateConstraints();
        setConflicts(errors);
      }, 100);
    }
  };

  // Update sections when number changes
  const updateNumberOfSections = (num: number) => {
    const sectionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const newSectionNames = Array.from({ length: num }, (_, i) => `SEC-${sectionLetters[i] || i + 1}`);
    updateField('numberOfSections', num);
    updateField('sectionNames', newSectionNames);
    
    // Update class coordinators for new sections
    const newCoordinators = newSectionNames.reduce((acc, section) => {
      acc[section] = formData.classCoordinators[section] || '';
      return acc;
    }, {} as { [key: string]: string });
    updateField('classCoordinators', newCoordinators);
    
    // Update faculty mapping for new sections
    const updatedMapping = formData.facultySubjectMapping.map(mapping => ({
      ...mapping,
      faculty: newSectionNames.reduce((acc, section) => {
        acc[section] = mapping.faculty[section] || '';
        return acc;
      }, {} as { [key: string]: string })
    }));
    updateField('facultySubjectMapping', updatedMapping);
  };

  // Examination entry handlers
  const addExamEntry = () => {
    setFormData(prev => ({
      ...prev,
      entries: [...prev.entries, { date: undefined, day: '', subject: '', time: '09:00 AM', duration: '3 hours' }]
    }));
  };

  const removeExamEntry = (index: number) => {
    setFormData(prev => ({
      ...prev,
      entries: prev.entries.filter((_, i) => i !== index)
    }));
  };

  const updateExamEntry = (index: number, field: keyof ExamEntry, value: any) => {
    setFormData(prev => ({
      ...prev,
      entries: prev.entries.map((entry, i) => 
        i === index ? { ...entry, [field]: value } : entry
      )
    }));
  };

  // Subject/Faculty/Classroom handlers
  const addSubject = () => {
    if (subjectInput.trim() && !formData.subjects.includes(subjectInput.trim())) {
      const newSubjects = [...formData.subjects.filter(s => s), subjectInput.trim()];
      updateField('subjects', newSubjects);
      
      // Add to faculty mapping
      const newMapping: FacultySubjectMapping = {
        subject: subjectInput.trim(),
        faculty: formData.sectionNames.reduce((acc, section) => {
          acc[section] = '';
          return acc;
        }, {} as { [key: string]: string })
      };
      updateField('facultySubjectMapping', [...formData.facultySubjectMapping, newMapping]);
      
      setSubjectInput('');
    }
  };

  const removeSubject = (subject: string) => {
    updateField('subjects', formData.subjects.filter(s => s !== subject));
    updateField('facultySubjectMapping', formData.facultySubjectMapping.filter(m => m.subject !== subject));
  };

  const updateFacultyMapping = (subjectIndex: number, section: string, faculty: string) => {
    const newMapping = [...formData.facultySubjectMapping];
    newMapping[subjectIndex] = {
      ...newMapping[subjectIndex],
      faculty: { ...newMapping[subjectIndex].faculty, [section]: faculty }
    };
    updateField('facultySubjectMapping', newMapping);
  };

  const addFaculty = () => {
    if (facultyInput.trim() && !formData.faculty.includes(facultyInput.trim())) {
      updateField('faculty', [...formData.faculty.filter(f => f), facultyInput.trim()]);
      setFacultyInput('');
    }
  };

  const removeFaculty = (faculty: string) => {
    updateField('faculty', formData.faculty.filter(f => f !== faculty));
  };

  const addClassroom = () => {
    if (classroomInput.trim() && !formData.classrooms.includes(classroomInput.trim())) {
      updateField('classrooms', [...formData.classrooms.filter(c => c), classroomInput.trim()]);
      setClassroomInput('');
    }
  };

  const removeClassroom = (classroom: string) => {
    updateField('classrooms', formData.classrooms.filter(c => c !== classroom));
  };

  // Break handlers
  const addBreak = () => {
    updateField('breaks', [...formData.breaks, { afterPeriod: 1, duration: '15 min', name: 'Break' }]);
  };

  const removeBreak = (index: number) => {
    updateField('breaks', formData.breaks.filter((_, i) => i !== index));
  };

  const updateBreak = (index: number, field: string, value: any) => {
    updateField('breaks', formData.breaks.map((b, i) => 
      i === index ? { ...b, [field]: value } : b
    ));
  };

  // Period assignment handler
  const updatePeriod = (dayIndex: number, periodIndex: number, field: keyof ClassPeriod, value: string) => {
    const newSchedules = [...formData.daySchedules];
    newSchedules[dayIndex].periods[periodIndex] = {
      ...newSchedules[dayIndex].periods[periodIndex],
      [field]: value
    };
    updateField('daySchedules', newSchedules);
  };

  const updateNumberOfPeriods = (num: number) => {
    updateField('numberOfPeriods', num);
    updateField('daySchedules', days.map(day => ({
      day,
      periods: Array.from({ length: num }, (_, i) => ({
        periodNumber: i + 1,
        subject: '',
        faculty: '',
        classroom: ''
      }))
    })));
  };

  const handleTypeChange = (type: string) => {
    setTimetableType(type as 'examination' | 'daily');
    setConflicts([]);
  };

  return (
    <Card className="card-academic">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          Generate Timetable
        </CardTitle>
        <CardDescription>Create examination or daily class timetables with constraint validation</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={timetableType} onValueChange={handleTypeChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="examination" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Examination
            </TabsTrigger>
            <TabsTrigger value="daily" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Daily Classes
            </TabsTrigger>
          </TabsList>

          {/* Examination Timetable Form */}
          <TabsContent value="examination">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="title">Timetable Title *</Label>
                  <Input
                    id="title"
                    placeholder="Mid-Semester Examination Timetable - January 2025"
                    value={formData.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="examName">Examination Name *</Label>
                  <Input
                    id="examName"
                    placeholder="Mid-Semester Examinations"
                    value={formData.examName}
                    onChange={(e) => updateField('examName', e.target.value)}
                    required
                  />
                </div>

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

                <div className="space-y-2">
                  <Label htmlFor="semester">Semester *</Label>
                  <Select
                    value={formData.semester}
                    onValueChange={(value) => updateField('semester', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {semesters.map((sem) => (
                        <SelectItem key={sem} value={sem}>{sem} Semester</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venue">Examination Venue</Label>
                  <Input
                    id="venue"
                    placeholder="Main Examination Hall / Block A"
                    value={formData.venue}
                    onChange={(e) => updateField('venue', e.target.value)}
                  />
                </div>
              </div>

              {/* Examination Entries */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Examination Schedule *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addExamEntry}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Entry
                  </Button>
                </div>

                <div className="space-y-3">
                  {formData.entries.map((entry, index) => (
                    <div key={index} className="grid gap-3 sm:grid-cols-5 p-4 rounded-lg bg-muted/50 relative">
                      {formData.entries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeExamEntry(index)}
                          className="absolute top-2 right-2 p-1 rounded hover:bg-destructive/10 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      
                      <div className="space-y-1">
                        <Label className="text-xs">Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                'w-full justify-start text-left font-normal',
                                !entry.date && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-3 w-3" />
                              {entry.date ? format(entry.date, 'MMM d') : 'Date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={entry.date}
                              onSelect={(date) => updateExamEntry(index, 'date', date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Day</Label>
                        <Select
                          value={entry.day}
                          onValueChange={(value) => updateExamEntry(index, 'day', value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Day" />
                          </SelectTrigger>
                          <SelectContent>
                            {days.map((day) => (
                              <SelectItem key={day} value={day}>{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Subject *</Label>
                        <Input
                          placeholder="Data Structures"
                          value={entry.subject}
                          onChange={(e) => updateExamEntry(index, 'subject', e.target.value)}
                          className="h-9"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Time</Label>
                        <Input
                          placeholder="09:00 AM"
                          value={entry.time}
                          onChange={(e) => updateExamEntry(index, 'time', e.target.value)}
                          className="h-9"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Duration</Label>
                        <Input
                          placeholder="3 hours"
                          value={entry.duration}
                          onChange={(e) => updateExamEntry(index, 'duration', e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Examination Rules & Instructions *</Label>
                <Textarea
                  id="instructions"
                  placeholder="1. Students must carry valid ID cards.&#10;2. Mobile phones are strictly prohibited.&#10;3. Report 30 minutes before scheduled time."
                  value={formData.instructions}
                  onChange={(e) => updateField('instructions', e.target.value)}
                  rows={4}
                  required
                />
              </div>

              <Button 
                type="submit" 
                size="lg" 
                className="w-full sm:w-auto"
                disabled={loading || !formData.title || !formData.examName || !formData.department || !formData.semester || formData.entries.some(e => !e.subject)}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Timetable...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Exam Timetable
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          {/* Daily Class Timetable Form */}
          <TabsContent value="daily">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Conflict Warnings */}
              {conflicts.length > 0 && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2 text-destructive mb-2">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-semibold">Scheduling Conflicts Detected</span>
                  </div>
                  <ul className="space-y-1 text-sm text-destructive">
                    {conflicts.map((conflict, i) => (
                      <li key={i}>• {conflict}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Basic Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="title-daily">Timetable Title *</Label>
                  <Input
                    id="title-daily"
                    placeholder="Class Timetable - CSE 4th Semester - Spring 2025"
                    value={formData.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="academicYear">Academic Year *</Label>
                  <Select
                    value={formData.academicYear}
                    onValueChange={(value) => updateField('academicYear', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select academic year" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((year) => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Semester Start Date (w.e.f) *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.semesterStartDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.semesterStartDate ? format(formData.semesterStartDate, 'PPP') : 'Select start date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.semesterStartDate}
                        onSelect={(date) => updateField('semesterStartDate', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department-daily">Department *</Label>
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

                <div className="space-y-2">
                  <Label htmlFor="semester-daily">Semester *</Label>
                  <Select
                    value={formData.semester}
                    onValueChange={(value) => updateField('semester', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {semesters.map((sem) => (
                        <SelectItem key={sem} value={sem}>{sem} Semester</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sections">Number of Sections *</Label>
                  <Select
                    value={formData.numberOfSections.toString()}
                    onValueChange={(value) => updateNumberOfSections(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sections" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <SelectItem key={num} value={num.toString()}>{num} Section{num > 1 ? 's' : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="periods">Number of Periods *</Label>
                  <Select
                    value={formData.numberOfPeriods.toString()}
                    onValueChange={(value) => updateNumberOfPeriods(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select periods" />
                    </SelectTrigger>
                    <SelectContent>
                      {[6, 7, 8, 9, 10].map((num) => (
                        <SelectItem key={num} value={num.toString()}>{num} Periods</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="periodDuration">Period Duration</Label>
                  <Select
                    value={formData.periodDuration}
                    onValueChange={(value) => updateField('periodDuration', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="40 min">40 minutes</SelectItem>
                      <SelectItem value="45 min">45 minutes</SelectItem>
                      <SelectItem value="50 min">50 minutes</SelectItem>
                      <SelectItem value="1 hour">1 hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Class Coordinators Per Section */}
                <div className="sm:col-span-2 space-y-3">
                  <Label className="text-base font-semibold">Class Coordinators *</Label>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {formData.sectionNames.map((section) => (
                      <div key={section} className="space-y-1">
                        <Label className="text-xs">{section} Coordinator</Label>
                        <Input
                          placeholder={`e.g., Mrs. Sk. Rahimunnisa`}
                          value={formData.classCoordinators[section] || ''}
                          onChange={(e) => updateField('classCoordinators', {
                            ...formData.classCoordinators,
                            [section]: e.target.value
                          })}
                          required
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Document Date */}
                <div className="space-y-2">
                  <Label>Document Date *</Label>
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
              </div>

              {/* Section Names */}
              {formData.numberOfSections > 1 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Section Names</Label>
                  <div className="flex flex-wrap gap-2">
                    {formData.sectionNames.map((name, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={name}
                          onChange={(e) => {
                            const newNames = [...formData.sectionNames];
                            newNames[index] = e.target.value;
                            updateField('sectionNames', newNames);
                          }}
                          className="w-24"
                          placeholder={`Section ${index + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subjects */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Subjects *</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add subject (e.g., Data Structures)"
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubject())}
                  />
                  <Button type="button" onClick={addSubject} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.subjects.filter(s => s).map((subject) => (
                    <Badge key={subject} variant="secondary" className="px-3 py-1">
                      {subject}
                      <button type="button" onClick={() => removeSubject(subject)} className="ml-2 hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Faculty */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Faculty *</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add faculty (e.g., Dr. Smith)"
                    value={facultyInput}
                    onChange={(e) => setFacultyInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFaculty())}
                  />
                  <Button type="button" onClick={addFaculty} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.faculty.filter(f => f).map((faculty) => (
                    <Badge key={faculty} variant="secondary" className="px-3 py-1">
                      {faculty}
                      <button type="button" onClick={() => removeFaculty(faculty)} className="ml-2 hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Faculty-Subject Mapping */}
              {formData.facultySubjectMapping.length > 0 && formData.faculty.filter(f => f).length > 0 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Faculty-Subject Mapping (Which teacher teaches which subject in which section)</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium">Course Name</th>
                          {formData.sectionNames.map(section => (
                            <th key={section} className="px-4 py-2 text-left text-sm font-medium">{section}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {formData.facultySubjectMapping.map((mapping, index) => (
                          <tr key={mapping.subject} className="border-t">
                            <td className="px-4 py-2 font-medium text-sm">{mapping.subject}</td>
                            {formData.sectionNames.map(section => (
                              <td key={section} className="px-4 py-2">
                                <Select
                                  value={mapping.faculty[section] || ''}
                                  onValueChange={(value) => updateFacultyMapping(index, section, value)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select faculty" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {formData.faculty.filter(f => f).map((fac) => (
                                      <SelectItem key={fac} value={fac}>{fac}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Classrooms */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Classrooms *</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add classroom (e.g., Room 101)"
                    value={classroomInput}
                    onChange={(e) => setClassroomInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addClassroom())}
                  />
                  <Button type="button" onClick={addClassroom} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.classrooms.filter(c => c).map((classroom) => (
                    <Badge key={classroom} variant="secondary" className="px-3 py-1">
                      {classroom}
                      <button type="button" onClick={() => removeClassroom(classroom)} className="ml-2 hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Breaks */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Breaks</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addBreak}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Break
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.breaks.map((brk, index) => (
                    <div key={index} className="flex gap-2 items-center p-3 rounded-lg bg-muted/50">
                      <Input
                        placeholder="Break name"
                        value={brk.name}
                        onChange={(e) => updateBreak(index, 'name', e.target.value)}
                        className="flex-1"
                      />
                      <Select
                        value={brk.afterPeriod.toString()}
                        onValueChange={(value) => updateBreak(index, 'afterPeriod', parseInt(value))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: formData.numberOfPeriods }, (_, i) => (
                            <SelectItem key={i + 1} value={(i + 1).toString()}>After Period {i + 1}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Duration"
                        value={brk.duration}
                        onChange={(e) => updateBreak(index, 'duration', e.target.value)}
                        className="w-24"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeBreak(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions-daily">Additional Instructions</Label>
                <Textarea
                  id="instructions-daily"
                  placeholder="Any special notes or guidelines for the timetable..."
                  value={formData.instructions}
                  onChange={(e) => updateField('instructions', e.target.value)}
                  rows={3}
                />
              </div>

              <Button 
                type="submit" 
                size="lg" 
                className="w-full sm:w-auto"
                disabled={loading || !formData.title || !formData.department || !formData.semester || !formData.academicYear || !formData.semesterStartDate || formData.subjects.filter(s => s).length === 0 || formData.faculty.filter(f => f).length === 0 || conflicts.length > 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Timetable...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Class Timetable
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
