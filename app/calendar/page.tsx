"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// ---- Time slots
// Extend your LECTURE_SLOTS to include a final slot to 00:00
const LECTURE_SLOTS = [
  { "id": 1, "startTime": "08:00", "endTime": "09:00", "label": "08:00 - 09:00" },
{ "id": 2, "startTime": "09:00", "endTime": "10:00", "label": "09:00 - 10:00" },
{ "id": 3, "startTime": "10:00", "endTime": "11:00", "label": "10:00 - 11:00" },
{ "id": 4, "startTime": "11:00", "endTime": "12:00", "label": "11:00 - 12:00" },
{ "id": 5, "startTime": "12:00", "endTime": "13:00", "label": "12:00 - 13:00" },
{ "id": 6, "startTime": "13:00", "endTime": "14:00", "label": "13:00 - 14:00" },
{ "id": 7, "startTime": "14:00", "endTime": "15:00", "label": "14:00 - 15:00" },
{ "id": 8, "startTime": "15:00", "endTime": "16:00", "label": "15:00 - 16:00" },
{ "id": 9, "startTime": "16:00", "endTime": "17:00", "label": "16:00 - 17:00" },
{ "id": 10, "startTime": "17:00", "endTime": "18:00", "label": "17:00 - 18:00" },
{ "id": 11, "startTime": "18:00", "endTime": "19:00", "label": "18:00 - 19:00" },
{ "id": 12, "startTime": "19:00", "endTime": "20:00", "label": "19:00 - 20:00" },
{ "id": 13, "startTime": "20:00", "endTime": "21:00", "label": "20:00 - 21:00" },
{ "id": 14, "startTime": "21:00", "endTime": "22:00", "label": "21:00 - 22:00" },
{ "id": 15, "startTime": "22:00", "endTime": "23:00", "label": "22:00 - 23:00" },
{ "id": 16, "startTime": "23:00", "endTime": "00:00", "label": "23:00 - 00:00" }

]

// ---- Labs (static list for now)
const labsData = [
  { id: "004", name: "Lab 004" },
  { id: "005", name: "Lab 005" },
  { id: "006", name: "Lab 006" },
  { id: "106", name: "Lab 106" },
  { id: "108", name: "Lab 108" },
  { id: "109", name: "Lab 109" },
  { id: "110", name: "Lab 110" },
  { id: "111", name: "Lab 111" },
]

// ---- Helpers
const getMonday = (date: Date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}
const addDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}
const formatISODate = (date: Date) => date.toISOString().split("T")[0]
const formatDateForDisplay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

// ---- Type colors (from purpose keywords)
const TYPE_COLORS: Record<string, string> = {
  exam: "#ef4444",
  tutorial: "#2563eb",
  workshop: "#16a34a",
  class: "#9333ea",
  other: "#0f766e",
}
function inferTypeFromPurpose(purpose?: string): keyof typeof TYPE_COLORS {
  const p = (purpose || "").toLowerCase()
  if (/(exam|test|assessment)/.test(p)) return "exam"
  if (/(tutorial|prac|practical|tut)/.test(p)) return "tutorial"
  if (/(workshop|training)/.test(p)) return "workshop"
  if (/(class|lecture|lab session|session)/.test(p)) return "class"
  return "other"
}

// ---- Types
type DBSess = {
  id: number
  lab: string
  date: string          // YYYY-MM-DD
  start_time: string    // HH:MM:SS
  end_time: string      // HH:MM:SS
  purpose: string | null
  status: string | null
  created_by: string | null
  created_by_email: string | null
}

export default function CalendarPage() {
  const router = useRouter()
  const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()))
  const weekDates = useMemo(
    () => Array.from({ length: 5 }, (_, i) => formatISODate(addDays(currentWeekStart, i))),
    [currentWeekStart]
  )

  // NEW: Single lab selection (default first)
  const [selectedLab, setSelectedLab] = useState<string>(labsData[0].id)

  const [sessions, setSessions] = useState<DBSess[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch sessions for selected lab & week
  useEffect(() => {
    (async () => {
      setLoading(true); setError(null)
      try {
        const { data, error } = await supabase
          .from("sessions")
          .select("id, lab, date, start_time, end_time, purpose, status, created_by, created_by_email")
          .eq("lab", selectedLab)                 // <- one lab at a time
          .gte("date", weekDates[0])              // Monday
          .lte("date", weekDates[weekDates.length - 1]) // Friday
          .order("date", { ascending: true })
          .order("start_time", { ascending: true })

        if (error) throw error
        setSessions(data || [])
      } catch (e: any) {
        setError(e.message ?? "Failed to load sessions")
      } finally {
        setLoading(false)
      }
    })()
  }, [selectedLab, weekDates])

  // convert "HH:MM" or "HH:MM:SS" -> minutes since midnight
  const toMinutes = (t: string) => {
    const [hh, mm] = t.split(":")
    return parseInt(hh, 10) * 60 + parseInt(mm, 10)
  }

  // true if [aStart,aEnd) overlaps [bStart,bEnd)
  const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(aStart, bStart) < Math.min(aEnd, bEnd)

  // AFTER (interval overlap)
  const getSessionForDateSlot = (date: string, slotId: number) => {
    const slot = LECTURE_SLOTS.find(s => s.id === slotId)!
    const slotStart = toMinutes(slot.startTime)
    const slotEnd   = toMinutes(slot.endTime)

    return sessions.find(s =>
      s.date === date &&
      overlaps(toMinutes(s.start_time), toMinutes(s.end_time), slotStart, slotEnd)
    )
  }
  // put alongside your state
  const fetchSessions = async () => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, lab, date, start_time, end_time, purpose, status, created_by, created_by_email")
        .eq("lab", selectedLab)
        .gte("date", weekDates[0])
        .lte("date", weekDates[weekDates.length - 1])
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })

      if (error) throw error
      setSessions(data || [])
    } catch (e: any) {
      setError(e.message ?? "Failed to load sessions")
    } finally {
      setLoading(false)
    }
  }

  // refetch when lab/week changes
  useEffect(() => { fetchSessions() }, [selectedLab, weekDates.join("|")])

  // subscribe to INSERT/UPDATE/DELETE so new bookings appear live
  useEffect(() => {
    const channel = supabase
      .channel("realtime:sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => {
        fetchSessions()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedLab, weekDates.join("|")])



  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[#0f4d92] text-white p-4 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            {/* Back now goes to /dashboard */}
            <Button variant="ghost" size="icon" asChild className="text-white">
              <Link href="/dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-xl font-bold">Lab Timetable</h1>
          </div>

          {/* Lab picker (single selection) */}
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-90">Lab:</span>
            <Select value={selectedLab} onValueChange={setSelectedLab}>
              <SelectTrigger className="w-[160px] bg-white text-[#0f4d92]">
                <SelectValue placeholder="Select a lab" />
              </SelectTrigger>
              <SelectContent>
                {labsData.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle>
                Weekly Timetable • {labsData.find(l => l.id === selectedLab)?.name}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {/* Renamed: This week */}
                <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(getMonday(new Date()))}>
                  This week
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDateForDisplay(weekDates[0])} - {formatDateForDisplay(weekDates[4])}
            </div>
            {loading && <div className="text-sm text-muted-foreground mt-1">Loading sessions…</div>}
            {error && <div className="text-sm text-red-600 mt-1">Error: {error}</div>}
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border bg-muted text-left min-w-[120px]">Time Slot</th>
                    {weekDates.map(date => (
                      <th key={date} className="p-2 border bg-muted text-center min-w-[220px]">
                        {formatDateForDisplay(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LECTURE_SLOTS.map(slot => (
                    <tr key={slot.id}>
                      <td className="p-2 border font-medium text-sm">{slot.label}</td>
                      {weekDates.map(date => {
                        const s = getSessionForDateSlot(date, slot.id)
                        if (!s) {
                          return (
                            <td key={`${date}-${slot.id}`} className="p-2 border align-top">
                              <div className="text-xs text-muted-foreground border rounded p-1">
                                Available
                              </div>
                            </td>
                          )
                        }

                        const type = inferTypeFromPurpose(s.purpose || undefined)
                        const bg = TYPE_COLORS[type]
                        return (
                          <td key={`${date}-${slot.id}`} className="p-2 border align-top">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="p-1 rounded text-xs text-white cursor-pointer truncate"
                                    style={{ backgroundColor: bg }}
                                  >
                                    <div className="font-bold">{type.toUpperCase()}</div>
                                    <div className="truncate">{s.purpose ?? "Session"}</div>
                                    <div className="opacity-90">
                                      {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <p className="font-bold">{s.purpose ?? "Session"}</p>
                                    <p>{s.date} {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</p>
                                    {(s.created_by || s.created_by_email) && (
                                      <p className="text-xs">By {s.created_by ?? s.created_by_email}</p>
                                    )}
                                    {s.status && <Badge variant="outline" className="text-xs">{s.status}</Badge>}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Session Type Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                  <span className="capitalize">{type}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  )
}
