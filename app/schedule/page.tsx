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
  lab?: string
  date?: string
  startTime?: string
  endTime?: string
  purpose?: string
  general?: string
}

// Time validation helper functions
const parseTime = (timeString: string) => {
  const [hours, minutes] = timeString.split(':').map(Number)
  return hours * 60 + minutes // Convert to minutes for easy comparison
}

const formatTimeForInput = (time: string) => {
  // Ensure time is in HH:MM format for input fields
  const [hours, minutes] = time.split(':')
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
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

const hasTimeConflict = (sessions: any[], newSession: { lab: string, date: string, startTime: string, endTime: string }, excludeId?: string) => {
  return sessions.some(session => {
    if (excludeId && session.id === excludeId) return false
    if (session.lab !== newSession.lab || session.date !== newSession.date) return false
    
    const existingStart = parseTime(session.start_time)
    const existingEnd = parseTime(session.end_time)
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

// Time validation helper function
const hasTimePassed = (date: string, time: string) => {
  const now = new Date()
  const timeDateTime = getSessionDateTime(date, time)
  return timeDateTime < now
}

// User session type
type UserSession = {
  email: string
  name: string
  role: string
  loginTime: string
  accountType: string
}

export default function SchedulePage() {
  // Constants moved inside component for accessibility
  const ADMIN_REVIEW_THRESHOLD = 240 // 4 hours - sessions longer than this need admin review
  
  const [sessions, setSessions] = useState<any[]>([])
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

  // Load sessions (real-time) for the selected day/week
  useEffect(() => {
    setIsLoading(true);

    const loadSessions = async () => {
      try {
        let query = supabase
          .from('sessions')
          .select('*')
          .neq('status', 'cancelled')
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
          status: session.status,
          configurations: {
            windows: session.config_windows,
            internet: session.config_internet,
            homes: session.config_homes,
            userCleanup: session.config_user_cleanup,
          },
          createdBy: session.created_by,
          createdByEmail: session.created_by_email,
        })) || [];

        setSessions(transformedSessions);
      } catch (err) {
        console.error('Error loading sessions:', err);
        showToast("Failed to load sessions.", "error");
      } finally {
        setIsLoading(false);
      }
    };

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
          loadSessions(); // Reload sessions when changes occur
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, selectedView]);

  // New session form state
  const [newSession, setNewSession] = useState({
    lab: "",
    date: selectedDate,
    startTime: "",
    endTime: "",
    purposeType: "",
    purpose: "",
    customPurpose: "",
    configurations: {
      windows: false,
      internet: true,
      homes: true,
      userCleanup: true,
    },
  })

  // Update newSession date when selectedDate changes
  useEffect(() => {
    setNewSession(prev => ({ ...prev, date: selectedDate }))
  }, [selectedDate])

  // Filter sessions based on selected date (exclude cancelled sessions from main view)
  const filteredSessions = sessions
    .filter((s) => s.status !== "cancelled")
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

  // Validation functions
  const validateForm = (): boolean => {
    const errors: ValidationErrors = {}

    // Required field validation
    if (!newSession.lab.trim()) {
      errors.lab = "Please select a lab"
    }

    if (!newSession.date) {
      errors.date = "Please select a date"
    } else {
      // Date should not be in the past
      const selectedDateObj = new Date(newSession.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (selectedDateObj < today) {
        errors.date = "Cannot schedule sessions for past dates"
      }
    }

    // Start time validation
    if (!newSession.startTime) {
      errors.startTime = "Please select a start time"
    } else {
      // Check if start time has passed (only for today's date)
      const today = new Date().toISOString().split("T")[0]
      if (newSession.date === today && hasTimePassed(newSession.date, newSession.startTime)) {
        errors.startTime = "Start time has already passed. Please choose a future time."
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

    // Check for time conflicts with existing sessions
    if (newSession.lab && newSession.date && newSession.startTime && newSession.endTime) {
      if (hasTimeConflict(sessions, newSession)) {
        errors.general = "This time slot conflicts with an existing session in the selected lab"
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle form changes
  const handleFormChange = (field: string, value: string | boolean | number) => {
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

  // Handle session creation
  const handleCreateSession = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      const tv = validateTimeRange(newSession.startTime, newSession.endTime);
      const needsReview = tv.duration > ADMIN_REVIEW_THRESHOLD;

      const sessionData = {
        lab: newSession.lab,
        date: newSession.date,
        start_time: newSession.startTime,
        end_time: newSession.endTime,
        purpose: newSession.purposeType === "other"
          ? newSession.customPurpose.trim()
          : newSession.purpose,
        status: needsReview ? "under_review" : "confirmed",
        created_by: userSession?.name || "You",
        created_by_email: userSession?.email || "",
        // Individual configuration columns (new structure)
        config_windows: newSession.configurations.windows,
        config_internet: newSession.configurations.internet,
        config_homes: newSession.configurations.homes,
        config_user_cleanup: newSession.configurations.userCleanup,
      };

      const { error } = await supabase
        .from('sessions')
        .insert([sessionData]);

      if (error) {
        console.error('Error creating session:', error);
        setValidationErrors({ general: "Failed to create session. Please try again." });
        return;
      }

      setIsAddDialogOpen(false);
      showToast(needsReview
        ? `Session scheduled! It requires admin approval (${Math.round(tv.duration/60)}h).`
        : "Session scheduled successfully!",
        needsReview ? "warning" : "success"
      );

      // Reset form
      setNewSession({
        lab: "",
        date: selectedDate,
        startTime: "",
        endTime: "",
        purposeType: "",
        purpose: "",
        customPurpose: "",
        configurations: { windows: false, internet: true, homes: true, userCleanup: true },
      });
      setValidationErrors({});
    } catch (e) {
      console.error('Error creating session:', e);
      setValidationErrors({ general: "Failed to create session. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle session cancellation
  const handleCancelSession = async (sessionId: string) => {
    const s = sessions.find(x => x.id === sessionId);
    if (!s) return;

    const ok = window.confirm(
      `Are you sure you want to cancel "${s.purpose}" on ${formatDate(s.date)} at ${formatTime(s.startTime)}?`
    );
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'cancelled' })
        .eq('id', sessionId);

      if (error) {
        console.error('Error cancelling session:', error);
        showToast("Failed to cancel session.", "error");
        return;
      }

      showToast("Session cancelled successfully.", "success");
    } catch (e) {
      console.error('Error cancelling session:', e);
      showToast("Failed to cancel session.", "error");
    }
  };

  // Navigate back to dashboard
  const handleBackToDashboard = () => {
    router.push("/dashboard")
  }

  // Navigate to session detail with check-in validation
  const navigateToSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (session) {
      if (canCheckIn(session.date, session.startTime, session.endTime)) {
        router.push(`/labs/${session.lab}`)
      } else {
        console.log('Check-in not available at this time')
      }
    }
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
                  <DialogDescription>Create a new lab session with specific configurations.</DialogDescription>
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
                    <div className="grid gap-2">
                      <Label htmlFor="lab" className="text-sm font-medium">
                        Lab <span className="text-red-500">*</span>
                      </Label>
                      <Select 
                        value={newSession.lab} 
                        onValueChange={(value) => handleFormChange("lab", value)}
                      >
                        <SelectTrigger className={validationErrors.lab ? "border-red-500" : ""}>
                          <SelectValue placeholder="Select lab" />
                        </SelectTrigger>
                        <SelectContent>
                          {labsData.map((lab) => (
                            <SelectItem key={lab.id} value={lab.id}>
                              Lab {lab.id} ({lab.capacity} seats)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.lab && (
                        <p className="text-sm text-red-500">{validationErrors.lab}</p>
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
                    {isSubmitting ? "Scheduling..." : "Schedule Session"}
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
                {/* Display sessions sorted by start time */}
                {filteredSessions
                  .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime))
                  .map((session) => {
                    const checkInAvailable = canCheckIn(session.date, session.startTime, session.endTime) && session.status === "confirmed"
                    const checkInStatus = getCheckInStatus(session.date, session.startTime, session.endTime)
                    const isUnderReview = session.status === "under_review"
                    const sessionDuration = validateTimeRange(session.startTime, session.endTime).duration
                    
                    return (
                      <Card key={session.id} className={`overflow-hidden border-l-4 ${
                        isUnderReview ? 'border-l-orange-500' : 'border-l-[#0f4d92]'
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
                                  {isUnderReview && (
                                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                                      Under Review
                                    </Badge>
                                  )}
                                  {session.status === "confirmed" && (
                                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                      Confirmed
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">Created by {session.createdBy}</p>
                                
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
                                  {session.status === "confirmed" ? (
                                    checkInAvailable ? (
                                      <div className="flex items-center gap-1 text-green-600">
                                        <CheckCircle className="h-4 w-4" />
                                        <span className="text-xs font-medium">{checkInStatus}</span>
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
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                {canCheckInToSessions() && (
                                  <Button 
                                    className="flex-1" 
                                    onClick={() => navigateToSession(session.id)}
                                    disabled={!checkInAvailable || isUnderReview}
                                  >
                                    {isUnderReview ? "Under Review" : 
                                     checkInAvailable ? "Check In" : "Not Available"}
                                  </Button>
                                )}
                                {session.createdBy === userSession?.name && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleCancelSession(session.id)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                    title="Cancel Session"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              {!checkInAvailable && checkInStatus.includes("starts in") && !isUnderReview && (
                                <p className="text-xs text-muted-foreground text-center">
                                  Check-in available when session starts
                                </p>
                              )}
                              {isUnderReview && (
                                <p className="text-xs text-orange-600 text-center">
                                  Awaiting admin approval
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