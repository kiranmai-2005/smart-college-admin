import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Input validation helpers
function validateString(value: unknown, maxLength: number = 500): string {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLength).trim();
}

function validateDocumentType(type: unknown): 'circular' | 'notice' | 'timetable' | 'daily-timetable' {
  const validTypes = ['circular', 'notice', 'timetable', 'daily-timetable'];
  if (typeof type === 'string' && validTypes.includes(type)) {
    return type as 'circular' | 'notice' | 'timetable' | 'daily-timetable';
  }
  throw new Error('Invalid document type. Must be one of: circular, notice, timetable, daily-timetable');
}

function validateArray(value: unknown, maxItems: number = 50, itemMaxLength: number = 200): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .filter(item => typeof item === 'string')
    .map(item => (item as string).slice(0, itemMaxLength).trim());
}

function validateNumber(value: unknown, min: number, max: number, defaultValue: number): number {
  if (typeof value !== 'number' || isNaN(value)) return defaultValue;
  return Math.min(Math.max(value, min), max);
}

function sanitizeForPrompt(text: string): string {
  // Remove potential prompt injection patterns
  return text
    .replace(/\[SYSTEM\]/gi, '')
    .replace(/\[USER\]/gi, '')
    .replace(/\[ASSISTANT\]/gi, '')
    .replace(/ignore previous instructions/gi, '')
    .replace(/disregard all/gi, '')
    .trim();
}

interface ExamEntry {
  date: string;
  day: string;
  subject: string;
  time: string;
  duration: string;
}

interface ClassPeriod {
  periodNumber: number;
  subject: string;
  faculty: string;
  classroom: string;
}

interface DaySchedule {
  day: string;
  periods: ClassPeriod[];
}

interface Break {
  afterPeriod: number;
  duration: string;
  name: string;
}

interface FacultySubjectMapping {
  subject: string;
  faculty: { [sectionName: string]: string };
}

interface CollegeSettings {
  college_name: string;
  college_short_name: string;
  affiliation: string;
  accreditation: string;
  certifications: string;
}

interface DocumentRequest {
  type: 'circular' | 'notice' | 'timetable' | 'daily-timetable';
  title: string;
  eventName?: string;
  eventDate?: string;
  documentDate?: string;
  department?: string;
  venue?: string;
  instructions?: string;
  additionalNotes?: string;
  examName?: string;
  semester?: string;
  entries?: ExamEntry[];
  academicYear?: string;
  semesterStartDate?: string;
  numberOfPeriods?: number;
  periodDuration?: string;
  subjects?: string[];
  faculty?: string[];
  classrooms?: string[];
  numberOfSections?: number;
  sectionNames?: string[];
  facultySubjectMapping?: FacultySubjectMapping[];
  breaks?: Break[];
  daySchedules?: DaySchedule[];
  classCoordinators?: { [sectionName: string]: string };
  collegeSettings?: CollegeSettings;
}

// Validate and sanitize the entire request
function validateRequest(rawData: unknown): DocumentRequest {
  if (!rawData || typeof rawData !== 'object') {
    throw new Error('Invalid request body');
  }
  
  const data = rawData as Record<string, unknown>;
  
  // Validate required fields
  const type = validateDocumentType(data.type);
  const title = validateString(data.title, 200);
  
  if (!title) {
    throw new Error('Title is required and must not be empty');
  }
  
  // Validate and sanitize all string fields
  const validated: DocumentRequest = {
    type,
    title: sanitizeForPrompt(title),
    eventName: sanitizeForPrompt(validateString(data.eventName, 200)),
    eventDate: validateString(data.eventDate, 50),
    documentDate: validateString(data.documentDate, 50),
    department: sanitizeForPrompt(validateString(data.department, 200)),
    venue: sanitizeForPrompt(validateString(data.venue, 200)),
    instructions: sanitizeForPrompt(validateString(data.instructions, 2000)),
    additionalNotes: sanitizeForPrompt(validateString(data.additionalNotes, 1000)),
    examName: sanitizeForPrompt(validateString(data.examName, 200)),
    semester: validateString(data.semester, 50),
    academicYear: validateString(data.academicYear, 50),
    semesterStartDate: validateString(data.semesterStartDate, 50),
    numberOfPeriods: validateNumber(data.numberOfPeriods, 1, 12, 6),
    periodDuration: validateString(data.periodDuration, 50),
    subjects: validateArray(data.subjects, 20, 100),
    faculty: validateArray(data.faculty, 50, 100),
    classrooms: validateArray(data.classrooms, 20, 50),
    numberOfSections: validateNumber(data.numberOfSections, 1, 10, 1),
    sectionNames: validateArray(data.sectionNames, 10, 50),
  };
  
  // Validate entries array for timetables
  if (Array.isArray(data.entries)) {
    validated.entries = data.entries.slice(0, 30).map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') {
        return { date: '', day: '', subject: '', time: '', duration: '' };
      }
      const e = entry as Record<string, unknown>;
      return {
        date: validateString(e.date, 50),
        day: validateString(e.day, 20),
        subject: sanitizeForPrompt(validateString(e.subject, 100)),
        time: validateString(e.time, 50),
        duration: validateString(e.duration, 50),
      };
    });
  }
  
  // Validate breaks array
  if (Array.isArray(data.breaks)) {
    validated.breaks = data.breaks.slice(0, 10).map((brk: unknown) => {
      if (!brk || typeof brk !== 'object') {
        return { afterPeriod: 1, duration: '', name: '' };
      }
      const b = brk as Record<string, unknown>;
      return {
        afterPeriod: validateNumber(b.afterPeriod, 1, 12, 1),
        duration: validateString(b.duration, 50),
        name: sanitizeForPrompt(validateString(b.name, 50)),
      };
    });
  }
  
  // Validate faculty-subject mapping
  if (Array.isArray(data.facultySubjectMapping)) {
    validated.facultySubjectMapping = data.facultySubjectMapping.slice(0, 20).map((mapping: unknown) => {
      if (!mapping || typeof mapping !== 'object') {
        return { subject: '', faculty: {} };
      }
      const m = mapping as Record<string, unknown>;
      const facultyMap: { [key: string]: string } = {};
      if (m.faculty && typeof m.faculty === 'object') {
        Object.entries(m.faculty as Record<string, unknown>).slice(0, 10).forEach(([section, faculty]) => {
          if (typeof faculty === 'string') {
            facultyMap[validateString(section, 20)] = sanitizeForPrompt(validateString(faculty, 100));
          }
        });
      }
      return {
        subject: sanitizeForPrompt(validateString(m.subject, 100)),
        faculty: facultyMap,
      };
    });
  }
  
  // Validate class coordinators
  if (data.classCoordinators && typeof data.classCoordinators === 'object') {
    validated.classCoordinators = {};
    Object.entries(data.classCoordinators as Record<string, unknown>).slice(0, 10).forEach(([section, coordinator]) => {
      if (typeof coordinator === 'string') {
        validated.classCoordinators![validateString(section, 20)] = sanitizeForPrompt(validateString(coordinator, 100));
      }
    });
  }
  
  // Validate college settings
  if (data.collegeSettings && typeof data.collegeSettings === 'object') {
    const cs = data.collegeSettings as Record<string, unknown>;
    validated.collegeSettings = {
      college_name: sanitizeForPrompt(validateString(cs.college_name, 300)),
      college_short_name: sanitizeForPrompt(validateString(cs.college_short_name, 50)),
      affiliation: sanitizeForPrompt(validateString(cs.affiliation, 500)),
      accreditation: sanitizeForPrompt(validateString(cs.accreditation, 500)),
      certifications: sanitizeForPrompt(validateString(cs.certifications, 500)),
    };
  }
  
  // Validate day schedules
  if (Array.isArray(data.daySchedules)) {
    validated.daySchedules = data.daySchedules.slice(0, 7).map((schedule: unknown) => {
      if (!schedule || typeof schedule !== 'object') {
        return { day: '', periods: [] };
      }
      const s = schedule as Record<string, unknown>;
      return {
        day: validateString(s.day, 20),
        periods: Array.isArray(s.periods) ? s.periods.slice(0, 12).map((period: unknown) => {
          if (!period || typeof period !== 'object') {
            return { periodNumber: 1, subject: '', faculty: '', classroom: '' };
          }
          const p = period as Record<string, unknown>;
          return {
            periodNumber: validateNumber(p.periodNumber, 1, 12, 1),
            subject: sanitizeForPrompt(validateString(p.subject, 100)),
            faculty: sanitizeForPrompt(validateString(p.faculty, 100)),
            classroom: validateString(p.classroom, 50),
          };
        }) : [],
      };
    });
  }
  
  return validated;
}

const getSystemPrompt = (type: string, settings?: CollegeSettings) => {
  const shortName = settings?.college_short_name || "VIEW";
  
  const basePrompt = `You are an expert academic document generator. Generate formal, professional academic documents.

CRITICAL FORMATTING RULES:
1. DO NOT include any college header or institution details - it will be added separately
2. DO NOT use markdown symbols like **, *, #, ---, or any other markdown
3. Use UPPERCASE for headings and important text
4. Format dates as DD.MM.YYYY (e.g., 23.01.2026)
5. For TABLES: Use this EXACT structured format that can be parsed:
   [TABLE]
   HEADER1 | HEADER2 | HEADER3
   value1 | value2 | value3
   value4 | value5 | value6
   [/TABLE]
6. DO NOT use ASCII borders like +---+---+ or |----| 

Use proper academic language and formal conventions.`;

  switch (type) {
    case 'circular':
      return `${basePrompt}

Generate an official college circular with this EXACT structure (NO college header):

1. Reference Number and Date (on same area):
   Ref.No.: ${shortName}/Principal/Cir/[YEAR]/[NUMBER]
   Date: [DOCUMENT_DATE provided by user in DD.MM.YYYY format]

2. TITLE: CIRCULAR (centered, uppercase)

3. BODY: Start with "This is to inform all the Staff and Students that..."
   - Include event name with ordinal (e.g., "77th Republic Day")
   - Mention venue, time, instructions in flowing paragraphs
   - Use formal language

4. EVENT DETAILS as a table:
   [TABLE]
   EVENT DETAILS | INFORMATION
   Event Name | [Name of Event]
   Date | [Event Date]
   Time | [Event Time]
   Venue | [Venue]
   [/TABLE]

5. NOTES section:
   - Important reminders as numbered points
   - Any arrangements

6. GREETING (centered): HAPPY [EVENT NAME]

7. FOOTER - THREE-COLUMN ALIGNMENT (CRITICAL - all on same line):
   Use this EXACT format with [FOOTER_ROW] tags:
   [FOOTER_ROW]
   Copy to: All Deans / All HODs / Staff | Read in all Class Rooms | PRINCIPAL
   [/FOOTER_ROW]
   
   This creates: LEFT aligned "Copy to..." | CENTER aligned "Read in all..." | RIGHT aligned "PRINCIPAL"

IMPORTANT: 
- NO college header at the start
- NO markdown symbols
- Use [TABLE]...[/TABLE] format for any tabular data
- Use [FOOTER_ROW]...[/FOOTER_ROW] for three-column footer alignment
- Use UPPERCASE for emphasis
- Date must be placed IMMEDIATELY below the Reference Number`;

    case 'notice':
      return `${basePrompt}

Generate an official college notice with this EXACT structure (NO college header):

1. Reference Number and Date (on same area):
   Ref.No.: ${shortName}/[Department]/Notice/[YEAR]/[NUMBER]
   Date: [DOCUMENT_DATE provided by user in DD.MM.YYYY format]

2. TITLE: NOTICE (centered, uppercase)

3. SUBJECT LINE: Sub: [Subject of Notice]

4. BODY: Clear, concise announcement starting with formal address

5. KEY DETAILS as a table if applicable:
   [TABLE]
   DETAILS | INFORMATION
   [Detail1] | [Value1]
   [Detail2] | [Value2]
   [/TABLE]

6. DATES/DEADLINES: Clearly stated

7. FOOTER - THREE-COLUMN ALIGNMENT (CRITICAL - all on same line):
   Use this EXACT format with [FOOTER_ROW] tags:
   [FOOTER_ROW]
   Copy to: All Deans / All HODs / Staff | Read in all Class Rooms | HOD / Coordinator
   [/FOOTER_ROW]
   
   This creates: LEFT aligned "Copy to..." | CENTER aligned "Read in all..." | RIGHT aligned signature

IMPORTANT:
- NO college header at the start
- NO markdown symbols
- Use [TABLE]...[/TABLE] format for tabular data
- Use [FOOTER_ROW]...[/FOOTER_ROW] for three-column footer alignment
- Use UPPERCASE for headings
- Date must be placed IMMEDIATELY below the Reference Number`;

    case 'timetable':
      return `${basePrompt}

Generate a formatted examination timetable (NO college header):

1. TITLE: EXAMINATION TIMETABLE FOR [EXAM NAME] (centered, uppercase)

2. INFO LINE:
   Department: [Department Name]
   Semester: [Semester]
   w.e.f Date: [Start Date in DD.MM.YYYY]

3. EXAMINATION SCHEDULE TABLE:
   [TABLE]
   DATE | DAY | SUBJECT | TIME | DURATION
   [Date1] | [Day1] | [Subject1] | [Time1] | [Duration1]
   [Date2] | [Day2] | [Subject2] | [Time2] | [Duration2]
   [/TABLE]

4. IMPORTANT INSTRUCTIONS (numbered):
   1. Hall ticket mandatory
   2. Report 30 minutes before
   3. No electronic devices
   etc.

5. FOOTER:
   Controller of Examinations
   Date: [Document Date in DD.MM.YYYY]

CRITICAL: NO ASCII table borders. Use [TABLE]...[/TABLE] format only.`;

    case 'daily-timetable':
      return `${basePrompt}

Generate a SINGLE-PAGE academic timetable optimized for PDF and JPG export (NO college header):

CRITICAL SINGLE-PAGE REQUIREMENTS:
- ALL content MUST fit on ONE A4 page - no page breaks
- Use COMPACT table formatting with minimal row height
- Use small but readable font sizes (8-10pt equivalent)
- Use subject abbreviations (3-5 chars) in timetable cells
- Keep adequate margins on all sides

LAYOUT STRUCTURE:

1. TITLE (centered, bold, uppercase):
   TIME TABLE FOR THE ACADEMIC YEAR [YEAR] (SEM-[N])

2. ACADEMIC INFO (compact, single line each):
   w.e.f Date: [Semester Start Date in DD.MM.YYYY]
   Department: [Department Name]

3. SECTION TIMETABLES - Arranged VERTICALLY (one below another):
   For EACH section, create a COMPACT table:
   
   Section Header: Class: [Year]-[Branch]-[Section] — Coordinator: [Coordinator Name]
   
   [TABLE]
   DAY | 9:10-10:00 | 10:00-10:50 | BREAK | 11:10-12:00 | 12:00-12:50 | LUNCH | 1:40-2:30 | 2:30-3:20 | 3:20-4:10
   MON | [Abbr] | [Abbr] | BREAK | [Abbr] | [Abbr] | LUNCH | [Abbr] | [Abbr] | [Abbr]
   TUE | [Abbr] | [Abbr] | BREAK | [Abbr] | [Abbr] | LUNCH | [Abbr] | [Abbr] | [Abbr]
   WED | [Abbr] | [Abbr] | BREAK | [Abbr] | [Abbr] | LUNCH | [Abbr] | [Abbr] | [Abbr]
   THU | [Abbr] | [Abbr] | BREAK | [Abbr] | [Abbr] | LUNCH | [Abbr] | [Abbr] | [Abbr]
   FRI | [Abbr] | [Abbr] | BREAK | [Abbr] | [Abbr] | LUNCH | [Abbr] | [Abbr] | [Abbr]
   SAT | [Abbr] | [Abbr] | BREAK | [Abbr] | [Abbr] | LUNCH | [Abbr] | [Abbr] | [Abbr]
   [/TABLE]
   
   Use 3-letter day abbreviations (MON, TUE, etc.)
   Use short subject codes in cells

4. FACULTY MAPPING TABLE (at bottom, compact):
   [TABLE]
   COURSE NAME | SEC-A | SEC-B | SEC-C
   [Subject Full Name] | [Faculty] | [Faculty] | [Faculty]
   [Subject Full Name] | [Faculty] | [Faculty] | [Faculty]
   [/TABLE]
   
   Map Course Name → Section columns with faculty names

5. FOOTER (right-aligned):
   Date: [Document Date in DD.MM.YYYY]

STRICT FORMATTING RULES:
- NO college header at the start (added separately)
- NO ASCII table borders (no +---+, no |---|)
- Use [TABLE]...[/TABLE] format ONLY
- NO signature blocks (NO "SD/-", NO "Class Coordinator", NO "HOD", NO "Principal")
- Use UPPERCASE for main title only
- Use subject abbreviations in timetable cells (e.g., DS, OS, CN, DBMS)
- Ensure no faculty conflicts (same teacher in two sections at same time)
- BREAK and LUNCH columns clearly marked
- Generate ONE timetable per section, arranged vertically
- Each section table includes its respective Class Coordinator in the header
- Keep everything on ONE PAGE`;

    default:
      return basePrompt;
  }
};

const buildPrompt = (data: DocumentRequest): string => {
  let prompt = `Generate a formal ${data.type === 'daily-timetable' ? 'daily class timetable' : data.type} document with the following details:\n\n`;
  prompt += `Title: ${data.title}\n`;
  
  if (data.documentDate) {
    prompt += `Document Date (USE THIS for the date in the document): ${data.documentDate}\n`;
  }

  if (data.type === 'daily-timetable') {
    prompt += `Academic Year: ${data.academicYear}\n`;
    prompt += `Semester Start Date (w.e.f): ${data.semesterStartDate}\n`;
    prompt += `Department: ${data.department}\n`;
    prompt += `Semester: ${data.semester}\n`;
    prompt += `Number of Periods: ${data.numberOfPeriods}\n`;
    prompt += `Period Duration: ${data.periodDuration}\n`;
    prompt += `Number of Sections: ${data.numberOfSections || 1}\n`;
    
    if (data.classCoordinators && Object.keys(data.classCoordinators).length > 0) {
      prompt += `\nCLASS COORDINATORS (one per section):\n`;
      Object.entries(data.classCoordinators).forEach(([section, coordinator]) => {
        if (coordinator) {
          prompt += `  ${section}: ${coordinator}\n`;
        }
      });
    }
    
    if (data.sectionNames && data.sectionNames.length > 0) {
      prompt += `Section Names: ${data.sectionNames.join(', ')}\n`;
    }
    
    if (data.subjects && data.subjects.length > 0) {
      prompt += `\nSubjects: ${data.subjects.filter(s => s).join(', ')}\n`;
    }
    
    if (data.faculty && data.faculty.length > 0) {
      prompt += `Faculty Members: ${data.faculty.filter(f => f).join(', ')}\n`;
    }
    
    if (data.classrooms && data.classrooms.length > 0) {
      prompt += `Classrooms: ${data.classrooms.filter(c => c).join(', ')}\n`;
    }
    
    if (data.facultySubjectMapping && data.facultySubjectMapping.length > 0) {
      prompt += `\nFACULTY-SUBJECT MAPPING (IMPORTANT - Use this exactly):\n`;
      data.facultySubjectMapping.forEach(mapping => {
        const assignments = Object.entries(mapping.faculty)
          .filter(([_, faculty]) => faculty)
          .map(([section, faculty]) => `${section}: ${faculty}`)
          .join(', ');
        if (assignments) {
          prompt += `  ${mapping.subject} -> ${assignments}\n`;
        }
      });
      prompt += `\nCRITICAL: Ensure no teacher is assigned to two different sections during the same period!\n`;
    }
    
    if (data.breaks && data.breaks.length > 0) {
      prompt += `\nBreak Schedule:\n`;
      data.breaks.forEach(brk => {
        prompt += `- ${brk.name}: After Period ${brk.afterPeriod} (${brk.duration})\n`;
      });
    }
    
    if (data.daySchedules && data.daySchedules.some(ds => ds.periods.some(p => p.subject))) {
      prompt += `\nPre-assigned Schedule:\n`;
      data.daySchedules.forEach(daySchedule => {
        const filledPeriods = daySchedule.periods.filter(p => p.subject);
        if (filledPeriods.length > 0) {
          prompt += `\n${daySchedule.day}:\n`;
          filledPeriods.forEach(period => {
            prompt += `  Period ${period.periodNumber}: ${period.subject} - ${period.faculty} (${period.classroom})\n`;
          });
        }
      });
      prompt += `\nPlease complete any empty slots while ensuring no faculty conflicts.\n`;
    } else {
      prompt += `\nAuto-generate an optimal timetable ensuring:\n`;
      prompt += `1. Each subject gets adequate periods per week\n`;
      prompt += `2. NO faculty member teaches in two different sections at the same time - THIS IS CRITICAL\n`;
      prompt += `3. Subjects are distributed evenly across the week\n`;
      prompt += `4. Practical/lab sessions (if any) get consecutive periods\n`;
      prompt += `5. Use the faculty-subject mapping provided above\n`;
    }
    
    if (data.instructions) {
      prompt += `\nAdditional Instructions/Notes:\n${data.instructions}\n`;
    }

    prompt += `\nGENERATE:
1. A timetable for EACH section (${data.sectionNames?.join(', ') || 'SEC-A'}) with its respective Class Coordinator
2. A Faculty Mapping Table showing which teacher handles which subject in which section
3. Use [TABLE]...[/TABLE] format for tables (NOT ASCII borders)
4. NO MARKDOWN SYMBOLS
5. End with ONLY the document date: ${data.documentDate || 'today'} (no signature blocks)`;
    
  } else if (data.type === 'timetable') {
    prompt += `Examination Name: ${data.examName || data.eventName}\n`;
    prompt += `Department: ${data.department}\n`;
    prompt += `Semester: ${data.semester}\n`;
    if (data.venue) prompt += `Venue: ${data.venue}\n`;
    
    if (data.entries && data.entries.length > 0) {
      prompt += `\nExamination Schedule:\n`;
      data.entries.forEach((entry, i) => {
        prompt += `${i + 1}. Date: ${entry.date || 'TBD'}, Day: ${entry.day || 'TBD'}, Subject: ${entry.subject}, Time: ${entry.time}, Duration: ${entry.duration}\n`;
      });
    }
    
    prompt += `\nInstructions/Rules:\n${data.instructions}\n`;
    prompt += `\nFormat the schedule using [TABLE]...[/TABLE] format. NO ASCII borders. NO MARKDOWN.`;
    prompt += `\nDocument Date for footer: ${data.documentDate || 'today'}`;
  } else {
    if (data.eventName) prompt += `Event Name: ${data.eventName}\n`;
    if (data.eventDate) prompt += `Event Date: ${data.eventDate}\n`;
    if (data.department) prompt += `Department: ${data.department}\n`;
    if (data.venue) prompt += `Venue: ${data.venue}\n`;
    if (data.instructions) prompt += `Instructions/Guidelines:\n${data.instructions}\n`;
    if (data.additionalNotes) prompt += `Additional Notes: ${data.additionalNotes}\n`;
    
    prompt += `\nIMPORTANT: 
- Use UPPERCASE for headings and emphasis
- NO markdown symbols (**, *, #, ---)
- Use [TABLE]...[/TABLE] format for tabular data
- NO ASCII borders
- Place the Date IMMEDIATELY below the Reference Number using: ${data.documentDate || 'today'}`;
  }

  prompt += `\nGenerate a complete, formal document ready for distribution. NO college header needed.`;
  
  return prompt;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ========== AUTHENTICATION ==========
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Create Supabase client with user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Verify the user's token
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // ========== INPUT VALIDATION ==========
    const rawData = await req.json();
    const data = validateRequest(rawData);
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = getSystemPrompt(data.type, data.collegeSettings);
    const userPrompt = buildPrompt(data);

    console.log('Generating document for user:', user.id);
    console.log('Document type:', data.type);
    console.log('Title:', data.title);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content generated");
    }

    console.log('Document generated successfully for user:', user.id);

    return new Response(
      JSON.stringify({ content, type: data.type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating document:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
