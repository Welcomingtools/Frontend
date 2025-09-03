"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, UserPlus, Edit, Trash2, Shield, AlertTriangle, User, Loader2, Phone } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"   // or your toast lib

/**  --- Types --- */
type Role = "Admin" | "BCDR" | "Welcoming Team"

type Member = {
  id: string
  name: string              // first name
  surname?: string | null
  phone_number?: string | null
  email: string
  role: Role
  status: "Active" | "Inactive"
}

type UserSession = {
  email: string
  name: string
  role: Role
  loginTime: string
  accountType: string
}

type Report = {
  id: string
  reported_user_email: string
  reported_user_name: string
  reported_user_role: Role | string
  reporter_email: string
  reporter_name: string
  reporter_role: Role | string
  reason: string
  details: string
  status: "Submitted" | "Resolved" | "Under Review"
  created_at?: string
}

/** --------------- Helpers --------------- */
const ROLE_TABLE: Record<Role, string> = {
  Admin: "admin",
  BCDR: "bcdr",
  "Welcoming Team": "wtm",
}

function toMember(rows: any[], role: Role): Member[] {
  return (rows || []).map((r) => ({
    id: r.id,
    name: r.name ?? r.username ?? "",
    surname: r.surname ?? null,
    phone_number: r.phone_number ?? null,
    email: r.email,
    role,
    status: (r.status ?? "Active") as Member["status"],
  }))
}

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "—")

/** --------------- Page ------------------ */
export default function TeamPage() {
  const router = useRouter()

  const [userSession, setUserSession] = useState<UserSession | null>(null)
  const [isAuthorized, setIsAuthorized] = useState(false)

  const [teamData, setTeamData] = useState<Member[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)

  // NEW: add form state now includes name, surname, phone_number
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newMember, setNewMember] = useState<{
    name: string
    surname: string
    phone_number: string
    email: string
    role: Role
  }>({
    name: "",
    surname: "",
    phone_number: "",
    email: "",
    role: "Welcoming Team",
  })

  const [editMember, setEditMember] = useState<Member | null>(null)

  // Reports
  const [reports, setReports] = useState<Report[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState<Member | null>(null)
  const [reportForm, setReportForm] = useState({ reason: "Incorrect role", details: "" })

  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [activeReport, setActiveReport] = useState<Report | null>(null)
  const [reportEdit, setReportEdit] = useState({ reason: "", details: "", status: "Submitted" as Report["status"] })
  
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwPayload, setPwPayload] = useState<{ email: string; password: string } | null>(null);

  const isAdmin = userSession?.role === "Admin"
  const displayedMembers = useMemo(
    () => (isAdmin ? teamData : teamData.filter((m) => m.role === userSession?.role)),
    [isAdmin, teamData, userSession?.role]
  )

  /** 1) Session gate (no TLA conversion) */
  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = sessionStorage.getItem("userSession")
    if (!raw) {
      router.push("/login")
      return
    }
    const s = JSON.parse(raw) as UserSession
    setUserSession(s)
    setIsAuthorized(["Admin", "BCDR", "Welcoming Team"].includes(s.role))
  }, [router])

  /** 2) Fetch members from the 3 role tables (now selecting new cols) */
  useEffect(() => {
    if (!isAuthorized) return
    let cancelled = false
    ;(async () => {
      setLoadingMembers(true)
      try {
        const [a, b, c] = await Promise.all([
          supabase.from(ROLE_TABLE.Admin).select("id, email, username, status, name, surname, phone_number"),
          supabase.from(ROLE_TABLE.BCDR).select("id, email, username, status, name, surname, phone_number"),
          supabase.from(ROLE_TABLE["Welcoming Team"]).select("id, email, username, status, name, surname, phone_number"),
        ])
        if (cancelled) return
        if (a.error) throw a.error
        if (b.error) throw b.error
        if (c.error) throw c.error
        const rows: Member[] = [
          ...toMember(a.data ?? [], "Admin"),
          ...toMember(b.data ?? [], "BCDR"),
          ...toMember(c.data ?? [], "Welcoming Team"),
        ]
        setTeamData(rows)
      } catch (err) {
        console.warn("Error fetching members:", err)
      } finally {
        if (!cancelled) setLoadingMembers(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthorized])

  /** 3) Load reports + realtime */
  useEffect(() => {
    if (!userSession) return
    const me = (userSession.email || "").toLowerCase().trim()

    let unsub = () => {}
    ;(async () => {
      setReportsLoading(true)
      const base = supabase.from("team_issue")
      const q = isAdmin
        ? base.select("*").order("created_at", { ascending: false })
        : base.select("*").eq("reporter_email", me).order("created_at", { ascending: false })

      const { data, error } = await q
      if (error) {
        console.warn("Load reports failed:", error)
        setReportsLoading(false)
        return
      }
      setReports((data || []) as Report[])
      setReportsLoading(false)

      // realtime subscription
      const channel = supabase
        .channel("team-issue-live")
        .on<RealtimePostgresChangesPayload<Report>>(
          "postgres_changes",
          { event: "*", schema: "public", table: "team_issue" },
          (payload) => {
            const next = payload.new as Report | null
            const prevRow = payload.old as Report | null
            const row = next ?? prevRow
            if (!row) return
            setReports((prev) => {
              switch (payload.eventType) {
                case "INSERT":
                  return [next as Report, ...prev]
                case "UPDATE":
                  return prev.map((r) => (r.id === row.id ? (next as Report) : r))
                case "DELETE":
                  return prev.filter((r) => r.id !== row.id)
                default:
                  return prev
              }
            })
          }
        )
        .subscribe()

      unsub = () => supabase.removeChannel(channel)
    })()

    return () => {
      unsub()
    }
  }, [isAdmin, userSession])

  /** 4) Add member (insert into chosen role table) */
  const handleAddMember = async () => {
    if (!newMember.name || !newMember.surname || !newMember.phone_number || !newMember.email) {
      alert("Please fill in all fields.");
      return;
    }

    try {
      const res = await fetch("/api/team/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMember),
      });

      const json = await res.json();
      if (!res.ok) {
        alert(`Failed to add member: ${json.error || "Unknown error"}`);
        return;
      }

      // Re-fetch members (your existing code stays)
      setLoadingMembers(true);
      try {
        const [a, b, c] = await Promise.all([
          supabase.from("admin").select("id, email, username, status, name, surname, phone_number"),
          supabase.from("bcdr").select("id, email, username, status, name, surname, phone_number"),
          supabase.from("wtm").select("id, email, username, status, name, surname, phone_number"),
        ]);
        if (a.error) throw a.error; if (b.error) throw b.error; if (c.error) throw c.error;
        const rows: Member[] = [
          ...toMember(a.data ?? [], "Admin"),
          ...toMember(b.data ?? [], "BCDR"),
          ...toMember(c.data ?? [], "Welcoming Team"),
        ];
        setTeamData(rows);
      } finally {
        setLoadingMembers(false);
      }

      // show password popup (no extra prompts)
      setIsAddDialogOpen(false);
      setNewMember({ name: "", surname: "", phone_number: "", email: "", role: "Welcoming Team" });

      if (json.password) {
        setPwPayload({ email: json.email ?? newMember.email, password: json.password });
        setPwDialogOpen(true);
      }

    } catch (e: any) {
      alert(`Failed to add member: ${e?.message ?? e}`);
    }
  };


  /** 5) Edit member (can move between role tables) */
  const handleEditMember = async () => {
    if (!editMember) return
    const current = teamData.find((m) => m.id === editMember.id)
    if (!current) return
    const prevTable = ROLE_TABLE[current.role]
    const nextTable = ROLE_TABLE[editMember.role]
    try {
      if (prevTable === nextTable) {
        const { error } = await supabase
          .from(prevTable)
          .update({
            email: editMember.email.toLowerCase().trim(),
            username: editMember.name, // keep username in sync with name if you use it
            name: editMember.name,
            surname: editMember.surname ?? null,
            phone_number: editMember.phone_number ?? null,
          })
          .eq("id", editMember.id)
        if (error) throw error
      } else {
        const { error: insErr } = await supabase.from(nextTable).insert([
          {
            email: editMember.email.toLowerCase().trim(),
            username: editMember.name,
            name: editMember.name,
            surname: editMember.surname ?? null,
            phone_number: editMember.phone_number ?? null,
            status: editMember.status,
          },
        ])
        if (insErr) throw insErr
        const { error: delErr } = await supabase.from(prevTable).delete().eq("id", editMember.id)
        if (delErr) throw delErr
      }
      setTeamData((prev) => prev.map((m) => (m.id === current.id ? { ...editMember } as Member : m)))
      setEditMember(null)
    } catch (e: any) {
      alert(`Error saving member: ${e.message ?? e}`)
    }
  }

  /** 6) Delete member */
  const handleDeleteMember = async (id: string) => {
    const m = teamData.find((x) => x.id === id)
    if (!m) return
    const table = ROLE_TABLE[m.role]
    const { error } = await supabase.from(table).delete().eq("id", id)
    if (error) {
      alert(`Failed to delete: ${error.message}`)
      return
    }
    setTeamData((prev) => prev.filter((x) => x.id !== id))
  }

  /** 7) Toggle status (if your tables have a status column) */
  const handleStatusToggle = async (id: string) => {
    const m = teamData.find((x) => x.id === id)
    if (!m) return
    const table = ROLE_TABLE[m.role]
    const next = m.status === "Active" ? "Inactive" : "Active"
    const { error } = await supabase.from(table).update({ status: next }).eq("id", id)
    if (error) {
      alert(`Failed to update status: ${error.message}`)
      return
    }
    setTeamData((prev) => prev.map((x) => (x.id === id ? { ...x, status: next } : x)))
  }

  /** 8) Reports */
  const openReport = (member: Member) => {
    setReportTarget(member)
    setReportForm({ reason: "Incorrect role", details: "" })
    setReportOpen(true)
  }

  const submitReport = async () => {
    if (!reportTarget || !userSession) return
    const { error } = await supabase.from("team_issue").insert([
      {
        reported_user_email: reportTarget.email.toLowerCase().trim(),
        reported_user_name: `${reportTarget.name} ${reportTarget.surname ?? ""}`.trim(),
        reported_user_role: reportTarget.role,
        reporter_email: userSession.email.toLowerCase().trim(),
        reporter_name: userSession.name,
        reporter_role: userSession.role,
        reason: reportForm.reason,
        details: reportForm.details,
        status: "Submitted",
      },
    ])
    if (error) {
      console.warn("Report failed:", error)
      alert("Failed to submit report.")
      return
    }
    setReportOpen(false)
    alert("Report submitted. Thank you!")
  }

  const openReportDialog = (r: Report) => {
    setActiveReport(r)
    setReportEdit({ reason: r.reason, details: r.details, status: r.status })
    setReportDialogOpen(true)
  }

  const saveReportEdits = async () => {
    if (!activeReport) return
    const { id } = activeReport
    if (isAdmin) {
      const { error } = await supabase.from("team_issue").update({ status: reportEdit.status }).eq("id", id)
      if (error) return alert(`Failed to update status: ${error.message}`)
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: reportEdit.status } as Report : r)))
    } else {
      const { error } = await supabase
        .from("team_issue")
        .update({ reason: reportEdit.reason, details: reportEdit.details })
        .eq("id", id)
      if (error) return alert(`Failed to update report: ${error.message}`)
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, reason: reportEdit.reason, details: reportEdit.details } as Report : r))
      )
    }
    setReportDialogOpen(false)
  }

  /** -------------------- UI --------------------- */

  if (userSession === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f4d92] mx-auto mb-4" />
          <p>Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="bg-[#0f4d92] text-white p-4">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild className="text-white">
                <Link href="/dashboard"><ArrowLeft className="h-5 w-5" /></Link>
              </Button>
              <h1 className="text-xl font-bold">Access Denied</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto p-4 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-2xl">Access Restricted</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You don’t have access to Team Management.
                </AlertDescription>
              </Alert>
              <div className="pt-4">
                <Button asChild className="w-full">
                  <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" />Return to Dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[#0f4d92] text-white p-4 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="text-white">
              <Link href="/dashboard"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">{isAdmin ? "Team Management" : "My Team"}</h1>
              <p className="text-xs opacity-75">Logged in as: {userSession?.name} ({userSession?.role})</p>
            </div>
          </div>

          {isAdmin && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-white text-[#0f4d92] hover:bg-gray-100">
                  <UserPlus className="h-4 w-4 mr-2" /> Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Member</DialogTitle>
                  <DialogDescription>Add a new member to the team.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">First Name</Label>
                    <Input
                      id="name"
                      value={newMember.name}
                      onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                      placeholder="Enter first name"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="surname">Surname</Label>
                    <Input
                      id="surname"
                      value={newMember.surname}
                      onChange={(e) => setNewMember({ ...newMember, surname: e.target.value })}
                      placeholder="Enter surname"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input
                      id="phone_number"
                      type="tel"
                      value={newMember.phone_number}
                      onChange={(e) => setNewMember({ ...newMember, phone_number: e.target.value })}
                      placeholder="+27 82 123 4567"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newMember.email}
                      onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                      placeholder="Enter email address"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={newMember.role} onValueChange={(v: Role) => setNewMember({ ...newMember, role: v })}>
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Welcoming Team">Welcoming Team</SelectItem>
                        <SelectItem value="BCDR">BCDR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddMember}>Add Member</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        <Card>
          <CardHeader><CardTitle>Team Members</CardTitle></CardHeader>
        <CardContent>
          {loadingMembers ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading team…
            </div>
          ) : (
            <div className="space-y-4">
              {displayedMembers.map((member) => (
                <div key={`${member.role}-${member.id}`} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${member.name}`} />
                      <AvatarFallback className="bg-[#0f4d92] text-white">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {member.name} {member.surname ? member.surname : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{member.role}</Badge>
                        <Badge variant={member.status === "Active" ? "default" : "secondary"}>{member.status}</Badge>
                        {member.phone_number && (
                          <span className="text-xs flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" /> {member.phone_number}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isAdmin ? (
                    <div className="flex items-center gap-2">
                      {/* Edit */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setEditMember(member)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Team Member</DialogTitle>
                            <DialogDescription>Update team member information.</DialogDescription>
                          </DialogHeader>
                          {editMember && (
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <Label htmlFor="edit-name">First Name</Label>
                                <Input id="edit-name" value={editMember.name} onChange={(e) => setEditMember({ ...editMember, name: e.target.value })} />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="edit-surname">Surname</Label>
                                <Input id="edit-surname" value={editMember.surname ?? ""} onChange={(e) => setEditMember({ ...editMember, surname: e.target.value })} />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="edit-phone">Phone Number</Label>
                                <Input id="edit-phone" type="tel" value={editMember.phone_number ?? ""} onChange={(e) => setEditMember({ ...editMember, phone_number: e.target.value })} />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="edit-email">Email</Label>
                                <Input id="edit-email" type="email" value={editMember.email} onChange={(e) => setEditMember({ ...editMember, email: e.target.value })} />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="edit-role">Role</Label>
                                <Select value={editMember.role} onValueChange={(v: Role) => setEditMember({ ...editMember, role: v })}>
                                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Admin">Admin</SelectItem>
                                    <SelectItem value="Welcoming Team">Welcoming Team</SelectItem>
                                    <SelectItem value="BCDR">BCDR</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setEditMember(null)}>Cancel</Button>
                            <Button onClick={handleEditMember}>Save Changes</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {/* Toggle status */}
                      <Button variant="outline" size="sm" onClick={() => handleStatusToggle(member.id)}>
                        {member.status === "Active" ? "Deactivate" : "Activate"}
                      </Button>

                      {/* Delete */}
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteMember(member.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#0f4d92] text-[#0f4d92] hover:bg-[#0f4d92]/10"
                        onClick={() => openReport(member)}
                      >
                        Report
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
        </Card>

        {/* Reports list */}
        <Card className="mt-6">
          <CardHeader><CardTitle>{isAdmin ? "Reports (All Users)" : "Feedback Hub"}</CardTitle></CardHeader>
          <CardContent>
            {reportsLoading ? (
              <p className="text-sm text-muted-foreground">Loading reports…</p>
            ) : reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports yet.</p>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <div key={r.id} className="border rounded-md p-3 flex items-start justify-between">
                    <div>
                      <p className="font-medium">{r.reason}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Reported: {r.reported_user_name} ({r.reported_user_role}) • {r.reported_user_email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        By: {r.reporter_name} ({r.reporter_role}) • {r.reporter_email}
                      </p>
                      <p className="text-sm mt-2">{r.details}</p>
                      <p className="text-xs text-muted-foreground mt-1">{fmtDate(r.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{r.status}</Badge>
                      <Dialog open={reportDialogOpen && activeReport?.id === r.id} onOpenChange={(open) => {
                        if (!open) setReportDialogOpen(false)
                        else openReportDialog(r)
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="ghost">Edit</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Report</DialogTitle>
                            <DialogDescription>Update report details or status.</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-3 py-2">
                            {!isAdmin && (
                              <>
                                <Label>Reason</Label>
                                <Input value={reportEdit.reason} onChange={(e) => setReportEdit((x) => ({ ...x, reason: e.target.value }))} />
                                <Label>Details</Label>
                                <Input value={reportEdit.details} onChange={(e) => setReportEdit((x) => ({ ...x, details: e.target.value }))} />
                              </>
                            )}
                            {isAdmin && (
                              <>
                                <Label>Status</Label>
                                <Select value={reportEdit.status} onValueChange={(v: Report["status"]) => setReportEdit((x) => ({ ...x, status: v }))}>
                                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Submitted">Submitted</SelectItem>
                                    <SelectItem value="Under Review">Under Review</SelectItem>
                                    <SelectItem value="Resolved">Resolved</SelectItem>
                                  </SelectContent>
                                </Select>
                              </>
                            )}
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
                            <Button onClick={saveReportEdits}>Save</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      
      {/* Password Popup Dialog */}
      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User created</DialogTitle>
            <DialogDescription>
              Share the temporary password with the member.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm">
              <div className="text-muted-foreground">Email</div>
              <div className="font-medium">{pwPayload?.email}</div>
            </div>

            <div className="text-sm">
              <div className="text-muted-foreground">Temporary password</div>
              <div className="flex items-center gap-2 mt-1">
                <code className="px-2 py-1 rounded bg-muted">
                  {pwPayload?.password}
                </code>
                <Button
                  size="sm"
                  onClick={() => {
                    if (pwPayload?.password) {
                      navigator.clipboard.writeText(pwPayload.password)
                    }
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setPwDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Submit Report dialog (for non-admins) */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report team issue</DialogTitle>
            <DialogDescription>Tell us what’s wrong; an admin will review it.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Label>Reason</Label>
            <Input value={reportForm.reason} onChange={(e) => setReportForm((x) => ({ ...x, reason: e.target.value }))} />
            <Label>Details</Label>
            <Input value={reportForm.details} onChange={(e) => setReportForm((x) => ({ ...x, details: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button onClick={submitReport}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </div>
  )
}
