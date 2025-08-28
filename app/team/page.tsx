"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { db } from "@/firebase/clientApp"
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, UserPlus, Edit, Trash2, Shield, AlertTriangle, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Alert, AlertDescription } from "@/components/ui/alert"

type Member = {
  id: string
  name: string
  email: string
  role: string
  status: "Active" | "Inactive"
  password: string
}

type UserSession = {
  email: string
  name: string
  role: string
  loginTime: string
  accountType: string
}

type Report = {
  id: string
  reportedUserId: string
  reportedUserName: string
  reportedUserEmail: string
  reportedUserRole: string
  reporterEmail: string
  reporterName: string
  reporterRole: string
  reason: string                // issue type
  details: string
  status: "Submitted" | "Resolved" | "Under Review"
  createdAt?: any               // Firestore Timestamp
}

// Utility function to generate random password
function generateRandomPassword(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let password = ""
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export default function TeamPage() {
  const router = useRouter()
  const [userSession, setUserSession] = useState<UserSession | null>(null)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [teamData, setTeamData] = useState<Member[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newMember, setNewMember] = useState({ name: "", email: "", role: "Welcoming Team" })
  const [editMember, setEditMember] = useState<Member | null>(null)

  const [reportOpen, setReportOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState<Member | null>(null)
  const [reportForm, setReportForm] = useState({ reason: "Incorrect role", details: "" })
  
  //NEW 28/08
  const isAdmin = userSession?.role === "Admin"
  const isBCDR = userSession?.role === "BCDR"
  const isWelcoming = userSession?.role === "Welcoming Team"

  // NEW 28/08 Filtered list of members to display
  const displayedMembers = isAdmin
  ? teamData
  : teamData.filter(m => m.role === userSession?.role)

    // --- Feedback Hub state ---
  const [reports, setReports] = useState<Report[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)

  // Dialog state for viewing/editing a report
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [activeReport, setActiveReport] = useState<Report | null>(null)

  // Local form for editing (non-admin can edit reason/details; admin can update status)
  const [reportEdit, setReportEdit] = useState({ reason: "", details: "", status: "Submitted" as Report["status"] })

  // tiny util
  const fmtDate = (ts?: any) => {
    try {
      const d: Date = ts?.toDate ? ts.toDate() : new Date(ts)
      return d.toLocaleString()
    } catch {
      return "—"
    }
  }

  // Check user authorization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sessionData = sessionStorage.getItem('userSession')
      if (!sessionData) {
        // No session, redirect to login
        router.push('/login')
        return
      }

      const session: UserSession = JSON.parse(sessionData)
      // Convert any existing "TLA" roles to "Welcoming Team"
      if (session.role === "TLA") {
        session.role = "Welcoming Team"
        sessionStorage.setItem('userSession', JSON.stringify(session))
      }
      setUserSession(session)

      // Allow Admin, BCDR, Welcoming Team
      if (["Admin", "BCDR", "Welcoming Team"].includes(session.role)) {
        setIsAuthorized(true)
      } else {
        setIsAuthorized(false)
      }
    }
  }, [router])

  // Fetch members from Firestore (only if authorized)
  useEffect(() => {
    if (!isAuthorized) return

    const fetchMembers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "teamMembers"))
        const members = snapshot.docs.map(doc => {
          const data = doc.data()
          
          return {
            id: doc.id,
            ...data,
          } as Member
        })
        setTeamData(members)
      } catch (error) {
        console.error("Error fetching members:", error)
      }
    }

    fetchMembers()
  }, [isAuthorized])

  //Fetching Reports
  useEffect(() => {
  if (!userSession) return;

  setReportsLoading(true);

  const base = collection(db, "userReports");
  const userEmail = (userSession.email || "").toLowerCase().trim(); // normalize

  const q = isAdmin
    ? query(base, orderBy("createdAt", "desc"))
    : query(
        base,
        where("reporterEmail", "==", userEmail),
        orderBy("createdAt", "desc")
      );

  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Report[];
      setReports(rows);
      setReportsLoading(false);
    },
    (err) => {
      console.error("Feedback Hub subscription error:", err);
      setReportsLoading(false);
    }
  );

  return () => unsubscribe();
  }, [isAdmin, userSession?.email]);




  // Add new member
  const handleAddMember = async () => {
    if (!newMember.name || !newMember.email) return

    const id = newMember.email.toLowerCase()
    const memberRef = doc(db, "teamMembers", id)

    // Generate random password
    const password = generateRandomPassword()

    try {
      await setDoc(memberRef, {
        ...newMember,
        status: "Active",
        password,
      })

      setTeamData([...teamData, { id, ...newMember, status: "Active", password }])
      setNewMember({ name: "", email: "", role: "Welcoming Team" })
      setIsAddDialogOpen(false)

      // Show password to admin (they can send it manually)
      console.log("Member added successfully! Temporary password:", password)
      alert(`Temporary password for ${newMember.name}: ${password}`)
    } catch (err) {
      console.error("Error adding member:", err)
    }
  }

  // Edit existing member
  const handleEditMember = async () => {
    if (!editMember) return

    const memberRef = doc(db, "teamMembers", editMember.id)

    try {
      await updateDoc(memberRef, {
        name: editMember.name,
        email: editMember.email,
        role: editMember.role,
      })
      setTeamData(teamData.map(m => (m.id === editMember.id ? editMember : m)))
      setEditMember(null)
    } catch (err) {
      console.error("Error editing member:", err)
    }
  }

  // Delete member
  const handleDeleteMember = async (id: string) => {
    try {
      await deleteDoc(doc(db, "teamMembers", id))
      setTeamData(teamData.filter(member => member.id !== id))
    } catch (err) {
      console.error("Error deleting member:", err)
    }
  }

  // Toggle Active / Inactive
  const handleStatusToggle = async (id: string) => {
    const member = teamData.find(m => m.id === id)
    if (!member) return

    const newStatus = member.status === "Active" ? "Inactive" : "Active"
    try {
      await updateDoc(doc(db, "teamMembers", id), { status: newStatus })
      setTeamData(teamData.map(m => (m.id === id ? { ...m, status: newStatus } : m)))
    } catch (err) {
      console.error("Error updating status:", err)
    }
  }

  //Reporting feature
  //REPORT HELPERS 
  const openReport = (member: Member) => {
    setReportTarget(member); // Member | null
    setReportForm({ reason: "Incorrect role", details: "" });
    setReportOpen(true);     // opens the "Create report" dialog
  };

  const submitReport = async () => {
  if (!reportTarget || !userSession) return
  try {
    await addDoc(collection(db, "userReports"), {
      reportedUserId: reportTarget.id,
      reportedUserName: reportTarget.name,
      reportedUserEmail: reportTarget.email.toLowerCase().trim(),
      reportedUserRole: reportTarget.role,

      reporterEmail: userSession.email.toLowerCase().trim(),
      reporterName: userSession.name,
      reporterRole: userSession.role,

      reason: reportForm.reason,
      details: reportForm.details,
      status: "Submitted",
      createdAt: serverTimestamp(),
    })
    setReportOpen(false)
    alert("Report submitted. Thank you!")
  } catch (e) {
    console.error("Report failed:", e)
    alert("Failed to submit report.")
  }
  }

  const openReportDialog = (r: Report) => {
  setActiveReport(r)
  setReportEdit({ reason: r.reason, details: r.details, status: r.status })
  setReportDialogOpen(true)
  }

  const saveReportEdits = async () => {
    if (!activeReport) return
    try {
      const ref = doc(db, "userReports", activeReport.id)
      // Non-admin: can edit reason/details only
      // Admin: can change status (and may also update reason/details if you want—here we keep it status-only for admin)
      if (isAdmin) {
        await updateDoc(ref, { status: reportEdit.status })
        setReports(prev => prev.map(r => r.id === activeReport.id ? { ...r, status: reportEdit.status as Report["status"] } : r))
      } else {
        await updateDoc(ref, { reason: reportEdit.reason, details: reportEdit.details })
        setReports(prev => prev.map(r => r.id === activeReport.id ? { ...r, reason: reportEdit.reason, details: reportEdit.details } : r))
      }
      setReportDialogOpen(false)
    } catch (e) {
      console.error("Failed to update report:", e)
      alert("Failed to update report")
    }
  }



  // Show loading state while checking authorization
  if (userSession === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0f4d92] mx-auto mb-4"></div>
          <p>Checking permissions...</p>
        </div>
      </div>
    )
  }

  // Show access denied for BCDR users
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="bg-[#0f4d92] text-white p-4">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild className="text-white">
                <Link href="/dashboard">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
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
                  BCDR members do not have access to Team Management functionality.
                </AlertDescription>
              </Alert>
              
              <p className="text-muted-foreground">
                Your current role is <Badge variant="outline">{userSession?.role}</Badge>. 
                Only Admin and Welcoming Team members can access team management features.
              </p>
              
              <p className="text-sm text-muted-foreground">
                If you believe this is an error, please contact your administrator.
              </p>

              <div className="pt-4">
                <Button asChild className="w-full">
                  <Link href="/dashboard">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Return to Dashboard
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // Show team management page for authorized users
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[#0f4d92] text-white p-4 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="text-white">
              <Link href="/dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">{isAdmin ? "Team Management" : "My Team"}</h1>
              <p className="text-xs opacity-75">Logged in as: {userSession?.name} ({userSession?.role})</p>
            </div>
          </div>

          {/* Add Member Dialog */}
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
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={newMember.name}
                      onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newMember.email}
                      onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={newMember.role} onValueChange={value => setNewMember({ ...newMember, role: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
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
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              
              {displayedMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${member.name}`} />
                      <AvatarFallback className="bg-[#0f4d92] text-white">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{member.role}</Badge>
                        <Badge variant={member.status === "Active" ? "default" : "secondary"}>
                          {member.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {isAdmin && (
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
                                <Label htmlFor="edit-name">Full Name</Label>
                                <Input
                                  id="edit-name"
                                  value={editMember.name}
                                  onChange={e => setEditMember({ ...editMember, name: e.target.value })}
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="edit-email">Email</Label>
                                <Input
                                  id="edit-email"
                                  type="email"
                                  value={editMember.email}
                                  onChange={e => setEditMember({ ...editMember, email: e.target.value })}
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="edit-role">Role</Label>
                                <Select
                                  value={editMember.role}
                                  onValueChange={value => setEditMember({ ...editMember, role: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select role" />
                                  </SelectTrigger>
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

                      {/* Toggle Status */}
                      <Button variant="ghost" size="icon" onClick={() => handleStatusToggle(member.id)}>
                        <Badge variant={member.status === "Active" ? "destructive" : "default"}>
                          {member.status === "Active" ? "Deactivate" : "Activate"}
                        </Badge>
                      </Button>

                      {/* Delete */}
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteMember(member.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {/* Actions for non-admins: Report only */}
                  {!isAdmin && (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openReport(member)}>
                        Report
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        {/* FEEDBACK HUB */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{isAdmin ? "Reports (All Users)" : "Feedback Hub"}</CardTitle>
          </CardHeader>
          <CardContent>
            {reportsLoading ? (
              <p className="text-sm text-muted-foreground">Loading reports…</p>
            ) : reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isAdmin ? "No reports have been filed yet." : "You haven't submitted any reports yet."}
              </p>
            ) : (
              <div className="space-y-3">
                {reports.map(r => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between border rounded-md p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={r.status === "Submitted" ? "default" : "outline"}>{r.status}</Badge>
                        <span className="text-sm text-muted-foreground">{fmtDate(r.createdAt)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Filed on:</span> {r.reportedUserName} ({r.reportedUserRole})
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Issue:</span> {r.reason}
                      </div>
                      {isAdmin && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Filed by:</span> {r.reporterName} &lt;{r.reporterEmail}&gt; ({r.reporterRole})
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => openReportDialog(r)}>
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report {reportTarget?.name}</DialogTitle>
              <DialogDescription>Tell us what’s wrong. This will notify admins to review.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="reason">Reason</Label>
                <Select
                  value={reportForm.reason}
                  onValueChange={(v) => setReportForm(p => ({ ...p, reason: v }))}
                >
                  <SelectTrigger id="reason">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Negligence">Negligence</SelectItem>
                    <SelectItem value="User left team">User left team</SelectItem>
                    <SelectItem value="Misconduct/abuse">Misconduct/abuse</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="details">Details (optional)</Label>
                <textarea
                  id="details"
                  className="min-h-[120px] border rounded-md p-2"
                  value={reportForm.details}
                  onChange={(e) => setReportForm(p => ({ ...p, details: e.target.value }))}
                  placeholder="Add any context that will help admins review"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
              <Button onClick={submitReport}>Submit Report</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isAdmin ? "Report Details" : "Edit Your Report"}
              </DialogTitle>
              <DialogDescription>
                {activeReport
                  ? `Report on ${activeReport.reportedUserName} · ${fmtDate(activeReport.createdAt)}`
                  : ""}
              </DialogDescription>
            </DialogHeader>

            {activeReport && (
              <div className="grid gap-4 py-2">
                {/* Common info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Filed on</div>
                    <div>{activeReport.reportedUserName} ({activeReport.reportedUserRole})</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Status</div>
                    {isAdmin ? (
                      <Select
                        value={reportEdit.status}
                        onValueChange={(v) => setReportEdit(p => ({ ...p, status: v as Report["status"] }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Submitted">Submitted</SelectItem>
                          <SelectItem value="Under Review">Under Review</SelectItem>
                          <SelectItem value="Resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={activeReport.status === "Submitted" ? "default" : "outline"}>
                        {activeReport.status}
                      </Badge>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="col-span-2">
                      <div className="text-muted-foreground">Filed by</div>
                      <div>{activeReport.reporterName} &lt;{activeReport.reporterEmail}&gt; ({activeReport.reporterRole})</div>
                    </div>
                  )}
                </div>

                {/* Editable fields for non-admins */}
                {!isAdmin && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="report-reason">Issue Type</Label>
                      <Select
                        value={reportEdit.reason}
                        onValueChange={(v) => setReportEdit(p => ({ ...p, reason: v }))}
                      >
                        <SelectTrigger id="report-reason">
                          <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Incorrect role">Incorrect role</SelectItem>
                          <SelectItem value="User left team">User left team</SelectItem>
                          <SelectItem value="Misconduct/abuse">Misconduct/abuse</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="report-details">Details</Label>
                      <textarea
                        id="report-details"
                        className="min-h-[120px] border rounded-md p-2"
                        value={reportEdit.details}
                        onChange={(e) => setReportEdit(p => ({ ...p, details: e.target.value }))}
                        placeholder="Add more context…"
                      />
                    </div>
                  </>
                )}

                {/* Read-only preview for Admin (optional) */}
                {isAdmin && (
                  <div className="grid gap-2">
                    <Label>Submitted Details</Label>
                    <div className="text-sm whitespace-pre-wrap border rounded-md p-3 bg-muted/30">
                      <div className="mb-1"><span className="font-medium">Issue:</span> {activeReport.reason}</div>
                      <div><span className="font-medium">Details:</span> {activeReport.details || "—"}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Close</Button>
              <Button onClick={saveReportEdits}>
                {isAdmin ? "Save Status" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}