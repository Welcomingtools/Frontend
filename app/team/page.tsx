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
} from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, UserPlus, Edit, Trash2, Shield, AlertTriangle } from "lucide-react"
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

  //NEW 28/08
  const isAdmin = userSession?.role === "Admin"
  const isBCDR = userSession?.role === "BCDR"
  const isWelcoming = userSession?.role === "Welcoming Team"

  // NEW 28/08 Filtered list of members to display
  const displayedMembers = isAdmin
  ? teamData
  : teamData.filter(m => m.role === userSession?.role)

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
                    <Avatar>
                      <AvatarImage src={`/placeholder.svg?height=40&width=40`} />
                      <AvatarFallback>
                        {member.name.split(" ").map(n => n[0]).join("")}
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}