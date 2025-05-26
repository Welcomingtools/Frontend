"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, Clock, Plus, AlertCircle } from "lucide-react"
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

// Define preset lecture slots
const LECTURE_SLOTS = [
  { id: 1, startTime: "08:00", endTime: "09:45", label: "Morning Session (08:00 - 09:45)" },
  { id: 2, startTime: "10:15", endTime: "12:00", label: "Mid-Morning Session (10:15 - 12:00)" },
  { id: 3, startTime: "12:30", endTime: "13:15", label: "Lunch Session (12:30 - 13:15)" },
  { id: 4, startTime: "14:15", endTime: "16:00", label: "Afternoon Session (14:15 - 16:00)" },
  { id: 5, startTime: "17:00", endTime: "19:00", label: "Evening Session (17:00 - 19:00)" },
]

// Mock data for scheduled sessions
const initialSessions = [
  {
    id: 1,
    lab: "004",
    date: "2023-05-07",
    startTime: "08:00",
    endTime: "09:45",
    slotId: 1,
    purpose: "CS1 Programming Tutorial",
    configurations: {
      windows: true,
      internet: true,
      homes: true,
      userCleanup: true,
    },
    createdBy: "John Doe",
  },
  {
    id: 2,
    lab: "002",
    date: "2023-05-07",
    startTime: "10:15",
    endTime: "12:00",
    slotId: 2,
    purpose: "MATH2 Exam",
    configurations: {
      windows: false,
      internet: false,
      homes: true,
      userCleanup: true,
    },
    createdBy: "Jane Smith",
  },
  {
    id: 3,
    lab: "001",
    date: "2023-05-07",
    startTime: "14:15",
    endTime: "16:00",
    slotId: 4,
    purpose: "STATS1 R Workshop",
    configurations: {
      windows: false,
      internet: true,
      homes: true,
      userCleanup: true,
    },
    createdBy: "Mike Johnson",
  },
  {
    id: 4,
    lab: "003",
    date: "2023-05-08",
    startTime: "08:00",
    endTime: "09:45",
    slotId: 1,
    purpose: "CS2 Programming Assignment",
    configurations: {
      windows: true,
      internet: true,
      homes: true,
      userCleanup: true,
    },
    createdBy: "Sarah Williams",
  },
]

// Mock data for labs
const labsData = [
  { id: "001", name: "Lab 001", capacity: 72 },
  { id: "002", name: "Lab 002", capacity: 72 },
  { id: "003", name: "Lab 003", capacity: 72 },
  { id: "004", name: "Lab 004", capacity: 72 },
  { id: "005", name: "Lab 005", capacity: 72 },
  { id: "006", name: "Lab 006", capacity: 72 },
  { id: "007", name: "Lab 007", capacity: 72 },
]

// Form validation types
interface ValidationErrors {
  lab?: string
  date?: string
  slotId?: string
  purpose?: string
  general?: string
}

export default function SchedulePage() {
  const [sessions, setSessions] = useState(initialSessions)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [selectedView, setSelectedView] = useState("day")
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  // New session form state
  const [newSession, setNewSession] = useState({
    lab: "",
    date: selectedDate,
    slotId: 0,
    startTime: "",
    endTime: "",
    purpose: "",
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

  // Filter sessions based on selected date
  const filteredSessions = sessions.filter((session) => {
    if (selectedView === "day") {
      return session.date === selectedDate
    } else if (selectedView === "week") {
      // Simple week filter - just show all sessions for demo
      return true
    }
    return true
  })

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

    if (!newSession.slotId || newSession.slotId === 0) {
      errors.slotId = "Please select a time slot"
    }

    if (!newSession.purpose.trim()) {
      errors.purpose = "Please provide a purpose for the session"
    } else if (newSession.purpose.trim().length < 5) {
      errors.purpose = "Purpose must be at least 5 characters long"
    } else if (newSession.purpose.trim().length > 200) {
      errors.purpose = "Purpose must be less than 200 characters"
    }

    // Check if time slot is available
    if (newSession.lab && newSession.date && newSession.slotId) {
      if (!isTimeSlotAvailable(newSession.lab, newSession.date, newSession.slotId)) {
        errors.general = "This time slot is already booked for the selected lab"
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Check if a time slot is available for a specific lab
  const isTimeSlotAvailable = (lab: string, date: string, slotId: number) => {
    return !sessions.some((session) => session.lab === lab && session.date === date && session.slotId === slotId)
  }

  // Get available labs for a specific time slot
  const getAvailableLabs = (date: string, slotId: number) => {
    if (!slotId) return labsData
    return labsData.filter((lab) => isTimeSlotAvailable(lab.id, date, slotId))
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
    } else if (field === "slotId") {
      const slotId = Number(value)
      const slot = LECTURE_SLOTS.find((s) => s.id === slotId)
      if (slot) {
        setNewSession({
          ...newSession,
          slotId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          // Reset lab selection when time slot changes to show available labs
          lab: "",
        })
      }
    } else {
      setNewSession({
        ...newSession,
        [field]: value,
      })
    }
  }

  // Handle session creation
  const handleCreateSession = async () => {
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      const slot = LECTURE_SLOTS.find((s) => s.id === newSession.slotId)
      if (!slot) {
        setValidationErrors({ general: "Invalid time slot selected" })
        return
      }

      const newSessionObj = {
        id: sessions.length + 1,
        ...newSession,
        purpose: newSession.purpose.trim(),
        startTime: slot.startTime,
        endTime: slot.endTime,
        createdBy: "You",
      }

      setSessions([...sessions, newSessionObj])
      setIsAddDialogOpen(false)
      
      // Reset form
      setNewSession({
        lab: "",
        date: selectedDate,
        slotId: 0,
        startTime: "",
        endTime: "",
        purpose: "",
        configurations: {
          windows: false,
          internet: true,
          homes: true,
          userCleanup: true,
        },
      })
      setValidationErrors({})
      
      // Optional: Show success message
      // You could add a toast notification here
      
    } catch (error) {
      setValidationErrors({ general: "Failed to create session. Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Navigate back to dashboard
  const handleBackToDashboard = () => {
    router.push("/dashboard") // Change this to your actual dashboard route
  }

  // Navigate to session detail
  const navigateToSession = (sessionId: number) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (session) {
      router.push(`/labs/${session.lab}`)
    }
  }

  // Format time for display
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":")
    const hour = Number.parseInt(hours)
    return `${hour % 12 || 12}${minutes !== "00" ? ":" + minutes : ""} ${hour >= 12 ? "PM" : "AM"}`
  }

  // Get slot label by start and end time
  const getSlotLabel = (startTime: string, endTime: string) => {
    const slot = LECTURE_SLOTS.find((s) => s.startTime === startTime && s.endTime === endTime)
    return slot ? slot.label : `${formatTime(startTime)} - ${formatTime(endTime)}`
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

  return (
    <div className="min-h-screen flex flex-col">
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
            <h1 className="text-xl font-bold">Schedule Sessions</h1>
          </div>
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
                    <Label htmlFor="timeSlot" className="text-sm font-medium">
                      Time Slot <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={newSession.slotId ? newSession.slotId.toString() : ""}
                      onValueChange={(value) => handleFormChange("slotId", Number(value))}
                    >
                      <SelectTrigger className={validationErrors.slotId ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select time slot" />
                      </SelectTrigger>
                      <SelectContent>
                        {LECTURE_SLOTS.map((slot) => (
                          <SelectItem key={slot.id} value={slot.id.toString()}>
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.slotId && (
                      <p className="text-sm text-red-500">{validationErrors.slotId}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="lab" className="text-sm font-medium">
                    Lab <span className="text-red-500">*</span>
                  </Label>
                  <Select 
                    value={newSession.lab} 
                    onValueChange={(value) => handleFormChange("lab", value)}
                    disabled={!newSession.slotId}
                  >
                    <SelectTrigger className={validationErrors.lab ? "border-red-500" : ""}>
                      <SelectValue placeholder={newSession.slotId ? "Select lab" : "Select time slot first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableLabs(newSession.date, newSession.slotId).map((lab) => (
                        <SelectItem key={lab.id} value={lab.id}>
                          Lab {lab.id} ({lab.capacity} seats)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {validationErrors.lab && (
                    <p className="text-sm text-red-500">{validationErrors.lab}</p>
                  )}
                  {newSession.slotId && getAvailableLabs(newSession.date, newSession.slotId).length === 0 && (
                    <p className="text-sm text-orange-600">No labs available for this time slot</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="purpose" className="text-sm font-medium">
                    Purpose <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="purpose"
                    placeholder="Describe the purpose of this session"
                    value={newSession.purpose}
                    onChange={(e) => handleFormChange("purpose", e.target.value)}
                    maxLength={200}
                    className={validationErrors.purpose ? "border-red-500" : ""}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{validationErrors.purpose && <span className="text-red-500">{validationErrors.purpose}</span>}</span>
                    <span>{newSession.purpose.length}/200</span>
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

            {filteredSessions.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-muted/50">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <h3 className="text-lg font-medium">No Sessions Scheduled</h3>
                <p className="text-sm text-muted-foreground mb-4">There are no sessions scheduled for this date.</p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule New Session
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Display time slots with their sessions */}
                {LECTURE_SLOTS.map((slot) => {
                  const slotSessions = filteredSessions.filter(
                    (session) => session.startTime === slot.startTime && session.endTime === slot.endTime,
                  )

                  if (slotSessions.length === 0 && selectedView === "day") {
                    return (
                      <Card key={slot.id} className="overflow-hidden border-l-4 border-l-gray-300">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="bg-muted p-2 rounded-lg flex flex-col items-center justify-center min-w-[60px]">
                                <Clock className="h-5 w-5 text-muted-foreground mb-1" />
                                <span className="text-xs font-medium">
                                  {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                </span>
                              </div>
                              <p className="text-muted-foreground">Available for booking</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setNewSession({
                                  ...newSession,
                                  date: selectedDate,
                                  slotId: slot.id,
                                  startTime: slot.startTime,
                                  endTime: slot.endTime,
                                })
                                setIsAddDialogOpen(true)
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" /> Book
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  }

                  return slotSessions.map((session) => (
                    <Card key={session.id} className="overflow-hidden border-l-4 border-l-[#0f4d92]">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="bg-muted p-2 rounded-lg flex flex-col items-center justify-center min-w-[60px]">
                              <Clock className="h-5 w-5 text-muted-foreground mb-1" />
                              <span className="text-xs font-medium">
                                {formatTime(session.startTime)} - {formatTime(session.endTime)}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{session.purpose}</h3>
                                <Badge>Lab {session.lab}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">Created by {session.createdBy}</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {session.configurations.windows && <Badge variant="outline">Windows</Badge>}
                                {session.configurations.internet && <Badge variant="outline">Internet</Badge>}
                                {session.configurations.homes && <Badge variant="outline">Home Dirs</Badge>}
                                {session.configurations.userCleanup && <Badge variant="outline">User Cleanup</Badge>}
                              </div>
                            </div>
                          </div>
                          <Button className="self-start md:self-center" onClick={() => navigateToSession(session.id)}>
                            Manage Lab
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}