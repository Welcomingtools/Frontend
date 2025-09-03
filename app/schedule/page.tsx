"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
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

/* ---------------------------------- Config --------------------------------- */

const PURPOSE_OPTIONS = [
  { value: "exam", label: "Exam" },
  { value: "lab", label: "Lab" },
  { value: "lecture", label: "Lecture" },
  { value: "tutorial", label: "Tutorial" },
  { value: "test", label: "Test" },
  { value: "other", label: "Other" },
]

// NOTE: Your DB has lab_id (uuid). If you don’t have a Labs table/uuids yet,
// you can either leave lab_id as null or replace these with real uuids later.
const labsData = [
  { id: "004", name: "Lab 004" },
  { id: "005", name: "Lab 005" },
  { id: "006", name: "Lab 006" },
  { id: "108", name: "Lab 108" },
  { id: "109", name: "Lab 109" },
  { id: "110", name: "Lab 110" },
  { id: "111", name: "Lab 111" },
]

const MIN_SESSION_DURATION = 30 // minutes
const MAX_SESSION_DURATION = 300 // minutes

/* --------------------------------- Helpers --------------------------------- */

type ValidationErrors = {
  lab?: string
  date?: string
  startTime?: string
  endTime?: string
  purpose?: string
  general?: string
}

type UserSession = {
  email: string
  name: string
  role: string
  loginTime: string
  accountType: string
}

const parseTime = (timeString: string) => {
  const [h, m] = timeString.split(":").map(Number)
  return h * 60 + m
}

const validateTimeRange = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) {
    return { isValid: false, duration: 0, tooShort: false, tooLong: false, endBeforeStart: false }
  }
  const start = parseTime(startTime)
  const end = parseTime(endTime)
  const duration = end - start
  return {
    isValid: duration >= MIN_SESSION_DURATION && duration <= MAX_SESSION_DURATION,
    duration,
    tooShort: duration < MIN_SESSION_DURATION,
    tooLong: duration > MAX_SESSION_DURATION,
    endBeforeStart: end <= start,
  }
}

const hasTimeConflict = (
  sessions: Array<{ date: string; labCode: string; startTime: string; endTime: string; id: string }>,
  candidate: { date: string; labCode: string; startTime: string; endTime: string },
  excludeId?: string
) => {
  return sessions.some((s) => {
    if (excludeId && String(s.id) === String(excludeId)) return false
    if (s.date !== candidate.date || s.labCode !== candidate.labCode) return false
    const es = parseTime(s.startTime)
    const ee = parseTime(s.endTime)
    const ns = parseTime(candidate.startTime)
    const ne = parseTime(candidate.endTime)
    return ns < ee && ne > es
  })
}

const getSessionDateTime = (date: string, time: string) => {
  const [h, m] = time.split(":").map(Number)
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return d
}

const canCheckIn = (date: string, startTime: string, endTime: string) => {
  const now = new Date()
  const end = getSessionDateTime(date, endTime)
  return now <= end
}

const getCheckInStatus = (date: string, startTime: string, endTime: string) => {
  const now = new Date()
  const start = getSessionDateTime(date, startTime)
  const end = getSessionDateTime(date, endTime)
  if (now < start) {
    const diff = start.getTime() - now.getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return h > 0 ? `Session starts in ${h}h ${m}m` : `Session starts in ${m}m`
  }
  if (now > end) return "Session ended"
  return "Check-in available"
}

const hasTimePassed = (date: string, time: string) => getSessionDateTime(date, time) < new Date()

const formatTime = (time: string) => {
  const [hh, mm] = time.split(":")
  const h = Number(hh)
  return `${h % 12 || 12}${mm !== "00" ? ":" + mm : ""} ${h >= 12 ? "PM" : "AM"}`
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

/* ---------------------------------- Page ----------------------------------- */

export default function SchedulePage() {
  const router = useRouter()

  const [userSession, setUserSession] = useState<UserSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [selectedView, setSelectedView] = useState<"day" | "week">("day")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})

  // Sessions held in UI-friendly shape
  const [sessions, setSessions] = useState<
    Array<{ id: string; date: string; startTime: string; endTime: string; purpose: string; labCode: string }>
  >([])

  // New session form (labCode is a UI code like "004"; DB has lab_id (uuid) which we’re not using yet)
  const [newSession, setNewSession] = useState({
    labCode: "",
    date: selectedDate,
    startTime: "",
    endTime: "",
    purposeType: "",
    purpose: "",
    customPurpose: "",
  })

  /* ------------------------------ Effects --------------------------------- */

  // Load session-gate
  useEffect(() => {
    const raw = sessionStorage.getItem("userSession")
    if (!raw) {
      router.push("/login")
      return
    }
    setUserSession(JSON.parse(raw))
  }, [router])

  // Toast auto dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 8000)
    return () => clearTimeout(t)
  }, [toast])

  // Keep form date in sync
  useEffect(() => {
    setNewSession((prev) => ({ ...prev, date: selectedDate }))
  }, [selectedDate])

  // Fetch + realtime (table: session)
  useEffect(() => {
    let cancelled = false
    const toStr = (d: Date) => d.toISOString().split("T")[0]

    const fetchSessions = async () => {
      setIsLoading(true)
      try {
        let q = supabase.from("session").select("*")

        if (selectedView === "day") {
          q = q.eq("date", selectedDate).order("start_time", { ascending: true })
        } else {
          const d = new Date(selectedDate)
          const day = d.getDay()
          const start = new Date(d); start.setDate(d.getDate() - day)
          const end = new Date(d); end.setDate(d.getDate() + (6 - day))
          q = q
            .gte("date", toStr(start))
            .lte("date", toStr(end))
            .order("date", { ascending: true })
            .order("start_time", { ascending: true })
        }

        const { data, error } = await q
        if (error) throw error

        const mapped =
          (data ?? []).map((r: any) => ({
            id: r.id,
            date: r.date, // "YYYY-MM-DD"
            startTime: String(r.start_time).slice(0, 5), // "HH:MM"
            endTime: String(r.end_time).slice(0, 5), // "HH:MM"
            purpose: r.purpose_type as string,
            // We don’t have lab codes in DB yet; show placeholder if missing
            labCode: "", // keep empty (or map from r.lab_id when you have a labs table)
          })) || []

        if (!cancelled) setSessions(mapped)
      } catch (err: any) {
        console.error("Supabase fetch error:", err?.message ?? err)
        if (!cancelled) setToast({ message: "Failed to load sessions.", type: "error" })
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchSessions()

    const ch = supabase
      .channel("session-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "session" }, fetchSessions)
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(ch)
    }
  }, [selectedDate, selectedView])

  /* ---------------------------- Permissions ------------------------------- */

  const canSchedule = () => userSession?.role === "Admin"
  const canCheckInRole = () => userSession?.role === "BCDR" || userSession?.role === "Welcoming Team"

  /* --------------------------- Form Utilities ----------------------------- */

  const handleFormChange = (field: keyof typeof newSession, value: string) => {
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }))
    }
    if (field === "purposeType") {
      const opt = PURPOSE_OPTIONS.find((o) => o.value === value)
      setNewSession((prev) => ({
        ...prev,
        purposeType: value,
        purpose: value === "other" ? "" : opt?.label ?? "",
        customPurpose: value === "other" ? prev.customPurpose : "",
      }))
    } else if (field === "customPurpose") {
      setNewSession((prev) => ({ ...prev, customPurpose: value, purpose: value }))
    } else {
      setNewSession((prev) => ({ ...prev, [field]: value }))
    }
  }

  const resetForm = () => {
    setNewSession({
      labCode: "",
      date: selectedDate,
      startTime: "",
      endTime: "",
      purposeType: "",
      purpose: "",
      customPurpose: "",
    })
    setValidationErrors({})
  }

  const validateForm = () => {
    const err: ValidationErrors = {}

    if (!newSession.labCode) err.lab = "Please select a lab"
    if (!newSession.date) {
      err.date = "Please select a date"
    } else {
      const d = new Date(newSession.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (d < today) err.date = "Cannot schedule sessions for past dates"
    }
    if (!newSession.startTime) err.startTime = "Please select a start time"
    else if (newSession.date === new Date().toISOString().split("T")[0] && hasTimePassed(newSession.date, newSession.startTime)) {
      err.startTime = "Start time has already passed"
    }
    if (!newSession.endTime) err.endTime = "Please select an end time"

    if (newSession.startTime && newSession.endTime) {
      const v = validateTimeRange(newSession.startTime, newSession.endTime)
      if (v.endBeforeStart) err.endTime = "End time must be after start time"
      else if (v.tooShort) err.endTime = `Session must be at least ${MIN_SESSION_DURATION} minutes`
      else if (v.tooLong) err.endTime = `Session must be less than ${MAX_SESSION_DURATION} minutes`
    }

    if (!newSession.purposeType) err.purpose = "Please select a purpose type"
    else if (newSession.purposeType === "other") {
      const t = newSession.customPurpose.trim()
      if (!t) err.purpose = "Please provide a custom purpose"
      else if (t.length < 5) err.purpose = "Purpose must be at least 5 characters"
      else if (t.length > 200) err.purpose = "Purpose must be less than 200 characters"
    }

    if (
      newSession.labCode &&
      newSession.date &&
      newSession.startTime &&
      newSession.endTime &&
      hasTimeConflict(sessions, {
        labCode: newSession.labCode,
        date: newSession.date,
        startTime: newSession.startTime,
        endTime: newSession.endTime,
      })
    ) {
      err.general = "This time slot conflicts with an existing session in the selected lab"
    }

    setValidationErrors(err)
    return Object.keys(err).length === 0
  }

  /* ------------------------------ Actions -------------------------------- */

  const handleCreateSession = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newSession.date,
          start_time: newSession.startTime, // "HH:MM"
          end_time: newSession.endTime,     // "HH:MM"
          purpose_type:
            newSession.purposeType === "other"
              ? newSession.customPurpose.trim()
              : newSession.purpose,
          lab_id: null, // replace with real UUID when labs table is ready
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("API insert error:", json.error);
        setValidationErrors({ general: json.error || "Failed to create session." });
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      setIsAddDialogOpen(false);
      setToast({ message: "Session scheduled successfully!", type: "success" });
      resetForm();
    } catch (err: any) {
      console.error(err);
      setValidationErrors({ general: "Failed to create session." });
      setIsSubmitting(false);
    }
  };


  const handleCancelSession = async (id: string) => {
    const s = sessions.find((x) => String(x.id) === String(id))
    if (!s) return
    const ok = window.confirm(`Cancel "${s.purpose}" on ${formatDate(s.date)} at ${formatTime(s.startTime)}?`)
    if (!ok) return
    const { error } = await supabase.from("session").delete().eq("id", id)
    if (error) {
      console.error("Supabase delete error:", error.message)
      setToast({ message: "Failed to cancel session.", type: "error" })
      return
    }
    setToast({ message: "Session cancelled.", type: "success" })
  }

  const navigateToSession = (id: string) => {
    const s = sessions.find((x) => String(x.id) === String(id))
    if (!s) return
    if (canCheckIn(s.date, s.startTime, s.endTime)) {
      // Route to your lab page; replace with your actual route
      router.push(`/labs/${s.labCode || "unknown"}`)
    }
  }

  /* -------------------------------- Render -------------------------------- */

  if (!userSession) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f4d92] mx-auto mb-4" />
          <p>Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[9999] max-w-md rounded-lg shadow-lg p-4 ${
            toast.type === "success"
              ? "bg-green-100 border border-green-400 text-green-700"
              : toast.type === "warning"
              ? "bg-yellow-100 border border-yellow-400 text-yellow-700"
              : "bg-red-100 border border-red-400 text-red-700"
          }`}
        >
          <div className="flex items-start gap-3">
            {toast.type === "success" ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <p className="text-sm font-medium">{toast.message}</p>
            <button onClick={() => setToast(null)} className="ml-auto">×</button>
          </div>
        </div>
      )}

      <header className="bg-[#0f4d92] text-white p-4 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="text-white">
              <Link href="/dashboard"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">Schedule Sessions</h1>
              <p className="text-xs opacity-75">
                {userSession.name} ({userSession.role}) — {canSchedule() ? "Can schedule" : "Can check in"}
              </p>
            </div>
          </div>

          {canSchedule() && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-white text-[#0f4d92] hover:bg-gray-100">
                  <Plus className="h-4 w-4 mr-2" /> New Session
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Schedule New Session</DialogTitle>
                  <DialogDescription>Create a new lab session.</DialogDescription>
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
                      <Label htmlFor="date">Date <span className="text-red-500">*</span></Label>
                      <Input
                        id="date"
                        type="date"
                        value={newSession.date}
                        onChange={(e) => handleFormChange("date", e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className={validationErrors.date ? "border-red-500" : ""}
                      />
                      {validationErrors.date && <p className="text-sm text-red-500">{validationErrors.date}</p>}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="lab">Lab <span className="text-red-500">*</span></Label>
                      <Select value={newSession.labCode} onValueChange={(v) => handleFormChange("labCode", v)}>
                        <SelectTrigger className={validationErrors.lab ? "border-red-500" : ""}>
                          <SelectValue placeholder="Select lab" />
                        </SelectTrigger>
                        <SelectContent>
                          {labsData.map((lab) => (
                            <SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.lab && <p className="text-sm text-red-500">{validationErrors.lab}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="startTime">Start Time <span className="text-red-500">*</span></Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={newSession.startTime}
                        onChange={(e) => handleFormChange("startTime", e.target.value)}
                        className={validationErrors.startTime ? "border-red-500" : ""}
                      />
                      {validationErrors.startTime && <p className="text-sm text-red-500">{validationErrors.startTime}</p>}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="endTime">End Time <span className="text-red-500">*</span></Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={newSession.endTime}
                        onChange={(e) => handleFormChange("endTime", e.target.value)}
                        className={validationErrors.endTime ? "border-red-500" : ""}
                      />
                      {validationErrors.endTime && <p className="text-sm text-red-500">{validationErrors.endTime}</p>}
                    </div>
                  </div>

                  {newSession.startTime && newSession.endTime && (() => {
                    const v = validateTimeRange(newSession.startTime, newSession.endTime)
                    const dur = v.duration
                    const h = (dur / 60).toFixed(1)
                    return v.isValid ? (
                      <p className="text-sm text-muted-foreground">Duration: {dur} minutes ({h} hours)</p>
                    ) : null
                  })()}

                  <div className="grid gap-2">
                    <Label htmlFor="purposeType">Purpose Type <span className="text-red-500">*</span></Label>
                    <Select value={newSession.purposeType} onValueChange={(v) => handleFormChange("purposeType", v)}>
                      <SelectTrigger className={validationErrors.purpose ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select purpose type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PURPOSE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {validationErrors.purpose && <p className="text-sm text-red-500">{validationErrors.purpose}</p>}
                  </div>

                  {newSession.purposeType === "other" && (
                    <div className="grid gap-2">
                      <Label htmlFor="customPurpose">Custom Purpose <span className="text-red-500">*</span></Label>
                      <Textarea
                        id="customPurpose"
                        value={newSession.customPurpose}
                        onChange={(e) => handleFormChange("customPurpose", e.target.value)}
                        maxLength={200}
                        placeholder="Describe the purpose"
                        className={validationErrors.purpose ? "border-red-500" : ""}
                      />
                      <div className="text-right text-xs text-muted-foreground">
                        {newSession.customPurpose.length}/200
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setValidationErrors({}) }}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateSession} disabled={isSubmitting}>
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
              <CardTitle>Lab Schedule — {formatDate(selectedDate)}</CardTitle>
              <Tabs value={selectedView} onValueChange={(v) => setSelectedView(v as "day" | "week")} className="w-[200px]">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="day">Day</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date(selectedDate)
                  d.setDate(d.getDate() - 1)
                  setSelectedDate(d.toISOString().split("T")[0])
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
                  const d = new Date(selectedDate)
                  d.setDate(d.getDate() + 1)
                  setSelectedDate(d.toISOString().split("T")[0])
                }}
              >
                Next
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f4d92] mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading sessions…</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-muted/50">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <h3 className="text-lg font-medium">No Sessions Scheduled</h3>
                <p className="text-sm text-muted-foreground mb-4">There are no sessions scheduled for this date/week.</p>
                {canSchedule() && (
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Schedule New Session
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {sessions
                  .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime))
                  .map((s) => {
                    const checkInAvailable = canCheckIn(s.date, s.startTime, s.endTime)
                    const statusText = getCheckInStatus(s.date, s.startTime, s.endTime)
                    const dur = validateTimeRange(s.startTime, s.endTime).duration

                    return (
                      <Card key={s.id} className="overflow-hidden border-l-4 border-l-[#0f4d92]">
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className="bg-muted p-2 rounded-lg flex flex-col items-center justify-center min-w-[60px]">
                                <Clock className="h-5 w-5 text-muted-foreground mb-1" />
                                <span className="text-xs font-medium">
                                  {formatTime(s.startTime)} - {formatTime(s.endTime)}
                                </span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-medium">{s.purpose}</h3>
                                  <Badge variant="outline">Lab {s.labCode || "—"}</Badge>
                                </div>

                                <div className="mt-1">
                                  <p className="text-xs text-muted-foreground">
                                    Duration: {Math.round(dur)} minutes ({(dur / 60).toFixed(1)} hours)
                                  </p>
                                </div>

                                <div className="flex items-center gap-1 mt-1">
                                  {checkInAvailable ? (
                                    <span className="text-green-700 flex items-center gap-1">
                                      <CheckCircle className="h-4 w-4" />
                                      <span className="text-xs font-medium">{statusText}</span>
                                    </span>
                                  ) : (
                                    <span className="text-orange-600 flex items-center gap-1">
                                      <Clock className="h-4 w-4" />
                                      <span className="text-xs font-medium">{statusText}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {canCheckInRole() && (
                                <Button
                                  onClick={() => navigateToSession(s.id)}
                                  disabled={!checkInAvailable}
                                >
                                  {checkInAvailable ? "Check In" : "Not Available"}
                                </Button>
                              )}
                              {/* “Cancel” = delete (no status column in DB) */}
                              {canSchedule() && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleCancelSession(s.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                  title="Cancel Session"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
