"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, Clock, Plus, AlertCircle, CheckCircle, Trash2 } from "lucide-react"
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
  general?: string
}

// Session data interface
interface SessionData {
  id: string
  lab: string
  date: string
  startTime: string
  endTime: string
  purpose: string
  description: string
  status: string
  configurations: {
    windows: boolean
    internet: boolean
    homes: boolean
    userCleanup: boolean
    handoutdata: boolean
    reboot: boolean
  }
  createdBy: string
  createdByEmail: string
  // NEW CHECK-IN FIELDS
  checkedInBy?: string
  checkedInByEmail?: string
  checkedInAt?: string
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
  if (!timeString) return 0; // Return 0 if timeString is undefined or empty
  const [hours, minutes] = timeString.split(':').map(Number)
  return hours * 60 + minutes // Convert to minutes for easy comparison
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
    
    // Check if session has valid time values
    if (!session.start_time && !session.startTime) return false
    if (!session.end_time && !session.endTime) return false
    
    const existingStart = parseTime(session.start_time || session.startTime)
    const existingEnd = parseTime(session.end_time || session.endTime)
    const newStart = parseTime(newSession.startTime)
    const newEnd = parseTime(newSession.endTime)
    
    // Check for overlap: new session starts before existing ends AND new session ends after existing starts
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

// MODIFIED: Allow check-in at any time after scheduling for testing
const canCheckIn = (sessionDate: string, startTime: string, endTime: string) => {
  const now = new Date()
  const sessionStart = getSessionDateTime(sessionDate, startTime)
  const sessionEnd = getSessionDateTime(sessionDate, endTime)
  
  // For testing: Allow check-in immediately after scheduling, not just 30 minutes before
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

export default function SchedulePage() {
  // Constants moved inside component for accessibility
  const ADMIN_REVIEW_THRESHOLD = 240 // 4 hours - sessions longer than this need admin review
  
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
  const router = useRouter()

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

  // Update current time every minute for real-time check-in validation
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(timer)
  }, [])

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null)
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Function to load sessions
  const loadSessions = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('sessions')
        .select(`
          *,
          checked_in_by,
          checked_in_by_email,
          checked_in_at
        `)
        .order('start_time');

      if (selectedView === "day") {
        // Single day
        query = query.eq('date', selectedDate);
      } else {
        // Whole week
        const d = new Date(selectedDate);
        const day = d.getDay(); // 0=Sun
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

      // Transform data to match the frontend expectations
      const transformedSessions = data?.map(session => ({
        id: session.id,
        lab: session.lab,
        date: session.date,
        startTime: session.start_time,
        endTime: session.end_time,
        purpose: session.purpose,
        description: session.description, // NEW FIELD
        status: session.status,
        configurations: {
          windows: session.config_windows,
          internet: session.config_internet,
          homes: session.config_homes,
          userCleanup: session.config_user_cleanup,
          handoutdata: session.config_handoutdata,
          reboot: session.config_reboot || false, // NEW FIELD
        },
        createdBy: session.created_by,
        createdByEmail: session.created_by_email,
        // NEW CHECK-IN DATA
        checkedInBy: session.checked_in_by,
        checkedInByEmail: session.checked_in_by_email,
        checkedInAt: session.checked_in_at,
      })) || [];

      setSessions(transformedSessions);
    } catch (err) {
      console.error('Error loading sessions:', err);
      showToast("Failed to load sessions.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Load sessions (real-time) for the selected day/week
  useEffect(() => {
    loadSessions();

    // Set up real-time subscription
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
          // Add a small delay to ensure the database transaction is complete
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

  // New session form state - UPDATED FOR MULTI-LAB SELECTION
  const [newSession, setNewSession] = useState({
    labs: [] as string[], // Changed from single lab to array of labs
    date: selectedDate,
    startTime: "",
    endTime: "",
    purposeType: "",
    purpose: "",
    customPurpose: "",
    description: "", // NEW FIELD
    configurations: {
      windows: false,
      internet: false,
      homes: false,
      userCleanup: false,
      handoutdata: false,
      reboot: false, // NEW FIELD
    },
  })

  // Update newSession date when selectedDate changes
  useEffect(() => {
    setNewSession(prev => ({ ...prev, date: selectedDate }))
  }, [selectedDate])

  // Filter sessions based on selected date
  const filteredSessions = sessions
    .sort((a, b) => {
      // Same date → sort by startTime
      if (a.date === b.date) {
        return parseTime(a.startTime) - parseTime(b.startTime);
      }
      // Different dates → sort by date string
      return a.date.localeCompare(b.date);
    });

  // Toast notification function
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'error') => {
    setToast({ message, type })
  }

  // Check if user can schedule sessions (only Admin)
  const canScheduleSessions = () => {
    return userSession?.role === "Admin"
  }

  // Check if user can check in to sessions (BCDR and Welcoming Team)
  const canCheckInToSessions = () => {
    return userSession?.role === "BCDR" || userSession?.role === "Welcoming Team"
  }

  // UPDATED: Validation function that checks for conflicts across all selected labs
  const validateForm = (): boolean => {
    const errors: ValidationErrors = {}

    // Required field validation - UPDATED for multi-lab
    if (!newSession.labs || newSession.labs.length === 0) {
      errors.labs = "Please select at least one lab"
    }

    if (!newSession.date) {
      errors.date = "Please select a date"
    } else {
      // Date should not be in the past
      const selectedDateObj = new Date(newSession.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      selectedDateObj.setHours(0, 0, 0, 0) // Ensure we're comparing dates only
      
      if (selectedDateObj < today) {
        errors.date = "Cannot schedule sessions for past dates"
      }
    }

    // Start time validation
    if (!newSession.startTime) {
      errors.startTime = "Please select a start time"
    } else {
      // Check if start time has passed ONLY if the selected date is today
      const today = new Date().toISOString().split("T")[0]
      if (newSession.date === today) {
        // Only validate against current time if it's today's date
        const now = new Date()
        const selectedDateTime = getSessionDateTime(newSession.date, newSession.startTime)
        
        if (selectedDateTime < now) {
          errors.startTime = "Start time has already passed. Please choose a future time."
        }
      }
    }

    // End time validation
    if (!newSession.endTime) {
      errors.endTime = "Please select an end time"
    }

    // Time range validation
    if (newSession.startTime && newSession.endTime) {
      const timeValidation = validateTimeRange(newSession.startTime, newSession.endTime)
      
      if (timeValidation.endBeforeStart) {
        errors.endTime = "End time must be after start time"
      } else if (timeValidation.tooShort) {
        errors.endTime = `Session must be at least ${MIN_SESSION_DURATION} minutes long`
      }
    }

    // Purpose validation
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

    // UPDATED: Check for time conflicts with existing sessions across all selected labs
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

  // UPDATED: Handle form changes for multi-lab selection
  const handleFormChange = (field: string, value: string | boolean | number | string[]) => {
    // Clear validation errors when user starts typing/selecting
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
      // Handle purpose type selection
      const purposeType = value as string
      const selectedOption = PURPOSE_OPTIONS.find(option => option.value === purposeType)
      
      setNewSession({
        ...newSession,
        purposeType,
        purpose: purposeType === "other" ? "" : (selectedOption?.label || ""),
        customPurpose: purposeType === "other" ? newSession.customPurpose : "",
      })
    } else if (field === "customPurpose") {
      // Handle custom purpose input
      setNewSession({
        ...newSession,
        customPurpose: value as string,
        purpose: value as string, // Set the actual purpose to the custom value
      })
    } else {
      setNewSession({
        ...newSession,
        [field]: value,
      })
    }
  }

  // UPDATED: Handle lab selection/deselection
  const handleLabToggle = (labId: string) => {
    const currentLabs = newSession.labs
    const isSelected = currentLabs.includes(labId)
    
    let newLabs: string[]
    if (isSelected) {
      // Remove lab if already selected
      newLabs = currentLabs.filter(id => id !== labId)
    } else {
      // Add lab if not selected
      newLabs = [...currentLabs, labId]
    }
    
    handleFormChange("labs", newLabs)
  }

  // UPDATED: Handle session creation for multiple labs
  const handleCreateSession = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      const tv = validateTimeRange(newSession.startTime, newSession.endTime);
      const needsReview = tv.duration > ADMIN_REVIEW_THRESHOLD;

      // Create session data template
      const sessionTemplate = {
        date: newSession.date,
        start_time: newSession.startTime,
        end_time: newSession.endTime,
        purpose: newSession.purposeType === "other"
          ? newSession.customPurpose.trim()
          : newSession.purpose,
        description: newSession.description.trim(),
        status: needsReview ? "under_review" : "confirmed",
        created_by: userSession?.name || "You",
        created_by_email: userSession?.email || "",
        config_windows: newSession.configurations.windows,
        config_internet: newSession.configurations.internet,
        config_homes: newSession.configurations.homes,
        config_user_cleanup: newSession.configurations.userCleanup,
        config_handoutdata: newSession.configurations.handoutdata,
        config_reboot: newSession.configurations.reboot, // NEW FIELD
      };

      // Create sessions for each selected lab
      const sessionsToCreate = newSession.labs.map(labId => ({
        ...sessionTemplate,
        lab: labId,
      }));

      // Create temporary sessions for optimistic UI update
      const tempSessions = sessionsToCreate.map((sessionData, index) => ({
        id: `temp-${Date.now()}-${index}`,
        ...sessionData,
        startTime: sessionData.start_time,
        endTime: sessionData.end_time,
        configurations: {
          windows: sessionData.config_windows,
          internet: sessionData.config_internet,
          homes: sessionData.config_homes,
          userCleanup: sessionData.config_user_cleanup,
          handoutdata: sessionData.config_handoutdata,
          reboot: sessionData.config_reboot,
        },
        createdBy: sessionData.created_by,
        createdByEmail: sessionData.created_by_email,
      }));

      // Optimistically update the UI
      setSessions(prev => [...prev, ...tempSessions]);

      // Insert all sessions at once
      const { data, error } = await supabase
        .from('sessions')
        .insert(sessionsToCreate)
        .select();

      if (error) {
        // Remove the temporary sessions if there's an error
        setSessions(prev => prev.filter(s => !s.id.toString().startsWith('temp-')));
        console.error('Error creating sessions:', error);
        setValidationErrors({ general: "Failed to create sessions. Please try again." });
        return;
      }

      // Replace the temporary sessions with the actual ones from the database
      if (data && data.length > 0) {
        const actualSessions = data.map(session => ({
          id: session.id,
          lab: session.lab,
          date: session.date,
          startTime: session.start_time,
          endTime: session.end_time,
          purpose: session.purpose,
          description: session.description,
          status: session.status,
          configurations: {
            windows: session.config_windows,
            internet: session.config_internet,
            homes: session.config_homes,
            userCleanup: session.config_user_cleanup,
            handoutdata: session.config_handoutdata,
            reboot: session.config_reboot,
          },
          createdBy: session.created_by,
          createdByEmail: session.created_by_email,
        }));

        setSessions(prev => [
          ...prev.filter(s => !s.id.toString().startsWith('temp-')),
          ...actualSessions
        ]);
      }

      setIsAddDialogOpen(false);
      
      const labCount = newSession.labs.length;
      const labText = labCount === 1 ? `lab ${newSession.labs[0]}` : `${labCount} labs`;
      
      showToast(needsReview
        ? `${labCount} session${labCount > 1 ? 's' : ''} scheduled in ${labText}! Admin approval required (${Math.round(tv.duration/60)}h).`
        : `${labCount} session${labCount > 1 ? 's' : ''} scheduled successfully in ${labText}!`,
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
        configurations: { 
          windows: false, 
          internet: false, 
          homes: false, 
          userCleanup: false,
          handoutdata: false,
          reboot: false, // NEW FIELD
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

  // UPDATED: Handle session deletion instead of cancellation
  const handleCancelSession = async (sessionId: string) => {
    const s = sessions.find(x => x.id === sessionId);
    if (!s) return;

    const ok = window.confirm(
      `Are you sure you want to delete "${s.purpose}" on ${formatDate(s.date)} at ${formatTime(s.startTime)}? This action cannot be undone.`
    );
    if (!ok) return;

    try {
      // Optimistically remove from UI
      setSessions(prev => prev.filter(session => session.id !== sessionId));

      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        // Revert the optimistic update if there's an error
        setSessions(prev => [...prev, s]);
        console.error('Error deleting session:', error);
        showToast("Failed to delete session.", "error");
        return;
      }

      showToast("Session deleted successfully.", "success");
    } catch (e) {
      // Revert the optimistic update if there's an error
      setSessions(prev => [...prev, s]);
      console.error('Error deleting session:', e);
      showToast("Failed to delete session.", "error");
    }
  };

  // Check-in function
  const handleCheckIn = async (sessionId: string) => {
    if (!userSession) return;

    try {
      // First, check if session is already checked in
      const { data: currentSession, error: fetchError } = await supabase
        .from('sessions')
        .select('checked_in_by, checked_in_by_email, checked_in_at')
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

      // If user has already checked in, show confirmation
      if (currentSession.checked_in_by === userSession.name) {
        const confirmReCheckIn = window.confirm(
          `You have already checked into this session at ${new Date(currentSession.checked_in_at).toLocaleTimeString()}. Do you want to proceed to the lab control page?`
        );
        
        if (confirmReCheckIn) {
          router.push(`/labs/${sessions.find(s => s.id === sessionId)?.lab}?session=${sessionId}`);
        }
        return;
      }

      // Perform the check-in
      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          checked_in_by: userSession.name,
          checked_in_by_email: userSession.email,
          checked_in_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .is('checked_in_by', null); // Only update if no one has checked in yet

      if (updateError) {
        console.error('Check-in failed:', updateError);
        showToast("Failed to check in. Please try again.", "error");
        return;
      }

      // Check if the update actually happened (race condition protection)
      const { data: verifySession, error: verifyError } = await supabase
        .from('sessions')
        .select('checked_in_by, checked_in_by_email')
        .eq('id', sessionId)
        .single();

      if (verifyError) {
        showToast("Check-in verification failed.", "error");
        return;
      }

      // If someone else checked in during our attempt
      if (verifySession.checked_in_by !== userSession.name) {
        showToast(
          `Session was checked in by ${verifySession.checked_in_by} just before you. Please coordinate with them.`, 
          "error"
        );
        return;
      }

      // Success - navigate to lab control
      showToast("Successfully checked into session!", "success");
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        router.push(`/labs/${session.lab}?session=${sessionId}`);
      }

    } catch (error) {
      console.error('Check-in error:', error);
      showToast("Check-in failed. Please try again.", "error");
    }
  };

  // Get session check-in status
  const getSessionCheckInStatus = (session: any) => {
    if (session.checkedInBy) {
      const checkedInTime = new Date(session.checkedInAt).toLocaleTimeString();
      const isCurrentUser = session.checkedInBy === userSession?.name;
      
      return {
        isCheckedIn: true,
        checkedInBy: session.checkedInBy,
        checkedInTime,
        isCurrentUser,
        canAccess: isCurrentUser // Only the person who checked in can access
      };
    }
    
    return {
      isCheckedIn: false,
      canAccess: true // Anyone can check in if no one has yet
    };
  };

  // Updated button logic in your session card
  const renderSessionButtons = (session: any) => {
    const checkInAvailable = canCheckIn(session.date, session.startTime, session.endTime) && session.status === "confirmed";
    const isUnderReview = session.status === "under_review";
    const checkInStatus = getSessionCheckInStatus(session);
    
    if (!canCheckInToSessions()) {
      return null; // User doesn't have permission to check in
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
        // User has already checked in - allow access to lab controls
        return (
          <Button 
            className="flex-1 bg-green-600 hover:bg-green-700" 
            onClick={() => router.push(`/labs/${session.lab}?session=${session.id}`)}
          >
            Enter Lab Controls
          </Button>
        );
      } else {
        // Someone else has checked in
        return (
          <div className="flex-1">
            <Button disabled className="w-full">
              Checked In by {checkInStatus.checkedInBy}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-1">
              at {checkInStatus.checkedInTime}
            </p>
          </div>
        );
      }
    }

    // No one has checked in yet - show check in button
    return (
      <Button 
        className="flex-1" 
        onClick={() => handleCheckIn(session.id)}
      >
        Check In
      </Button>
    );
  };

  // Navigate back to dashboard
  const handleBackToDashboard = () => {
    router.push("/dashboard")
  }

  // Format time for display
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":")
    const hour = Number.parseInt(hours)
    return `${hour % 12 || 12}${minutes !== "00" ? ":" + minutes : ""} ${hour >= 12 ? "PM" : "AM"}`
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  // Show loading state while checking session
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
              <ArrowLeft className="h-5 w-5" />
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
                    
                    {/* UPDATED: Multi-lab selection */}
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

                  {/* Duration and admin review warning */}
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

                  {/* Description field */}
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
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="reboot"
                          checked={newSession.configurations.reboot}
                          onChange={(e) => handleFormChange("configurations.reboot", e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="reboot" className="text-sm">Reboot</Label>
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
                {/* Updated session card rendering with check-in functionality */}
                {filteredSessions
                  .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime))
                  .map((session) => {
                    const checkInAvailable = canCheckIn(session.date, session.startTime, session.endTime) && session.status === "confirmed"
                    const checkInStatus = getCheckInStatus(session.date, session.startTime, session.endTime)
                    const isUnderReview = session.status === "under_review"
                    const sessionDuration = validateTimeRange(session.startTime, session.endTime).duration
                    const sessionCheckIn = getSessionCheckInStatus(session)
                    
                    return (
                      <Card key={session.id} className={`overflow-hidden border-l-4 ${
                        isUnderReview ? 'border-l-orange-500' : 
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
                                  
                                  {/* Status badges */}
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
                                  {sessionCheckIn.isCheckedIn && (
                                    <Badge className="bg-green-600 text-white">
                                      {sessionCheckIn.isCurrentUser ? 'Checked In (You)' : `Checked In (${sessionCheckIn.checkedInBy})`}
                                    </Badge>
                                  )}
                                </div>
                                
                                <p className="text-sm text-muted-foreground">Created by {session.createdBy}</p>
                                
                                {/* Display description if available */}
                                {session.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{session.description}</p>
                                )}
                                
                                {/* Session duration and admin review info */}
                                <div className="mt-1">
                                  <p className="text-xs text-muted-foreground">
                                    Duration: {Math.round(sessionDuration)} minutes ({(sessionDuration / 60).toFixed(1)} hours)
                                  </p>
                                  {isUnderReview && (
                                    <p className="text-xs text-orange-600 font-medium mt-1">
                                      ⚠️ Admin approval required for sessions over 4 hours
                                    </p>
                                  )}
                                </div>
                                
                                {/* Check-in status indicator */}
                                <div className="flex items-center gap-2 mt-1">
                                  {sessionCheckIn.isCheckedIn ? (
                                    <div className="flex items-center gap-1 text-green-600">
                                      <CheckCircle className="h-4 w-4" />
                                      <span className="text-xs font-medium">
                                        Checked in by {sessionCheckIn.checkedInBy} at {sessionCheckIn.checkedInTime}
                                      </span>
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
                                  {session.configurations.reboot && <Badge variant="outline">Reboot</Badge>}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                {renderSessionButtons(session)}
                                
                                {/* Delete button - only show for session creator */}
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
                              
                              {/* Additional status messages */}
                              {!sessionCheckIn.isCheckedIn && !checkInAvailable && checkInStatus.includes("starts in") && !isUnderReview && (
                                <p className="text-xs text-muted-foreground text-center">
                                  Check-in available when session starts
                                </p>
                              )}
                              {isUnderReview && (
                                <p className="text-xs text-orange-600 text-center">
                                  Awaiting admin approval
                                </p>
                              )}
                              {sessionCheckIn.isCheckedIn && !sessionCheckIn.isCurrentUser && (
                                <p className="text-xs text-muted-foreground text-center">
                                  Contact {sessionCheckIn.checkedInBy} to coordinate access
                                </p>
                              )}
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