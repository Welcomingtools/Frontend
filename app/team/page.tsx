"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, UserPlus, Edit, Trash2, Shield, AlertTriangle, User, Loader2, CheckCircle } from "lucide-react"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from "@supabase/supabase-js";

import { toast } from "sonner"

type Member = {
  id: string
  name: string
  surname: string
  email: string
  role: string
  status: "Active" | "Inactive"
  password: string
  created_at: string  // Add this
  updated_at: string  // Add this
}

type UserSession = {
  email: string
  name: string
  surname:string
  role: string
  loginTime: string
  accountType: string
}

type Report = {
  id: string
  reported_user_id: string
  reported_user_name: string
  reported_user_email: string
  reported_user_role: string
  reporter_email: string
  reporter_name: string
  reporter_role: string
  reason: string
  details: string
  status: "Submitted" | "Resolved" | "Under Review"
  created_at: string
  updated_at: string
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
  const [newMember, setNewMember] = useState({ name: "",surname: "",  email: "", role: "Welcoming Team" })
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [reportOpen, setReportOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState<Member | null>(null)
  const [reportForm, setReportForm] = useState({ reason: "", details: "" })
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const [reportSubmissionStatus, setReportSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  
  const isAdmin = userSession?.role === "Admin"
  const isBCDR = userSession?.role === "BCDR"
  const isWelcoming = userSession?.role === "Welcoming Team"
  
  //For add members
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ name: string; email: string; role: string; password:string } | null>(null);

  // Filtered list of members to display
  const displayedMembers = isAdmin
    ? teamData
    : teamData.filter(m => m.role === userSession?.role)

  // Feedback Hub state
  const [reports, setReports] = useState<Report[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)

  // Dialog state for viewing/editing a report
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [activeReport, setActiveReport] = useState<Report | null>(null)

  // Local form for editing
  const [reportEdit, setReportEdit] = useState({ reason: "", details: "", status: "Submitted" as Report["status"] })
  const [reportError, setReportError] = useState<string | null>(null)

  // Date formatter
  const fmtDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return "—"
    }
  }

  // Check user authorization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sessionData = sessionStorage.getItem('userSession')
      if (!sessionData) {
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

  // Fetch members from Supabase
  useEffect(() => {
    if (!isAuthorized) return

    const fetchMembers = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // For non-admin users, we'll filter by role in the frontend
        // since RLS policies might not allow them to query all data
        const { data, error } = await supabase
          .from('user')
          .select('*')

        if (error) {
          console.error("Error fetching members:", error)
          setError("Failed to fetch team members: " + error.message)
          return
        }

        if (!data) {
          setTeamData([])
          return
        }

        const members = data.map(row => ({
          id: row.id,
          name: row.name,
          surname: row.surname,
          email: row.email,
          role: row.role,
          status: row.status as "Active" | "Inactive",
          password: row.password,
          created_at: row.created_at || new Date().toISOString(), // Add this
          updated_at: row.updated_at || new Date().toISOString()  // Add this
        }))

        setTeamData(members)
      } catch (error) {
        console.error("Error fetching members:", error)
        setError("An unexpected error occurred while fetching team members")
      } finally {
        setLoading(false)
      }
    }

    fetchMembers()
  }, [isAuthorized])

  // Fetching Reports with real-time subscription
  useEffect(() => {
    if (!userSession) return

    setReportsLoading(true)
    const userEmail = (userSession.email || "").toLowerCase().trim()

    // Function to fetch reports
    const fetchReports = async () => {
      try {
        let query = supabase
          .from('incident')
          .select('*')
          .order("created_at", { ascending: false });

        if (!isAdmin) {
          query = query.eq('reporter_email', userEmail)
        }

        const { data, error } = await query

        if (error) {
          console.error("Error fetching reports:", error)
          setReportsLoading(false)
          return
        }

        setReports(data || [])
        setReportsLoading(false)
      } catch (error) {
        console.error("Error fetching reports:", error)
        setReportsLoading(false)
      }
    }

    // Initial fetch
    fetchReports()

    // Set up real-time subscription using the new API
    let channel: RealtimeChannel

    if (isAdmin) {
      // Admin sees all reports
      channel = supabase
        .channel('admin-reports')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'incident'
          },
          (payload) => {
            console.log('Reports changed:', payload)
            fetchReports()
          }
        )
        .subscribe()
    } else {
      // Non-admin sees only their own reports
      channel = supabase
        .channel('user-reports')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'incident',
            filter: `reporter_email=eq.${userEmail}`
          },
          (payload) => {
            console.log('Reports changed:', payload)
            fetchReports()
          }
        )
        .subscribe()
    }

    // Cleanup subscription
    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [isAdmin, userSession?.email])

  // Add new member
  const handleAddMember = async () => {
    if (!newMember.name?.trim() || !newMember.email?.trim()) return;

    try {
      setLoading(true);
      setError(null); // Clear previous errors
      
      const res = await fetch("/api/team/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMember.name.trim(),
          surname: newMember.surname.trim(),
          email: newMember.email.trim(),
          role: newMember.role,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        // Show error but keep the dialog open so user can fix the issue
        if (data.existing) {
          setError(`User with email ${newMember.email.trim()} already exists.`);
        } else {
          setError(data.error || "Failed to add team member");
        }
        return; // Don't close dialog on error
      }

      // SUCCESS: Refresh the members list
      const { data: membersData } = await supabase
        .from("user")
        .select("id, name, surname, email, role, status, password")
        .order("name");

       if (membersData) {
        const now = new Date().toISOString()
      const members = membersData.map(row => ({
        id: row.id,
        name: row.name,
        surname: row.surname || "",
        email: row.email,
        role: row.role,
        status: (row.status as "Active" | "Inactive") ?? "Active",
        password: row.password,
         created_at: now, 
        updated_at: now,
      }));
      setTeamData(members);
    }

      // Show success dialog
      setCreatedInfo({
        name: newMember.name.trim(),
        email: newMember.email.trim(),
        role: newMember.role,
        password: "Sent via email"
      });
      setIsSuccessOpen(true);

      // Reset form and CLOSE the Add Member dialog
      setNewMember({ name: "", surname: "",  email: "", role: "Welcoming Team" });
      setIsAddDialogOpen(false); // This closes the dialog

    } catch (err: any) {
      console.error("Add member error:", err);
      setError("An unexpected error occurred");
      // Keep dialog open on unexpected errors too
    } finally {
      setLoading(false);
    }
  };

  // Edit existing member
  const handleEditMember = async () => {
    if (!editMember) return

    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('user')
        .update({
          name: editMember.name,
          email: editMember.email,
          role: editMember.role,
          updated_at: now,
        })
        .eq('id', editMember.id)

      if (error) {
        console.error("Error editing member:", error)
        alert("Failed to update member: " + error.message)
        return
      }

      setTeamData(teamData.map(m => (m.id === editMember.id ? editMember : m)))
      setEditMember(null)
    } catch (err) {
      console.error("Error editing member:", err)
      alert("Failed to update member")
    }
  }

  // Delete member
  const handleDeleteMember = async (id: string) => {
    if (!confirm("Are you sure you want to delete this team member?")) return
    
    try {
      const { error } = await supabase
        .from('user')
        .delete()
        .eq('id', id)

      if (error) {
        console.error("Error deleting member:", error)
        alert("Failed to delete member: " + error.message)
        return
      }

      setTeamData(teamData.filter(member => member.id !== id))
    } catch (err) {
      console.error("Error deleting member:", err)
      alert("Failed to delete member")
    }
  }

  // Toggle Active / Inactive
  const handleStatusToggle = async (id: string) => {
    const member = teamData.find(m => m.id === id)
    if (!member) return

    const newStatus = member.status === "Active" ? "Inactive" : "Active"
    
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('user')
        .update({ status: newStatus, updated_at: now })
        .eq('id', id)

      if (error) {
        console.error("Error updating status:", error)
        alert("Failed to update status: " + error.message)
        return
      }

      setTeamData(teamData.map(m => (m.id === id ? { ...m, status: newStatus } : m)))
    } catch (err) {
      console.error("Error updating status:", err)
      alert("Failed to update status")
    }
  }

  // Reporting feature
  const openReport = (member: Member) => {
    setReportTarget(member)
    setReportForm({ reason: "", details: "" })
    setReportError(null)
    setReportSubmissionStatus('idle')
    setReportOpen(true)
  }

  const submitReport = async () => {
    if (!reportTarget || !userSession) return

    if (!reportForm.reason || reportForm.reason.trim() === "") {
      setReportError("Please select a reason before submitting.")
      return
    }

    setReportError(null)
    setIsSubmittingReport(true)
    setReportSubmissionStatus("idle")

    try {
      toast.info("Submitting your report...")

      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from("incident")
        .insert([
          {
            reported_user_id: reportTarget.id,
            reported_user_name: reportTarget.name,
            reported_user_email: reportTarget.email.toLowerCase().trim(),
            reported_user_role: reportTarget.role,
            reporter_email: userSession.email.toLowerCase().trim(),
            reporter_name: userSession.name,
            reporter_role: userSession.role,
            reason: reportForm.reason,
            details: reportForm.details,
            status: "Submitted",
            created_at: now,
            updated_at: now,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: (error as any).code,
        });
        setReportError(error?.message || "Something went wrong while submitting the report.");
        return;
      }

      if (data) {
        setReports(prev => [data as Report, ...prev])
        setReportSubmissionStatus("success")
        toast.success("Report submitted successfully! Thank you for your feedback.")

        setTimeout(() => {
          setReportOpen(false)
          setReportForm({ reason: "", details: "" })
          setReportSubmissionStatus("idle")
        }, 1500)
      }
    } catch (e) {
      console.error("Report failed:", e)
      setReportSubmissionStatus("error")
      toast.error("Failed to submit report. Please try again.")
    } finally {
      setIsSubmittingReport(false)
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
      let updateData: any = {}
      
      if (isAdmin) {
        updateData.status = reportEdit.status
      } else {
        updateData.reason = reportEdit.reason
        updateData.details = reportEdit.details
      }

      const { error } = await supabase
        .from('incident')
        .update(updateData)
        .eq('id', activeReport.id)

      if (error) {
        console.error("Failed to update report:", error)
        alert("Failed to update report: " + error.message)
        return
      }

      // Update local state
      setReports(prev => prev.map(r => 
        r.id === activeReport.id 
          ? { ...r, ...updateData }
          : r
      ))
      
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

  // Show access denied for unauthorized users
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="bg-[#000068] text-white p-4">
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
                    <ArrowLeft className="h-5 w-5 text-white group-hover:text-white" />
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
      <header className="bg-gradient-to-r from-[#000068] to-[#1e5fa8] text-white **h-20** flex **items-center** p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="text-white hover:bg-white/10">
              <Link href="/dashboard">
                <ArrowLeft className="h-5 w-5 text-white group-hover:text-white" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">{isAdmin ? "Team Management" : "My Team"}</h1>
              <p className="text-xs opacity-75">Logged in as: {userSession?.name} {userSession?.surname} ({userSession?.role})</p>
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
                
                {/* Error Display inside Dialog */}
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <div className="grid gap-4 py-4">
                  {/* Name Field */}
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={newMember.name}
                      onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                      placeholder="Enter name"
                    />
                  </div>
                  
                  {/* Surname Field - ADD THIS */}
                  <div className="grid gap-2">
                    <Label htmlFor="surname">Surname</Label>
                    <Input
                      id="surname"
                      value={newMember.surname}
                      onChange={e => setNewMember({ ...newMember, surname: e.target.value })}
                      placeholder="Enter surname"
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
                    <Select value={newMember.role} onValueChange={(value) => setNewMember({ ...newMember, role: value })}>
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
                  <Button variant="outline" onClick={() => {
                    setIsAddDialogOpen(false);
                    setError(null);
                    setNewMember({ name: "", surname: "", email: "", role: "Welcoming Team" }); // Update reset
                  }}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddMember} 
                    disabled={loading}
                    className="flex items-center gap-2 bg-[#000068] hover:bg-[#030384]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Member"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog> 
            )}
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#0f4d92]" />
                <span className="ml-2">Loading team members...</span>
              </div>
            ) : displayedMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No team members found.
              </div>
            ) : (
              <div className="space-y-4">
                {displayedMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${member.name}`} />
                        <AvatarFallback className="bg-[#0f4d92] text-white">
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.name} {member.surname}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{member.role}</Badge>
                          <Badge variant={member.status === "Active" ? "default" : "secondary"}>
                            {member.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Actions for Admins */}
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
                                  <Label htmlFor="edit-name">Surname</Label>
                                  <Input
                                    id="edit-name"
                                    value={editMember.name}
                                    onChange={e => setEditMember({ ...editMember, surname: e.target.value })}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-email">Email</Label>
                                  <Input
                                    id="edit-email"
                                    type="email"
                                    value={editMember.email}
                                    onChange={(e) => setEditMember({ ...editMember, email: e.target.value })}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor="edit-role">Role</Label>
                                  <Select
                                    value={editMember.role}
                                    onValueChange={(value) => setEditMember({ ...editMember, role: value })}
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
                    {/* Actions for non-admins: Report only (exclude self) */}
                    {!isAdmin && userSession?.email.toLowerCase().trim() !== member.email.toLowerCase().trim() && (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="border-[#0f4d92] text-[#0f4d92] hover:bg-[#0f4d92]/10" onClick={() => openReport(member)}>
                          Report
                        </Button>
                      </div>
                    )}
                    
                    {/* Show message for current user */}
                    {!isAdmin && userSession?.email.toLowerCase().trim() === member.email.toLowerCase().trim() && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-muted-foreground">
                          You
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* FEEDBACK HUB */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{isAdmin ? "Reports (All Users)" : "Feedback Hub"}</CardTitle>
          </CardHeader>
          <CardContent>
            {reportsLoading ? (
              <div className="flex justify-center items-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-[#0f4d92] mr-2" />
                <span>Loading reports…</span>
              </div>
            ) : reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isAdmin ? "No reports have been filed yet." : "You haven't submitted any reports yet."}
              </p>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between border rounded-md p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={r.status === "Submitted" ? "default" : "outline"}>{r.status}</Badge>
                        <span className="text-sm text-muted-foreground">{fmtDate(r.created_at)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Filed on:</span> {r.reported_user_name} ({r.reported_user_role})
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Issue:</span> {r.reason}
                      </div>
                      {isAdmin && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Filed by:</span> {r.reporter_name} &lt;{r.reporter_email}&gt; ({r.reporter_role})
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

        {/* Report Creation Dialog with Enhanced UX */}
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report {reportTarget?.name}</DialogTitle>
              <DialogDescription>Tell us what's wrong. This will notify admins to review.</DialogDescription>
            </DialogHeader>

            {/* Success/Error States */}
            {reportSubmissionStatus === 'success' && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Report submitted successfully! Your feedback has been recorded and will be reviewed by administrators.
                </AlertDescription>
              </Alert>
            )}

            {reportSubmissionStatus === 'error' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Failed to submit report. Please try again or contact support if the problem persists.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="reason">Reason <span className="text-red-500">*</span></Label>
                <Select
                  value={reportForm.reason}
                  onValueChange={(v) => setReportForm(p => ({ ...p, reason: v }))}
                  disabled={isSubmittingReport || reportSubmissionStatus === 'success'}
                >
                  <SelectTrigger id="reason" aria-invalid={!!reportError}>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Negligence">Negligence</SelectItem>
                    <SelectItem value="Lateness/Absenteeism">Lateness/Absenteeism</SelectItem>
                    <SelectItem value="Misconduct/abuse">Misconduct/abuse</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {reportError && <p className="text-sm text-red-500">{reportError}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="details">Details (optional)</Label>
                <textarea
                  id="details"
                  className="min-h-[120px] border rounded-md p-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  value={reportForm.details}
                  onChange={(e) => setReportForm(p => ({ ...p, details: e.target.value }))}
                  placeholder="Add any context that will help admins review"
                  disabled={isSubmittingReport || reportSubmissionStatus === 'success'}
                />
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setReportOpen(false)}
                disabled={isSubmittingReport}
              >
                {reportSubmissionStatus === 'success' ? 'Close' : 'Cancel'}
              </Button>
              
              {reportSubmissionStatus !== 'success' && (
                <Button 
                  onClick={submitReport} 
                  disabled={isSubmittingReport || !reportForm.reason}
                  className="min-w-[140px]"
                >
                  {isSubmittingReport ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Report'
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Report Details Dialog */}
        <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isAdmin ? "Report Details" : "Edit Your Report"}
              </DialogTitle>
              <DialogDescription>
                {activeReport
                  ? `Report on ${activeReport.reported_user_name} · ${fmtDate(activeReport.created_at)}`
                  : ""}
              </DialogDescription>
            </DialogHeader>

            {activeReport && (
              <div className="grid gap-4 py-2">
                {/* Common info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Filed on</div>
                    <div>{activeReport.reported_user_name} ({activeReport.reported_user_role})</div>
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
                      <div>{activeReport.reporter_name} &lt;{activeReport.reporter_email}&gt; ({activeReport.reporter_role})</div>
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
                          <SelectItem value="Negligence">Negligence</SelectItem>
                          <SelectItem value="Lateness/Absenteeism">Lateness/Absenteeism</SelectItem>
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

                {/* Read-only preview for Admin */}
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

        {/* For Login Notification */}
        <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-green-700">Team member created</DialogTitle>
              <DialogDescription>
                We’ve emailed your password to <span className="font-medium">{createdInfo?.email}</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Full name</span>
                <span className="font-medium">{createdInfo?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="font-medium">{createdInfo?.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Role</span>
                <span className="font-medium">{createdInfo?.role}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                For security, the password is not shown here.
              </p>
            </div>

            <DialogFooter className="mt-4">
              <Button onClick={() => setIsSuccessOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}