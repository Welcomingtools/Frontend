"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, Clock, Plus, AlertCircle, CheckCircle, Trash2, Loader2, LogOut } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"



const createTimestampForStorage = () => {
  return new Date().toISOString()
}
const shouldAutoComplete = (sessionDate: string, startTime: string, sessionStatus: string) => {
  if (sessionStatus === 'completed') return false;
  
  const now = new Date();
  const sessionStart = getSessionDateTime(sessionDate, startTime);
  const autoCompleteTime = new Date(sessionStart.getTime() + 30 * 60 * 1000); // 30 minutes after start
  
  return now >= autoCompleteTime;
};



// Define predefined purpose options
const PURPOSE_OPTIONS = [
  { value: "exam", label: "Exam" },
  { value: "lab", label: "Lab" },
  { value: "lecture", label: "Lecture" },
  { value: "tutorial", label: "Tutorial" },
  { value: "test", label: "Test" },
  { value: "other", label: "Other" },
]

// Time validation constants
const MIN_SESSION_DURATION = 30 // minimum 30 minutes
const MAX_SESSION_DURATION = 300 // maximum 5 hours

// Mock data for labs with updated structure
const labsData = [
  { id: "004", name: "Lab 004", capacity: 100, rows: 10 },
  { id: "005", name: "Lab 005", capacity: 100, rows: 10 },
  { id: "006", name: "Lab 006", capacity: 100, rows: 10 },
  { id: "108", name: "Lab 108", capacity: 50, rows: 5 },
  { id: "109", name: "Lab 109", capacity: 50, rows: 5 },
  { id: "110", name: "Lab 110", capacity: 50, rows: 5 },
  { id: "111", name: "Lab 111", capacity: 50, rows: 5 },
]

// Form validation types
interface ValidationErrors {
  labs?: string
  date?: string
  startTime?: string
  endTime?: string
  purpose?: string
  courseCode?: string
  recurrenceEndDate?: string
  general?: string
}

// Session data interface - UPDATED with new fields
interface SessionData {
  id: string
  lab: string
  date: string
  startTime: string
  endTime: string
  purpose: string
  description: string
  courseCode: string
  isRecurring: boolean
  recurrenceEndDate: string | null
  status: string
  configurations: {
    windows: boolean
    internet: boolean
    homes: boolean
    userCleanup: boolean
    handoutdata: boolean
  }
  createdBy: string
  createdByEmail: string
  checkedInBy?: string
  checkedInByEmail?: string
  checkedInAt?: string
  completedAt?: string  // Add this field
  sessionStatus?: 'pending' | 'active' | 'completed'
}

// User session type
type UserSession = {
  email: string
  name: string
  role: string
  loginTime: string
  accountType: string
}

// Time validation helper functions
const parseTime = (timeString: string | undefined) => {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number)
  return hours * 60 + minutes
}

const validateTimeRange = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) return { 
    isValid: false,
    duration: 0,
    tooShort: false,
    tooLong: false,
    endBeforeStart: false
  }
  
  const startMinutes = parseTime(startTime)
  const endMinutes = parseTime(endTime)
  const duration = endMinutes - startMinutes
  
  return {
    isValid: duration >= MIN_SESSION_DURATION && duration <= MAX_SESSION_DURATION,
    duration,
    tooShort: duration < MIN_SESSION_DURATION,
    tooLong: duration > MAX_SESSION_DURATION,
    endBeforeStart: endMinutes <= startMinutes
  }
}

const hasTimeConflict = (sessions: any[], newSession: { labs: string[], date: string, startTime: string, endTime: string }, excludeId?: string) => {
  return sessions.some(session => {
    if (excludeId && session.id === excludeId) return false
    if (!newSession.labs.includes(session.lab) || session.date !== newSession.date) return false
    
    if (!session.start_time && !session.startTime) return false
    if (!session.end_time && !session.endTime) return false
    
    const existingStart = parseTime(session.start_time || session.startTime)
    const existingEnd = parseTime(session.end_time || session.endTime)
    const newStart = parseTime(newSession.startTime)
    const newEnd = parseTime(newSession.endTime)
    
    return (newStart < existingEnd && newEnd > existingStart)
  })
}

// Check-in validation helper functions
const getSessionDateTime = (date: string, time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  const sessionDate = new Date(date)
  sessionDate.setHours(hours, minutes, 0, 0)
  return sessionDate
}

const canCheckIn = (sessionDate: string, startTime: string, endTime: string) => {
  const now = new Date()
  const sessionStart = getSessionDateTime(sessionDate, startTime)
  const sessionEnd = getSessionDateTime(sessionDate, endTime)
  return now <= sessionEnd
}

const getCheckInStatus = (sessionDate: string, startTime: string, endTime: string) => {
  const now = new Date()
  const sessionStart = getSessionDateTime(sessionDate, startTime)
  const sessionEnd = getSessionDateTime(sessionDate, endTime)
  
  if (now < sessionStart) {
    const timeDiff = sessionStart.getTime() - now.getTime()
    const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60))
    const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hoursLeft > 0) {
      return `Session starts in ${hoursLeft}h ${minutesLeft}m`
    } else {
      return `Session starts in ${minutesLeft}m`
    }
  } else if (now > sessionEnd) {
    return "Session ended"
  } else {
    return "Check-in available"
  }
}

// Helper function to generate recurring dates
const generateRecurringDates = (startDate: string, endDate: string): string[] => {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dayOfWeek = start.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Add the start date
  dates.push(startDate);
  
  // Add subsequent weeks
  let currentDate = new Date(start);
  currentDate.setDate(currentDate.getDate() + 7);
  
  while (currentDate <= end) {
    dates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return dates;
};

export default function SchedulePage() {
  const ADMIN_REVIEW_THRESHOLD = 240
  
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [selectedView, setSelectedView] = useState("day")
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null)
  const [userSession, setUserSession] = useState<UserSession | null>(null)
  
  // NEW: Check-in loading states
  const [checkingInSessions, setCheckingInSessions] = useState<Set<string>>(new Set())
  const [completingSessions, setCompletingSessions] = useState<Set<string>>(new Set())

  const autoCompleteSessions = async () => {
    try {
      const sessionsToComplete = sessions.filter(session => 
        session.sessionStatus === 'active' && 
        shouldAutoComplete(session.date, session.startTime, session.sessionStatus)
      );
  
      if (sessionsToComplete.length === 0) return;
  
      console.log(`Auto-completing ${sessionsToComplete.length} sessions`);
  
      for (const session of sessionsToComplete) {
        const completionTimestamp = createTimestampForStorage();
        
        const { error } = await supabase
          .from('sessions')
          .update({
            session_status: 'completed',
            completed_at: completionTimestamp
          })
          .eq('id', session.id)
          .eq('session_status', 'active'); // Only update if still active
  
        if (error) {
          console.error(`Failed to auto-complete session ${session.id}:`, error);
        } else {
          console.log(`Auto-completed session ${session.id} (${session.purpose})`);
        }
      }
  
      // Refresh sessions data after auto-completion
      await loadSessions();
    } catch (error) {
      console.error('Error in auto-completion process:', error);
    }
  };
  
  const router = useRouter()

  // Form state
  const [newSession, setNewSession] = useState({
    labs: [] as string[],
    date: selectedDate,
    startTime: "",
    endTime: "",
    purposeType: "",
    purpose: "",
    customPurpose: "",
    description: "",
    courseCode: "", // NEW FIELD
    isRecurring: false, // NEW FIELD
    recurrenceEndDate: "", // NEW FIELD
    configurations: {
      windows: false,
      internet: false,
      homes: false,
      userCleanup: false,
      handoutdata: false,
    },
  })

  // Load user session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sessionData = sessionStorage.getItem('userSession')
      if (!sessionData) {
        router.push('/login')
        return
      }
      const session: UserSession = JSON.parse(sessionData)
      setUserSession(session)
    }
  }, [router])

  useEffect(() => {
    const autoCompleteTimer = setInterval(() => {
      autoCompleteSessions();
    }, 5 * 60 * 1000); // Run every 5 minutes
  
    // Run once immediately when component mounts
    autoCompleteSessions();
  
    return () => clearInterval(autoCompleteTimer);
  }, [sessions]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null)
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Load sessions function
  const loadSessions = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('sessions')
        .select(`
          *,
          checked_in_by,
          checked_in_by_email,
          checked_in_at,
          completed_at,
          session_status
        `)
        .order('start_time');

      if (selectedView === "day") {
        query = query.eq('date', selectedDate);
      } else {
        const d = new Date(selectedDate);
        const day = d.getDay();
        const start = new Date(d); start.setDate(d.getDate() - day);
        const end = new Date(d); end.setDate(d.getDate() + (6 - day));
        const toStr = (x: Date) => x.toISOString().split("T")[0];

        query = query
          .gte('date', toStr(start))
          .lte('date', toStr(end))
          .order('date');
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading sessions:', error);
        showToast("Failed to load sessions.", "error");
        return;
      }

      const transformedSessions = data?.map(session => ({
        id: session.id,
        lab: session.lab,
        date: session.date,
        startTime: session.start_time,
        endTime: session.end_time,
        purpose: session.purpose,
        description: session.description,
        courseCode: session.course_code,
        isRecurring: session.is_recurring,
        recurrenceEndDate: session.recurrence_end_date,
        status: session.status,
        configurations: {
          windows: session.config_windows,
          internet: session.config_internet,
          homes: session.config_homes,
          userCleanup: session.config_user_cleanup,
          handoutdata: session.config_handoutdata,
        },
        createdBy: session.created_by,
        createdByEmail: session.created_by_email,
        checkedInBy: session.checked_in_by,
        checkedInByEmail: session.checked_in_by_email,
        checkedInAt: session.checked_in_at,
        completedAt: session.completed_at, 
        sessionStatus: session.session_status || 'pending',
      })) || [];

      setSessions(transformedSessions);
    } catch (err) {
      console.error('Error loading sessions:', err);
      showToast("Failed to load sessions.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time subscription
  useEffect(() => {
    loadSessions();

    const channel = supabase
      .channel('sessions-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'sessions' 
        }, 
        (payload) => {
          console.log('Real-time update:', payload);
          setTimeout(() => {
            loadSessions();
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, selectedView]);

  useEffect(() => {
    setNewSession(prev => ({ ...prev, date: selectedDate }))
  }, [selectedDate])

  const filteredSessions = sessions
    .sort((a, b) => {
      if (a.date === b.date) {
        return parseTime(a.startTime) - parseTime(b.startTime);
      }
      return a.date.localeCompare(b.date);
    });

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'error') => {
    setToast({ message, type })
  }

  const canScheduleSessions = () => {
    return userSession?.role === "Admin"
  }

  const canCheckInToSessions = () => {
    return userSession?.role === "BCDR" || userSession?.role === "Welcoming Team"
  }

  // Form validation
  const validateForm = (): boolean => {
    const errors: ValidationErrors = {}

    if (!newSession.labs || newSession.labs.length === 0) {
      errors.labs = "Please select at least one lab"
    }

    if (!newSession.date) {
      errors.date = "Please select a date"
    } else {
      const selectedDateObj = new Date(newSession.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      selectedDateObj.setHours(0, 0, 0, 0)
      
      if (selectedDateObj < today) {
        errors.date = "Cannot schedule sessions for past dates"
      }
    }

    if (!newSession.startTime) {
      errors.startTime = "Please select a start time"
    } else {
      const today = new Date().toISOString().split("T")[0]
      if (newSession.date === today) {
        const now = new Date()
        const selectedDateTime = getSessionDateTime(newSession.date, newSession.startTime)
        
        if (selectedDateTime < now) {
          errors.startTime = "Start time has already passed. Please choose a future time."
        }
      }
    }

    if (!newSession.endTime) {
      errors.endTime = "Please select an end time"
    }

    if (newSession.startTime && newSession.endTime) {
      const timeValidation = validateTimeRange(newSession.startTime, newSession.endTime)
      
      if (timeValidation.endBeforeStart) {
        errors.endTime = "End time must be after start time"
      } else if (timeValidation.tooShort) {
        errors.endTime = `Session must be at least ${MIN_SESSION_DURATION} minutes long`
      }
    }

    if (!newSession.purposeType) {
      errors.purpose = "Please select a purpose type"
    } else if (newSession.purposeType === "other") {
      if (!newSession.customPurpose.trim()) {
        errors.purpose = "Please provide a custom purpose"
      } else if (newSession.customPurpose.trim().length < 5) {
        errors.purpose = "Purpose must be at least 5 characters long"
      } else if (newSession.customPurpose.trim().length > 200) {
        errors.purpose = "Purpose must be less than 200 characters"
      }
    }

    // NEW: Course code validation
    if (!newSession.courseCode.trim()) {
      errors.courseCode = "Course code is required"
    } else if (newSession.courseCode.trim().length > 20) {
      errors.courseCode = "Course code must be less than 20 characters"
    }

    // NEW: Recurrence validation
    if (newSession.isRecurring && !newSession.recurrenceEndDate) {
      errors.recurrenceEndDate = "Please select an end date for recurrence"
    } else if (newSession.isRecurring && newSession.recurrenceEndDate) {
      const endDate = new Date(newSession.recurrenceEndDate)
      const startDate = new Date(newSession.date)
      
      if (endDate <= startDate) {
        errors.recurrenceEndDate = "End date must be after start date"
      }
      
      // Limit recurrence to 6 months
      const maxEndDate = new Date(startDate)
      maxEndDate.setMonth(maxEndDate.getMonth() + 6)
      
      if (endDate > maxEndDate) {
        errors.recurrenceEndDate = "Recurrence cannot exceed 6 months"
      }
    }

    if (newSession.labs.length > 0 && newSession.date && newSession.startTime && newSession.endTime) {
      const conflictingLabs = newSession.labs.filter(lab => 
        hasTimeConflict(sessions, { labs: [lab], date: newSession.date, startTime: newSession.startTime, endTime: newSession.endTime })
      )
      
      if (conflictingLabs.length > 0) {
        errors.general = `Time slot conflicts with existing sessions in lab(s): ${conflictingLabs.join(', ')}`
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormChange = (field: string, value: string | boolean | number | string[]) => {
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }))
    }
    if (validationErrors.general) {
      setValidationErrors(prev => ({ ...prev, general: undefined }))
    }

    if (field.includes(".")) {
      const [parent, child] = field.split(".")
      setNewSession(prev => {
        const parentObj = prev[parent as keyof typeof prev]
        if (typeof parentObj === 'object' && parentObj !== null) {
          return {
            ...prev,
            [parent]: {
              ...parentObj,
              [child]: value,
            },
          }
        }
        return prev
      })
    } else if (field === "purposeType") {
      const purposeType = value as string
      const selectedOption = PURPOSE_OPTIONS.find(option => option.value === purposeType)
      
      setNewSession({
        ...newSession,
        purposeType,
        purpose: purposeType === "other" ? "" : (selectedOption?.label || ""),
        customPurpose: purposeType === "other" ? newSession.customPurpose : "",
      })
    } else if (field === "customPurpose") {
      setNewSession({
        ...newSession,
        customPurpose: value as string,
        purpose: value as string,
      })
    } else {
      setNewSession({
        ...newSession,
        [field]: value,
      })
    }
  }

  const handleLabToggle = (labId: string) => {
    const currentLabs = newSession.labs
    const isSelected = currentLabs.includes(labId)
    
    let newLabs: string[]
    if (isSelected) {
      newLabs = currentLabs.filter(id => id !== labId)
    } else {
      newLabs = [...currentLabs, labId]
    }
    
    handleFormChange("labs", newLabs)
  }

  // Session creation function
  const handleCreateSession = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      const tv = validateTimeRange(newSession.startTime, newSession.endTime);
      const needsReview = tv.duration > ADMIN_REVIEW_THRESHOLD;

      const sessionTemplate = {
        date: newSession.date,
        start_time: newSession.startTime,
        end_time: newSession.endTime,
        purpose: newSession.purposeType === "other"
          ? newSession.customPurpose.trim()
          : newSession.purpose,
        description: newSession.description.trim(),
        course_code: newSession.courseCode.trim(), // NEW FIELD
        is_recurring: newSession.isRecurring, // NEW FIELD
        recurrence_end_date: newSession.isRecurring ? newSession.recurrenceEndDate : null, // NEW FIELD
        status: needsReview ? "under_review" : "confirmed",
        created_by: userSession?.name || "You",
        created_by_email: userSession?.email || "",
        config_windows: newSession.configurations.windows,
        config_internet: newSession.configurations.internet,
        config_homes: newSession.configurations.homes,
        config_user_cleanup: newSession.configurations.userCleanup,
        config_handoutdata: newSession.configurations.handoutdata,
        session_status: 'pending',
      };

      // Generate all session dates if recurring
      const allSessionDates = newSession.isRecurring 
        ? generateRecurringDates(newSession.date, newSession.recurrenceEndDate!)
        : [newSession.date];

      // Create sessions for each lab and each date
      const sessionsToCreate = [];
      for (const labId of newSession.labs) {
        for (const sessionDate of allSessionDates) {
          sessionsToCreate.push({
            ...sessionTemplate,
            lab: labId,
            date: sessionDate,
          });
        }
      }

      const { data, error } = await supabase
        .from('sessions')
        .insert(sessionsToCreate)
        .select();

      if (error) {
        console.error('Error creating sessions:', error);
        setValidationErrors({ general: "Failed to create sessions. Please try again." });
        return;
      }

      if (data && data.length > 0) {
        const actualSessions = data.map(session => ({
          id: session.id,
          lab: session.lab,
          date: session.date,
          startTime: session.start_time,
          endTime: session.end_time,
          purpose: session.purpose,
          description: session.description,
          courseCode: session.course_code,
          isRecurring: session.is_recurring,
          recurrenceEndDate: session.recurrence_end_date,
          status: session.status,
          configurations: {
            windows: session.config_windows,
            internet: session.config_internet,
            homes: session.config_homes,
            userCleanup: session.config_user_cleanup,
            handoutdata: session.config_handoutdata,
          },
          createdBy: session.created_by,
          createdByEmail: session.created_by_email,
          checkedInBy: session.checked_in_by,
          checkedInByEmail: session.checked_in_by_email,
          checkedInAt: session.checked_in_at,
          sessionStatus: (session.session_status as 'pending' | 'active' | 'completed') || 'pending',
        }));

        setSessions(prev => [...prev, ...actualSessions]);
      }

      setIsAddDialogOpen(false);
      
      const labCount = newSession.labs.length;
      const dateCount = newSession.isRecurring ? allSessionDates.length : 1;
      const sessionCount = labCount * dateCount;
      const labText = labCount === 1 ? `lab ${newSession.labs[0]}` : `${labCount} labs`;
      
      showToast(needsReview
        ? `${sessionCount} session${sessionCount > 1 ? 's' : ''} scheduled in ${labText}! Admin approval required (${Math.round(tv.duration/60)}h).`
        : `${sessionCount} session${sessionCount > 1 ? 's' : ''} scheduled successfully in ${labText}!`,
        needsReview ? "warning" : "success"
      );

      // Reset form
      setNewSession({
        labs: [],
        date: selectedDate,
        startTime: "",
        endTime: "",
        purposeType: "",
        purpose: "",
        customPurpose: "",
        description: "",
        courseCode: "",
        isRecurring: false,
        recurrenceEndDate: "",
        configurations: { 
          windows: false, 
          internet: false, 
          homes: false, 
          userCleanup: false,
          handoutdata: false,
        },
      });
      setValidationErrors({});
    } catch (e) {
      console.error('Error creating sessions:', e);
      setValidationErrors({ general: "Failed to create sessions. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSession = async (sessionId: string) => {
    const s = sessions.find(x => x.id === sessionId);
    if (!s) return;

    const ok = window.confirm(
      `Are you sure you want to delete "${s.purpose}" on ${formatDate(s.date)} at ${formatTime(s.startTime)}? This action cannot be undone.`
    );
    if (!ok) return;

    try {
      setSessions(prev => prev.filter(session => session.id !== sessionId));

      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        setSessions(prev => [...prev, s]);
        console.error('Error deleting session:', error);
        showToast("Failed to delete session.", "error");
        return;
      }

      showToast("Session deleted successfully.", "success");
    } catch (e) {
      setSessions(prev => [...prev, s]);
      console.error('Error deleting session:', e);
      showToast("Failed to delete session.", "error");
    }
  };

  // Check-in function
  const handleCheckIn = async (sessionId: string) => {
    if (!userSession) return;

    // Start loading state
    setCheckingInSessions(prev => new Set([...prev, sessionId]));

    try {
      // Check if session is already checked in
      const { data: currentSession, error: fetchError } = await supabase
        .from('sessions')
        .select('checked_in_by, checked_in_by_email, checked_in_at, session_status')
        .eq('id', sessionId)
        .single();

      if (fetchError) {
        showToast("Failed to check session status.", "error");
        return;
      }

      // Check if someone else has already checked in
      if (currentSession.checked_in_by && currentSession.checked_in_by !== userSession.name) {
        showToast(
          `Session already checked in by ${currentSession.checked_in_by} at ${new Date(currentSession.checked_in_at).toLocaleTimeString()}`, 
          "error"
        );
        return;
      }

      // If user has already checked in, just show a message
      if (currentSession.checked_in_by === userSession.name) {
        showToast("You are already checked into this session.", "success");
        return;
      }

      // Simulate check-in process with delay for better UX
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Perform the check-in
      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          checked_in_by: userSession.name,
          checked_in_by_email: userSession.email,
          checked_in_at: new Date().toISOString(),
          session_status: 'active' // Mark session as active
        })
        .eq('id', sessionId)
        .is('checked_in_by', null);

      if (updateError) {
        console.error('Check-in failed:', updateError);
        showToast("Failed to check in. Please try again.", "error");
        return;
      }

      // Verify the update
      const { data: verifySession, error: verifyError } = await supabase
        .from('sessions')
        .select('checked_in_by, checked_in_by_email')
        .eq('id', sessionId)
        .single();

      if (verifyError) {
        showToast("Check-in verification failed.", "error");
        return;
      }

      if (verifySession.checked_in_by !== userSession.name) {
        showToast(
          `Session was checked in by ${verifySession.checked_in_by} just before you. Please coordinate with them.`, 
          "error"
        );
        return;
      }

      // Success - Show success message but don't navigate
      showToast("Successfully checked into session! You can now enter lab controls when ready.", "success");

    } catch (error) {
      console.error('Check-in error:', error);
      showToast("Check-in failed. Please try again.", "error");
    } finally {
      // Remove loading state
      setCheckingInSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
    }
  };

  // Complete session function
  const handleCompleteSession = async (sessionId: string) => {
    if (!userSession) return;
  
    const confirmComplete = window.confirm(
      "Are you sure you want to mark this session as completed? This will end your session and allow others to check in if needed."
    );
    
    if (!confirmComplete) return;
  
    setCompletingSessions(prev => new Set([...prev, sessionId]));
  
    try {
      // Create completion timestamp
      const completionTimestamp = createTimestampForStorage();
  
      const { error } = await supabase
        .from('sessions')
        .update({
          session_status: 'completed',
          completed_at: completionTimestamp  // Add this field
        })
        .eq('id', sessionId)
        .eq('checked_in_by', userSession.name); // Only allow the person who checked in to complete
  
      if (error) {
        console.error('Error completing session:', error);
        showToast("Failed to complete session.", "error");
        return;
      }
  
      showToast("Session marked as completed successfully!", "success");
    } catch (error) {
      console.error('Complete session error:', error);
      showToast("Failed to complete session.", "error");
    } finally {
      setCompletingSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
    }
  };
  

  // Get session check-in status
  const getSessionCheckInStatus = (session: any) => {
    if (session.checkedInBy) {
      const checkedInTime = new Date(session.checkedInAt).toLocaleTimeString();
      const completedTime = session.completedAt ? new Date(session.completedAt).toLocaleTimeString() : undefined;
      const isCurrentUser = session.checkedInBy === userSession?.name;
      const sessionStatus = session.sessionStatus || 'active';
      
      return {
        isCheckedIn: true,
        checkedInBy: session.checkedInBy,
        checkedInTime,
        completedTime,
        isCurrentUser,
        sessionStatus,
        canAccess: isCurrentUser && sessionStatus !== 'completed'
      };
    }
    
    return {
      isCheckedIn: false,
      canAccess: true,
      sessionStatus: 'pending'
    };
  };

  // Render session buttons
  const renderSessionButtons = (session: any) => {
    const checkInAvailable = canCheckIn(session.date, session.startTime, session.endTime) && session.status === "confirmed";
    const isUnderReview = session.status === "under_review";
    const checkInStatus = getSessionCheckInStatus(session);
    const isCheckingIn = checkingInSessions.has(session.id);
    const isCompleting = completingSessions.has(session.id);
    
    if (!canCheckInToSessions()) {
      return null;
    }

    if (isUnderReview) {
      return (
        <Button disabled className="flex-1">
          Under Review
        </Button>
      );
    }

    if (!checkInAvailable) {
      return (
        <Button disabled className="flex-1">
          Not Available
        </Button>
      );
    }

    if (checkInStatus.isCheckedIn) {
      if (checkInStatus.isCurrentUser) {
        if (checkInStatus.sessionStatus === 'completed') {
          return (
            <Button disabled className="flex-1 bg-gray-500">
              Setup Completed
            </Button>
          );
        }
        
        // Show both lab control access and completion options
        return (
          <div className="flex flex-col gap-2 flex-1">
            <Button 
              className="bg-green-600 hover:bg-green-700" 
              onClick={() => router.push(`/labs/${session.lab}?session=${session.id}`)}
              disabled={isCompleting}
            >
              Enter Lab Controls
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => handleCompleteSession(session.id)}
              disabled={isCompleting}
              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            >
              {isCompleting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <LogOut className="h-3 w-3 mr-1" />
                  Complete Setup
                </>
              )}
            </Button>
          </div>
        );
      } else {
        return (
          <div className="flex-1">
            <Button disabled className="w-full">
              {checkInStatus.sessionStatus === 'completed' ? 
                'Session Completed' : 
                `Checked In by ${checkInStatus.checkedInBy}`
              }
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-1">
              at {checkInStatus.checkedInTime}
            </p>
          </div>
        );
      }
    }

    // Check-in button with animation
    return (
      <Button 
        className="flex-1" 
        onClick={() => handleCheckIn(session.id)}
        disabled={isCheckingIn}
      >
        {isCheckingIn ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Checking In...
          </>
        ) : (
          'Check In'
        )}
      </Button>
    );
  };

  // Navigation and formatting functions
  const handleBackToDashboard = () => {
    router.push("/dashboard")
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":")
    const hour = Number.parseInt(hours)
    return `${hour % 12 || 12}${minutes !== "00" ? ":" + minutes : ""} ${hour >= 12 ? "PM" : "AM"}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  if (!userSession) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f4d92] mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] max-w-md rounded-lg shadow-lg p-4 animate-in slide-in-from-top-2 ${
          toast.type === 'success' ? 'bg-green-100 border border-green-400 text-green-700' :
          toast.type === 'warning' ? 'bg-yellow-100 border border-yellow-400 text-yellow-700' :
          'bg-red-100 border border-red-400 text-red-700'
        }`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {toast.type === 'success' && <CheckCircle className="h-5 w-5" />}
              {toast.type === 'warning' && <AlertCircle className="h-5 w-5" />}
              {toast.type === 'error' && <AlertCircle className="h-5 w-5" />}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setToast(null)}
                className="inline-flex rounded-md p-1.5 hover:bg-opacity-20 hover:bg-gray-600 focus:outline-none"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-[#0f4d92] text-white p-4 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBackToDashboard}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5 text-white group-hover:text-white" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Schedule Sessions</h1>
              <p className="text-xs opacity-75">
                {userSession.name} ({userSession.role}) - 
                {canScheduleSessions() ? " Can schedule sessions" : " Can check in to sessions"}
              </p>
            </div>
          </div>
          
          {canScheduleSessions() && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-white text-[#0f4d92] hover:bg-gray-100">
                  <Plus className="h-4 w-4 mr-2" />
                  New Session
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Schedule New Session</DialogTitle>
                  <DialogDescription>Create new lab session(s) with specific configurations.</DialogDescription>
                </DialogHeader>
                
                {validationErrors.general && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{validationErrors.general}</AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="date" className="text-sm font-medium">
                        Date <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        value={newSession.date}
                        onChange={(e) => handleFormChange("date", e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className={validationErrors.date ? "border-red-500" : ""}
                      />
                      {validationErrors.date && (
                        <p className="text-sm text-red-500">{validationErrors.date}</p>
                      )}
                    </div>
                    
                    <div className="grid gap-2 col-span-2">
                      <Label className="text-sm font-medium">
                        Labs <span className="text-red-500">*</span>
                      </Label>
                      <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg max-h-40 overflow-y-auto">
                        {labsData.map((lab) => (
                          <div key={lab.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`lab-${lab.id}`}
                              checked={newSession.labs.includes(lab.id)}
                              onChange={() => handleLabToggle(lab.id)}
                              className="rounded border-gray-300"
                            />
                            <Label htmlFor={`lab-${lab.id}`} className="text-sm cursor-pointer">
                              Lab {lab.id} ({lab.capacity} seats)
                            </Label>
                          </div>
                        ))}
                      </div>
                      {newSession.labs.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Selected: {newSession.labs.length} lab{newSession.labs.length > 1 ? 's' : ''} - {newSession.labs.join(', ')}
                        </p>
                      )}
                      {validationErrors.labs && (
                        <p className="text-sm text-red-500">{validationErrors.labs}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="startTime" className="text-sm font-medium">
                        Start Time <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={newSession.startTime}
                        onChange={(e) => handleFormChange("startTime", e.target.value)}
                        className={validationErrors.startTime ? "border-red-500" : ""}
                      />
                      {validationErrors.startTime && (
                        <p className="text-sm text-red-500">{validationErrors.startTime}</p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="endTime" className="text-sm font-medium">
                        End Time <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={newSession.endTime}
                        onChange={(e) => handleFormChange("endTime", e.target.value)}
                        className={validationErrors.endTime ? "border-red-500" : ""}
                      />
                      {validationErrors.endTime && (
                        <p className="text-sm text-red-500">{validationErrors.endTime}</p>
                      )}
                    </div>
                  </div>

                  {newSession.startTime && newSession.endTime && (
                    <div className="mt-2">
                      {(() => {
                        const timeValidation = validateTimeRange(newSession.startTime, newSession.endTime)
                        const duration = timeValidation.duration || 0
                        const hours = duration / 60
                        
                        if (timeValidation.isValid && duration > 240) {
                          return (
                            <Alert className="border-orange-200 bg-orange-50">
                              <AlertCircle className="h-4 w-4 text-orange-600" />
                              <AlertDescription className="text-orange-800">
                                <strong>Admin Review Required:</strong> Sessions longer than 4 hours ({hours.toFixed(1)} hours) require administrator approval to minimize booking errors.
                              </AlertDescription>
                            </Alert>
                          )
                        } else if (timeValidation.isValid) {
                          return (
                            <p className="text-sm text-muted-foreground">
                              Session duration: {Math.round(duration)} minutes ({hours.toFixed(1)} hours)
                              {newSession.labs.length > 1 && (
                                <span className="block text-xs mt-1">
                                  This will create {newSession.labs.length} identical sessions
                                </span>
                              )}
                            </p>
                          )
                        }
                        return null
                      })()}
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="courseCode" className="text-sm font-medium">
                      Course Code <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="courseCode"
                      placeholder="e.g., COMP101, MATH202"
                      value={newSession.courseCode}
                      onChange={(e) => handleFormChange("courseCode", e.target.value)}
                      className={validationErrors.courseCode ? "border-red-500" : ""}
                      maxLength={20}
                    />
                    {validationErrors.courseCode && (
                      <p className="text-sm text-red-500">{validationErrors.courseCode}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isRecurring"
                        checked={newSession.isRecurring}
                        onChange={(e) => handleFormChange("isRecurring", e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="isRecurring" className="text-sm">
                        Recurring weekly session
                      </Label>
                    </div>
                    
                    {newSession.isRecurring && (
                      <div className="grid gap-2 pl-6">
                        <Label htmlFor="recurrenceEndDate" className="text-sm font-medium">
                          End Date <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="recurrenceEndDate"
                          type="date"
                          value={newSession.recurrenceEndDate}
                          onChange={(e) => handleFormChange("recurrenceEndDate", e.target.value)}
                          min={newSession.date}
                          max={(() => {
                            const maxDate = new Date(newSession.date);
                            maxDate.setMonth(maxDate.getMonth() + 6);
                            return maxDate.toISOString().split("T")[0];
                          })()}
                          className={validationErrors.recurrenceEndDate ? "border-red-500" : ""}
                        />
                        {validationErrors.recurrenceEndDate && (
                          <p className="text-sm text-red-500">{validationErrors.recurrenceEndDate}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Sessions will be created weekly until this date (max 6 months)
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="purposeType" className="text-sm font-medium">
                      Purpose Type <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={newSession.purposeType}
                      onValueChange={(value) => handleFormChange("purposeType", value)}
                    >
                      <SelectTrigger className={validationErrors.purpose ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select purpose type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PURPOSE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.purpose && (
                      <p className="text-sm text-red-500">{validationErrors.purpose}</p>
                    )}
                  </div>

                  {newSession.purposeType === "other" && (
                    <div className="grid gap-2">
                      <Label htmlFor="customPurpose" className="text-sm font-medium">
                        Custom Purpose <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="customPurpose"
                        placeholder="Describe the purpose of this session"
                        value={newSession.customPurpose}
                        onChange={(e) => handleFormChange("customPurpose", e.target.value)}
                        maxLength={200}
                        className={validationErrors.purpose ? "border-red-500" : ""}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span></span>
                        <span>{newSession.customPurpose.length}/200</span>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="description" className="text-sm font-medium">
                      Description for the Session
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Provide additional details about this session (optional)"
                      value={newSession.description}
                      onChange={(e) => handleFormChange("description", e.target.value)}
                      maxLength={500}
                      rows={3}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Optional</span>
                      <span>{newSession.description.length}/500</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Lab Configuration</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="windows"
                          checked={newSession.configurations.windows}
                          onChange={(e) => handleFormChange("configurations.windows", e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="windows" className="text-sm">Windows Boot</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="internet"
                          checked={newSession.configurations.internet}
                          onChange={(e) => handleFormChange("configurations.internet", e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="internet" className="text-sm">Internet Access</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="homes"
                          checked={newSession.configurations.homes}
                          onChange={(e) => handleFormChange("configurations.homes", e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="homes" className="text-sm">Home Directories</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="userCleanup"
                          checked={newSession.configurations.userCleanup}
                          onChange={(e) => handleFormChange("configurations.userCleanup", e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="userCleanup" className="text-sm">User Cleanup</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="handoutdata"
                          checked={newSession.configurations.handoutdata}
                          onChange={(e) => handleFormChange("configurations.handoutdata", e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="handoutdata" className="text-sm">Handout Data</Label>
                      </div>
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsAddDialogOpen(false)
                      setValidationErrors({})
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateSession} 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Scheduling..." : 
                     newSession.labs.length > 1 ? 
                     `Schedule ${newSession.labs.length} Sessions` : 
                     "Schedule Session"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle>Lab Schedule - {formatDate(selectedDate)}</CardTitle>
              <div className="flex items-center gap-2">
                <Tabs value={selectedView} onValueChange={setSelectedView} className="w-[200px]">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="day">Day</TabsTrigger>
                    <TabsTrigger value="week">Week</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const date = new Date(selectedDate)
                  date.setDate(date.getDate() - 1)
                  setSelectedDate(date.toISOString().split("T")[0])
                }}
              >
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const date = new Date(selectedDate)
                  date.setDate(date.getDate() + 1)
                  setSelectedDate(date.toISOString().split("T")[0])
                }}
              >
                Next
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f4d92] mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading sessions...</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-muted/50">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <h3 className="text-lg font-medium">No Sessions Scheduled</h3>
                <p className="text-sm text-muted-foreground mb-4">There are no sessions scheduled for this date.</p>
                {canScheduleSessions() && (
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule New Session
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSessions
                  .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime))
                  .map((session) => {
                    const checkInAvailable = canCheckIn(session.date, session.startTime, session.endTime) && session.status === "confirmed"
                    const checkInStatus = getCheckInStatus(session.date, session.startTime, session.endTime)
                    const isUnderReview = session.status === "under_review"
                    const sessionDuration = validateTimeRange(session.startTime, session.endTime).duration
                    const sessionCheckIn = getSessionCheckInStatus(session)
                    const isCheckingIn = checkingInSessions.has(session.id)
                    
                    return (
                      <Card key={session.id} className={`overflow-hidden border-l-4 ${
                        isUnderReview ? 'border-l-orange-500' : 
                        sessionCheckIn.sessionStatus === 'completed' ? 'border-l-gray-500' :
                        sessionCheckIn.isCheckedIn ? 'border-l-green-500' : 'border-l-[#0f4d92]'
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className="bg-muted p-2 rounded-lg flex flex-col items-center justify-center min-w-[60px]">
                                <Clock className="h-5 w-5 text-muted-foreground mb-1" />
                                <span className="text-xs font-medium">
                                  {formatTime(session.startTime)} - {formatTime(session.endTime)}
                                </span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-medium">{session.purpose}</h3>
                                  <Badge>Lab {session.lab}</Badge>
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                                    {session.courseCode}
                                  </Badge>
                                  
                                  {isUnderReview && (
                                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                                      Under Review
                                    </Badge>
                                  )}
                                  {session.status === "confirmed" && !sessionCheckIn.isCheckedIn && (
                                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                      Available
                                    </Badge>
                                  )}
                                  {sessionCheckIn.sessionStatus === 'completed' && (
                                    <Badge className="bg-gray-600 text-white">
                                      Setup Completed
                                    </Badge>
                                  )}
                                  {sessionCheckIn.isCheckedIn && sessionCheckIn.sessionStatus === 'active' && (
                                    <Badge className="bg-green-600 text-white">
                                      {sessionCheckIn.isCurrentUser ? 'Active (You)' : `Active (${sessionCheckIn.checkedInBy})`}
                                    </Badge>
                                  )}
                                  {isCheckingIn && (
                                    <Badge className="bg-blue-600 text-white animate-pulse">
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      Checking In...
                                    </Badge>
                                  )}
                                </div>
                                
                                <p className="text-sm text-muted-foreground">Created by {session.createdBy}</p>
                                
                                {session.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{session.description}</p>
                                )}
                                
                                <div className="mt-1">
                                  <p className="text-xs text-muted-foreground">
                                    Duration: {Math.round(sessionDuration)} minutes ({(sessionDuration / 60).toFixed(1)} hours)
                                  </p>
                                  {session.isRecurring && session.recurrenceEndDate && (
                                    <p className="text-xs text-blue-600 font-medium mt-1">
                                      🔄 Recurring weekly until {new Date(session.recurrenceEndDate).toLocaleDateString()}
                                    </p>
                                  )}
                                  {isUnderReview && (
                                    <p className="text-xs text-orange-600 font-medium mt-1">
                                      ⚠️ Admin approval required for sessions over 4 hours
                                    </p>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2 mt-1">
                                {sessionCheckIn.sessionStatus === 'completed' ? (
                                  <div className="flex items-center gap-1 text-gray-600">
                                    <CheckCircle className="h-4 w-4" />
                                    <span className="text-xs font-medium">
                                      Session completed by {sessionCheckIn.checkedInBy} at {sessionCheckIn.completedTime || 'Unknown time'}
                                    </span>
                                  </div>
                                ) : sessionCheckIn.isCheckedIn ? (
                                  <div className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="h-4 w-4" />
                                    <span className="text-xs font-medium">
                                      Active - Checked in by {sessionCheckIn.checkedInBy} at {sessionCheckIn.checkedInTime}
                                    </span>
                                  </div>
                                  ) : isCheckingIn ? (
                                    <div className="flex items-center gap-1 text-blue-600">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      <span className="text-xs font-medium">Processing check-in...</span>
                                    </div>
                                  ) : session.status === "confirmed" ? (
                                    checkInAvailable ? (
                                      <div className="flex items-center gap-1 text-green-600">
                                        <CheckCircle className="h-4 w-4" />
                                        <span className="text-xs font-medium">Ready for check-in</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 text-orange-600">
                                        <Clock className="h-4 w-4" />
                                        <span className="text-xs font-medium">{checkInStatus}</span>
                                      </div>
                                    )
                                  ) : (
                                    <div className="flex items-center gap-1 text-orange-600">
                                      <AlertCircle className="h-4 w-4" />
                                      <span className="text-xs font-medium">Pending admin approval</span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {session.configurations.windows && <Badge variant="outline">Windows</Badge>}
                                  {session.configurations.internet && <Badge variant="outline">Internet</Badge>}
                                  {session.configurations.homes && <Badge variant="outline">Home Dirs</Badge>}
                                  {session.configurations.userCleanup && <Badge variant="outline">User Cleanup</Badge>}
                                  {session.configurations.handoutdata && <Badge variant="outline">Handout Data</Badge>}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                {renderSessionButtons(session)}
                                
                                {session.createdBy === userSession?.name && !sessionCheckIn.isCheckedIn && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleCancelSession(session.id)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                    title="Delete Session"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}