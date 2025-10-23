"use client"

import { useEffect, useMemo, useState, type ReactNode, useRef} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  Users,
  Activity,
  AlertTriangle,
  Download,
  LogOut,
  ArrowUp,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { format, parseISO, isValid, startOfDay, endOfDay, subMonths } from "date-fns"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

type UserSession = {
  email: string
  name: string
  role: string
  loginTime: string
  accountType: string
}

// sessions table
export type DbSession = {
  id: number
  lab: string | null
  date: string | null // date (YYYY-MM-DD)
  start_time: string | null // time (HH:MM or HH:MM:SS)
  end_time: string | null // time (HH:MM or HH:MM:SS)
  purpose: string | null
  status: string | null
  created_by: string | null
  created_by_email: string | null
  created_at: string | null
  description: string | null
}

// maintenance_issues table → Incident Report
export type DbIncident = {
  id: string
  category: string | null
  created_at: string | null
  description: string | null
  lab: string | null
  machine_id: string | null
  reported_by: string | null
  severity: string | null
  status: string | null
  title: string | null
  updated_at: string | null
  resolved_by: string | null
}

// user_reports table → Staff Behaviour
export type DbBehaviour = {
  id: string
  reported_user_id: string | null
  reported_user_name: string | null
  reported_user_email: string | null
  reported_user_role: string | null
  reporter_email: string | null
  reporter_name: string | null
  reporter_role: string | null
  reason: string | null
  details: string | null
  status: string | null
  created_at: string | null
  updated_at: string | null
}

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

const PALETTE = [
  "#2563eb", // blue-600
  "#16a34a", // green-600
  "#f59e0b", // amber-500
  "#dc2626", // red-600
  "#7c3aed", // violet-600
  "#0ea5e9", // sky-500
  "#d946ef", // fuchsia-500
  "#22c55e", // green-500
]

function toMinutes(hhmm?: string | null) {
  if (!hhmm) return null
  const parts = hhmm.split(":").map(Number)
  const h = parts[0]
  const m = parts[1] ?? 0
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function durationLabel(start?: string | null, end?: string | null) {
  const s = toMinutes(start)
  const e = toMinutes(end)
  if (s == null || e == null || e < s) return "—"
  const mins = e - s
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return `${hrs}h ${rem}m`
}

function safeDate(s?: string | null) {
  if (!s) return null
  const d = parseISO(s)
  return isValid(d) ? d : null
}

function fmtDate(s?: string | null, f = "yyyy-MM-dd") {
  const d = safeDate(s)
  return d ? format(d, f) : "—"
}

function isResolved(status?: string | null) {
  return (status || "").toLowerCase() === "resolved"
}

// ────────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter()

  // session state
  const [userSession, setUserSession] = useState<UserSession | null>(null)

  // data state
  const [sessions, setSessions] = useState<DbSession[]>([])
  const [incidents, setIncidents] = useState<DbIncident[]>([])
  const [behaviour, setBehaviour] = useState<DbBehaviour[]>([])

  // details toggles
  const [showSessionDetails, setShowSessionDetails] = useState(false)
  const [showBehaviourDetails, setShowBehaviourDetails] = useState(false)
  const [showIncidentDetails, setShowIncidentDetails] = useState(false)

  // ui state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // default = past month (inclusive)
  const [fromDate, setFromDate] = useState<string>(() => format(startOfDay(subMonths(new Date(), 1)), "yyyy-MM-dd"))
  const [toDate, setToDate] = useState<string>(() => format(endOfDay(new Date()), "yyyy-MM-dd"))

  const [personFilter, setPersonFilter] = useState<string>("All")

  const sessionPDFRef = useRef<HTMLDivElement>(null)
  const behaviourPDFRef = useRef<HTMLDivElement>(null)
  const incidentsPDFRef = useRef<HTMLDivElement>(null)


  // internal test toggle
  const ENABLE_DEV_TESTS = true

  // ── auth/session boot ───────────────────────────────────────────────────────
  useEffect(() => {
    const sessionData = typeof window !== "undefined" ? sessionStorage.getItem("userSession") : null
    if (sessionData) {
      setUserSession(JSON.parse(sessionData))
    } else {
      router.push("/login")
    }
  }, [router])

  // ── fetchers ────────────────────────────────────────────────────────────────
  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      // Inclusive range per your note
      const { data: sData, error: sErr } = await supabase
        .from("sessions")
        .select(
          `id, lab, date, start_time, end_time, purpose, status, created_by, created_by_email, created_at, description`
        )
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })
      if (sErr) throw sErr
      setSessions(sData || [])

      const fromISO = `${fromDate}T00:00:00Z`
      const toISO = `${toDate}T23:59:59Z`

      const { data: iData, error: iErr } = await supabase
        .from("maintenance_issues")
        .select(
          `id, category, created_at, description, lab, machine_id, reported_by, severity, status, title, updated_at, resolved_by`
        )
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .order("created_at", { ascending: true })
      if (iErr) throw iErr
      setIncidents(iData || [])

      const { data: bData, error: bErr } = await supabase
        .from("incident")
        .select(
          `id, reported_user_id, reported_user_name, reported_user_email, reported_user_role, reporter_email, reporter_name, reporter_role, reason, details, status, created_at, updated_at`
        )
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .order("created_at", { ascending: true })
      if (bErr) throw bErr
      setBehaviour(bData || [])
    } catch (e: any) {
      setError(e?.message || "Failed to load reports")
    } finally {
      setLoading(false)
    }
  }

  // auto-load on initial mount and whenever the date range changes
  useEffect(() => {
    if (userSession) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSession, fromDate, toDate])

  // ── derived analytics ───────────────────────────────────────────────────────
  const sessionByLab = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions) {
      const lab = s.lab || "Unknown Lab"
      map.set(lab, (map.get(lab) || 0) + 1)
    }
    return Array.from(map, ([lab, count]) => ({ lab, count }))
  }, [sessions])

  const mostUsedLab = useMemo(() => {
    if (!sessionByLab.length) return { lab: "—", count: 0 }
    return sessionByLab.slice().sort((a, b) => b.count - a.count)[0]
  }, [sessionByLab])

  const sessionByHour = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of sessions) {
      const hh = (s.start_time || "00:00").split(":")[0]
      counts[hh] = (counts[hh] || 0) + 1
    }
    const hours = Array.from({ length: 15 }, (_, i) => String(i + 7).padStart(2, "0"))
    return hours.map((h) => ({ hour: `${h}:00`, sessions: counts[h] || 0 }))
  }, [sessions])

  // ADD: peak days of the week
const sessionByDay = useMemo(() => {
    const map = new Map<string, number>()
    sessions.forEach((s) => {
      const d = safeDate(s.date)
      if (d) {
        const day = format(d, "EEEE")
        map.set(day, (map.get(day) || 0) + 1)
      }
    })
    const order = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
    const arr = Array.from(map, ([day, count]) => ({ day, count }))
    return arr.sort((a,b)=> order.indexOf(a.day) - order.indexOf(b.day))
  }, [sessions])

  const incidentByLab = useMemo(() => {
    const map = new Map<string, number>()
    for (const i of incidents) {
      const lab = i.lab || "Unknown Lab"
      map.set(lab, (map.get(lab) || 0) + 1)
    }
    return Array.from(map, ([lab, count]) => ({ lab, count }))
  }, [incidents])

  const incidentByMachine = useMemo(() => {
    const map = new Map<string, number>()
    incidents.forEach((i) => map.set(i.machine_id || "Unknown Machine", (map.get(i.machine_id || "Unknown Machine") || 0) + 1))
    return Array.from(map, ([machine, count]) => ({ machine, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [incidents])

  const incidentByType = useMemo(() => {
    const map = new Map<string, number>()
    incidents.forEach((i) => {
      const t = i.category || i.title || "Unspecified"
      map.set(t, (map.get(t) || 0) + 1)
    })
    return Array.from(map, ([type, count]) => ({ type, count }))
  }, [incidents])

  const behaviourByUser = useMemo(() => {
    const made = new Map<string, number>()
    const received = new Map<string, number>()
    for (const b of behaviour) {
      const rName = b.reporter_name || b.reporter_email || "Unknown"
      const tName = b.reported_user_name || b.reported_user_email || "Unknown"
      made.set(rName, (made.get(rName) || 0) + 1)
      received.set(tName, (received.get(tName) || 0) + 1)
    }
    const names = new Set<string>([...made.keys(), ...received.keys()])
    return Array.from(names).map((name) => ({ name, made: made.get(name) || 0, received: received.get(name) || 0 }))
  }, [behaviour])

  const behaviourReasons = useMemo(() => {
    const counts = new Map<string, number>()
    for (const b of behaviour) {
      const reason = (b.reason || "unspecified").toLowerCase()
      counts.set(reason, (counts.get(reason) || 0) + 1)
    }
    return Array.from(counts, ([reason, count]) => ({ reason, count }))
  }, [behaviour])

  // Who should be shown right now
  const selectedPerson = useMemo(() => {
    if (personFilter !== "All") return personFilter
    // fallback: first name seen in behaviour (reporter or reported)
    const names = Array.from(
      new Set(
        behaviour.flatMap(b =>
          [
            b.reporter_name || b.reporter_email,
            b.reported_user_name || b.reported_user_email,
          ].filter(Boolean) as string[]
        )
      )
    )
    return names[0] || "All"
  }, [personFilter, behaviour])

  // Bar data for the selected person
  const accountabilityForSelected = useMemo(() => {
    const made = behaviour.filter(
      b => (b.reporter_name || b.reporter_email || "Unknown") === selectedPerson
    ).length
    const received = behaviour.filter(
      b => (b.reported_user_name || b.reported_user_email || "Unknown") === selectedPerson
    ).length
    return [
      { metric: "Made", value: made },
      { metric: "Received", value: received },
    ]
  }, [behaviour, selectedPerson])

  const mostCommonReason = useMemo(() => {
    if (!behaviourReasons.length) return "—"
    return behaviourReasons.slice().sort((a, b) => b.count - a.count)[0].reason
  }, [behaviourReasons])

  const meanTimeToResolve = useMemo(() => {
    const times: number[] = []
    incidents.forEach((i) => {
      if (i.created_at && i.updated_at && isResolved(i.status)) {
        const start = safeDate(i.created_at)
        const end = safeDate(i.updated_at)
        if (start && end) times.push(end.getTime() - start.getTime())
      }
    })
    if (!times.length) return "—"
    const avgMs = times.reduce((a, b) => a + b, 0) / times.length
    const hrs = Math.floor(avgMs / 3600000)
    const mins = Math.round((avgMs % 3600000) / 60000)
    return `${hrs}h ${mins}m`
  }, [incidents])

  // ADD: unresolved count
  const unresolvedIncidents = useMemo(
    () => incidents.filter((i) => !isResolved(i.status)).length,
    [incidents]
  )

  // ── export helpers ──────────────────────────────────────────────────────────
  function rowsToCSV(rows: Record<string, any>[]) {
    if (!rows?.length) return ""

    const headerSet = rows.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k))
      return set
    }, new Set<string>())

    const headers = Array.from(headerSet)

    const csv = [headers.join(",")]
      .concat(
        rows.map((r) =>
          headers
            .map((h) => {
              const v = r[h]
              if (v == null) return ""
              const s = String(v).replaceAll('"', '""')
              const needs = /[",\r\n]/.test(s)
              return needs ? `"${s}"` : s
            })
            .join(",")
        )
      )
      .join("\n")
    return csv
  }

  function exportCSV(filename: string, rows: Record<string, any>[]) {
    const csv = rowsToCSV(rows)
    if (!csv) return
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // PDF EXPORT HELPER (inside ReportsPage, below your CSV helpers or anywhere above return)
  async function exportSectionToPDF(ref: { current: HTMLDivElement | null },
  filename: string ) {
    const el = ref.current
    if (!el) return

    // ensure white background so charts look correct
    const prevBg = el.style.backgroundColor
    el.style.backgroundColor = "#ffffff"

    const canvas = await html2canvas(el, {
      scale: 2,                 // sharp text/charts
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: document.documentElement.clientWidth, // helps with responsive layouts
    })

    el.style.backgroundColor = prevBg

    const imgData = canvas.toDataURL("image/png")
    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" })

    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const margin = 10
    const usableW = pageW - margin * 2
    const imgW = usableW
    const imgH = (canvas.height * imgW) / canvas.width

    let y = margin
    let remaining = imgH
    let srcY = 0
    const pxPerMm = canvas.height / imgH // convert mm to px for slicing

    // add first page
    pdf.addImage(imgData, "PNG", margin, y, imgW, Math.min(imgH, pageH - margin * 2), undefined, "FAST")

    // if content is taller than one page, slice and add more
    while (y + remaining > pageH - margin) {
      pdf.addPage()
      y = margin

      // compute slice rectangle in px to simulate page breaks
      srcY += (pageH - margin * 2) * pxPerMm
      const sliceCanvas = document.createElement("canvas")
      const sliceHpx = Math.min(canvas.height - srcY, (pageH - margin * 2) * pxPerMm)
      sliceCanvas.width = canvas.width
      sliceCanvas.height = Math.max(1, Math.floor(sliceHpx))

      const ctx = sliceCanvas.getContext("2d")
      if (!ctx) break
      ctx.drawImage(
        canvas,
        0, srcY, canvas.width, sliceCanvas.height, // src rect
        0, 0, sliceCanvas.width, sliceCanvas.height // dest rect
      )
      const sliceData = sliceCanvas.toDataURL("image/png")
      const sliceH = (sliceCanvas.height * imgW) / sliceCanvas.width
      pdf.addImage(sliceData, "PNG", margin, y, imgW, sliceH, undefined, "FAST")

      remaining -= (pageH - margin * 2)
    }

    pdf.save(filename)
  }

  const exportSessions = () => exportCSV("session_activity.csv", sessions as any)
  const exportIncidents = () => exportCSV("incident_report.csv", incidents as any)
  const exportBehaviour = () => exportCSV("staff_behaviour.csv", behaviour as any)

  // ── dev tests (validate helpers) ─────────────────────────────────────────────
  useEffect(() => {
    if (!ENABLE_DEV_TESTS) return
    try {
      const rows = [
        { a: "x", b: "y" },
        { a: "c,d", b: 'e"f', c: "line\nbreak" },
      ]
      const csv = rowsToCSV(rows)
      console.assert(csv.startsWith("a,b,c\n"), "CSV header order should be a,b,c")
      console.assert(csv.includes('"c,d"'), "Comma values should be quoted")
      console.assert(csv.includes('"e""f"'), "Quotes should be doubled and wrapped")
      console.assert(csv.includes('"line\nbreak"'), "Newlines should be quoted")
      console.assert(durationLabel("08:00", "10:15") === "2h 15m", "duration label calc")
    } catch (e) {
      console.warn("Dev tests failed:", e)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!userSession) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-gradient-to-r from-[#000068] to-[#1e5fa8] text-white **h-20** flex **items-center** p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 flex items-center gap-2">
                <ArrowLeft className="h-5 w-5 text-white group-hover:text-white" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Reports</h1>
              <p className="text-xs opacity-60"> {userSession.name} ({userSession.role}) - Can view reports</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        <div className="space-y-6 pt-2 pb-66">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="pt-2">
              <p className="text-lg font-semibold text-black text-muted-foreground">Select a date range to analyse sessions, staff behaviour, and incidents:</p>
            
              <div className="flex items-end gap-4 pb-6">
                <div className="flex flex-wrap items-end gap-4">
                  <div >
                    <Label htmlFor="from">From</Label>
                    <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 w-[160px] sm:w-[190px]"/>
                  </div>
                  <div >
                    <Label htmlFor="to">To</Label>
                    <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}  className="h-10 w-[160px] sm:w-[190px]"/>
                  </div>
                </div>
                <Button onClick={loadData} disabled={loading} className="bg-[#000068] hover:bg-[#030384]">
                  {loading ? "Loading…" : "Refresh"}
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <Tabs defaultValue="session" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="session" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Session Activity
              </TabsTrigger>
              <TabsTrigger value="staff" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Staff Behaviour
              </TabsTrigger>
              <TabsTrigger value="incidents" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Incident Report
              </TabsTrigger>
            </TabsList>

            {/* Session Activity */}
            <TabsContent value="session" className="space-y-4">
              <div ref={sessionPDFRef}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 ">
                        <Activity className="h-5 w-5" />
                        Session Activity Report
                      </CardTitle>
                      <CardDescription className="mt-2 px-2">
                        View session counts by hour and by lab; toggle the detailed list to see each session with purpose/creator.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => setShowSessionDetails((v) => !v)}>
                        {showSessionDetails ? "Hide details" : "Show details"}
                      </Button>
                      <Button
                      onClick={() => exportSectionToPDF(sessionPDFRef, "session-activity.pdf")}
                      className="bg-[#000068] hover:bg-[#030384] flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export PDF
                    </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* KPI strip */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <KPI label="Total Sessions" value={sessions.length} />
                      <KPI label="Most Used Lab" value={`${mostUsedLab.lab}`} />
                      <KPI label="Completed" value={sessions.filter(s => (s.status || "").toLowerCase() === "completed").length} />
                      <KPI label="Creators" value={new Set(sessions.map(s => s.created_by || s.created_by_email || "—").filter(Boolean)).size} />
                    </div>

                    {/* Chart: Sessions by Hour (peaks) */}
                    <ChartBlock title="Sessions by Hour (peaks)">
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={sessionByHour} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Line type="monotone" dataKey="sessions" stroke={PALETTE[0]} strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartBlock>

                    {/* Chart: Sessions by Lab */}
                    <ChartBlock title="Sessions by Lab">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={sessionByLab} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="lab" interval={0} angle={-20} textAnchor="end" height={80} />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill={PALETTE[1]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartBlock>

                    {/* ADD: Peak days of the week */}
                    <ChartBlock title="Peak Days of the Week">
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={sessionByDay} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill={PALETTE[2]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartBlock>

                    {/* Detailed List (toggle) */}
                    {showSessionDetails && (
                      <div className="space-y-3">
                        {sessions.map((s) => (
                          <div key={s.id} className="border rounded-lg p-4">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                              <div>
                                <p className="font-semibold text-sm text-muted-foreground">Lab & Purpose</p>
                                <p className="font-medium">{s.lab || "Unknown Lab"}</p>
                                <p className="text-sm text-muted-foreground">{s.purpose || "—"}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-muted-foreground">Date</p>
                                <p className="font-medium">{fmtDate(s.date)}</p>
                                <p className="text-sm text-muted-foreground">By {s.created_by || s.created_by_email || "—"}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-muted-foreground">Time</p>
                                <p className="font-medium">{s.start_time || "—"} – {s.end_time || "—"}</p>
                                <p className="text-sm text-muted-foreground">{durationLabel(s.start_time, s.end_time)}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-muted-foreground">Status</p>
                                <p className="font-medium">{s.status || "—"}</p>
                                <p className="text-xs text-muted-foreground">{fmtDate(s.created_at)}</p>
                              </div>
                              <div className="hidden md:block">
                                <p className="font-semibold text-sm text-muted-foreground">Notes</p>
                                <p className="text-sm">{s.description || "—"}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Staff Behaviour */}
            <TabsContent value="staff" className="space-y-4">
              <div ref={behaviourPDFRef}>  
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Staff Behaviour Report
                      </CardTitle>
                      <CardDescription>
                        Who reported vs who was reported, plus the most common reasons.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => setShowIncidentDetails((v) => !v)}>
                        {showIncidentDetails ? "Hide details" : "Show details"}
                      </Button>
                    
                      <Button
                        onClick={() => exportSectionToPDF(behaviourPDFRef, "staff-behaviour.pdf")}
                        className="bg-[#000068] hover:bg-[#030384] flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Export PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <KPI label="Reports Filed" value={behaviour.length} />
                      <KPI label="# Reported People" value={new Set(behaviour.map(b => b.reported_user_email || b.reported_user_name || "—")).size} />
                      <KPI label="Unique Reasons" value={new Set(behaviour.map(b => (b.reason || "unspecified").toLowerCase())).size} />
                      <KPI label="Most Common Reason" value={mostCommonReason} />
                    </div>

                    {/* Bar: per-user made vs received (colorful) */}
                    <ChartBlock title="Accountability Balance">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Person</span>
                        <select
                          value={selectedPerson}
                          onChange={(e) => setPersonFilter(e.target.value)}
                          className="border rounded-md px-2 py-1 text-sm"
                        >
                          {Array.from(new Set(
                            behaviour.flatMap(b =>
                              [
                                b.reporter_name || b.reporter_email,
                                b.reported_user_name || b.reported_user_email,
                              ].filter(Boolean) as string[]
                            )
                          )).map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>

                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart
                          data={accountabilityForSelected}
                          margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
                          barCategoryGap="40%"   // space between categories
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="metric" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="value" barSize={40}>   {/* ⬅️ thinner bars, adjust as needed */}
                            {accountabilityForSelected.map((_, i) => (
                              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>

                    </ChartBlock>

                    {/* Pie: reasons distribution (clean legend, no labels/lines) */}
                    <ChartBlock title="Most Common Reasons (share)">
                      <ResponsiveContainer width="100%" height={320}>
                        <PieChart>
                          <Pie data={behaviourReasons} dataKey="count" nameKey="reason" innerRadius={60} outerRadius={120} paddingAngle={2} label={false} stroke="none">
                            {behaviourReasons.map((_, i) => (
                              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                            ))}
                          </Pie>
                          <Legend verticalAlign="bottom" align="center" wrapperStyle={{ marginTop: 12 }} />
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartBlock>

                    {/* Raw list (toggle) */}
                    {showBehaviourDetails && (
                      <div className="space-y-3">
                        {behaviour.map((b) => (
                          <div key={b.id} className="border rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div>
                                <p className="font-semibold text-sm text-muted-foreground">When</p>
                                <p className="font-medium">{fmtDate(b.created_at)}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-muted-foreground">Reporter</p>
                                <p className="font-medium">{b.reporter_name || b.reporter_email || "Unknown"}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-muted-foreground">Reported Person</p>
                                <p className="font-medium">{b.reported_user_name || b.reported_user_email || "Unknown"}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-muted-foreground">Reason</p>
                                <p className="font-medium capitalize">{b.reason || "unspecified"}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Incidents */}
            <TabsContent value="incidents" className="space-y-4">
              <div ref={incidentsPDFRef}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Incident Report
                      </CardTitle>
                      <CardDescription>
                        Kiosk/machine issues across labs with recurring failures and resolution tracking.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => setShowIncidentDetails((v) => !v)}>
                        {showIncidentDetails ? "Hide details" : "Show details"}
                      </Button>
                      <Button
                        onClick={() => exportSectionToPDF(incidentsPDFRef, "incident-report.pdf")}
                        className="bg-[#000068] hover:bg-[#030384] flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Export PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <KPI label="Total Incidents" value={incidents.length} />
                      <KPI label="Labs Affected" value={new Set(incidents.map(i => i.lab || "? ")).size} />
                      <KPI label="Unresolved" value={unresolvedIncidents} />
                      <KPI label="Resolved" value={incidents.filter(i => isResolved(i.status)).length} />
                      <KPI label="Mean Time to Resolve" value={meanTimeToResolve} />
                    </div>

                    {/* Bar: incidents by lab */}
                    <ChartBlock title="Incidents per Lab">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={incidentByLab} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="lab" interval={0} angle={-20} textAnchor="end" height={80} />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill={PALETTE[4]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartBlock>

                    {/* ADD: Top Machines by Repeat Failures */}
                    <ChartBlock title="Top Machines with Repeat Failures (Top 10)">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={incidentByMachine} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="machine" interval={0} angle={-20} textAnchor="end" height={80} />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill={PALETTE[6]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartBlock>

                    {/* ADD: Recurring Issue Types */}
                    <ChartBlock title="Recurring Issue Types">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={incidentByType} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="type" interval={0} angle={-15} textAnchor="end" height={60} />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill={PALETTE[5]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartBlock>

                    {/* List (toggle) */}
                    {showIncidentDetails && (
                      <div className="space-y-3">
                        {incidents.map((i) => (
                          <div key={i.id} className="border rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div>
                                <p className="font-semibold text-sm text-muted-foreground">Timeline</p>
                                <p className="font-medium">{fmtDate(i.created_at)} → {i.updated_at ? fmtDate(i.updated_at) : "—"}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-muted-foreground">Machine / Lab</p>
                                <p className="font-medium">{i.machine_id || "Unknown"}</p>
                                <p className="text-sm text-muted-foreground">{i.lab || "Unknown Lab"}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-muted-foreground">Issue & Status</p>
                                <p className="font-medium">{i.title || i.category || "—"}</p>
                                <p className="text-sm text-muted-foreground capitalize">{i.status || "—"} {i.severity ? `• ${i.severity}` : ""}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-muted-foreground">Notes</p>
                                <p className="text-sm">{i.description || "—"}</p>
                                <p className="text-xs text-muted-foreground mt-1">{i.resolved_by ? `Resolved by ${i.resolved_by}` : (i.reported_by ? `Reported by ${i.reported_by}` : " ")}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <footer className="border-t py-4 bg-muted">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Mathematical Sciences Support, University of the Witwatersrand
        </div>
      </footer>

      <ScrollToTopButton />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Small UI helpers
// ────────────────────────────────────────────────────────────────────────────────

function KPI({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}

function ChartBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="font-semibold mb-2">{title}</div>
      {children}
    </div>
  )
}

function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 300)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (!isVisible) return null

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 p-3 rounded-full bg-[#000068]  text-white shadow-lg hover:bg-[#030384] transition-colors"
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  )
}

