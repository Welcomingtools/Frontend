"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, UserPlus, Edit, Trash2 } from "lucide-react"
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

// Mock team data
const initialTeamData = [
  { id: 1, name: "John Doe", email: "john.doe@wits.ac.za", role: "Admin", status: "Active" },
  { id: 2, name: "Jane Smith", email: "jane.smith@wits.ac.za", role: "TLA", status: "Active" },
  { id: 3, name: "Mike Johnson", email: "mike.johnson@wits.ac.za", role: "TLA", status: "Active" },
  { id: 4, name: "Sarah Williams", email: "sarah.williams@wits.ac.za", role: "TLA", status: "Inactive" },
  { id: 5, name: "David Brown", email: "david.brown@wits.ac.za", role: "TLA", status: "Active" },
]

export default function TeamPage() {
  const [teamData, setTeamData] = useState(initialTeamData)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newMember, setNewMember] = useState({ name: "", email: "", role: "TLA" })
  const [editMember, setEditMember] = useState<null | { id: number; name: string; email: string; role: string }>(null)

  const handleAddMember = () => {
    if (newMember.name && newMember.email) {
      setTeamData([
        ...teamData,
        {
          id: teamData.length + 1,
          name: newMember.name,
          email: newMember.email,
          role: newMember.role,
          status: "Active",
        },
      ])
      setNewMember({ name: "", email: "", role: "TLA" })
      setIsAddDialogOpen(false)
    }
  }

  const handleEditMember = () => {
    if (editMember) {
      setTeamData(teamData.map((member) => (member.id === editMember.id ? { ...member, ...editMember } : member)))
      setEditMember(null)
    }
  }

  const handleDeleteMember = (id: number) => {
    setTeamData(teamData.filter((member) => member.id !== id))
  }

  const handleStatusToggle = (id: number) => {
    setTeamData(
      teamData.map((member) =>
        member.id === id ? { ...member, status: member.status === "Active" ? "Inactive" : "Active" } : member,
      ),
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[#0f4d92] text-white p-4 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="text-white">
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-xl font-bold">Team Management</h1>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-white text-[#0f4d92] hover:bg-gray-100">
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>Add a new Technical Laboratory Assistant to the team.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={newMember.name}
                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newMember.email}
                    onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    placeholder="Enter Wits email address"
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
                      <SelectItem value="TLA">TLA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddMember}>Add Member</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamData.map((member) => (
                <div key={member.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={`/placeholder.svg?height=40&width=40`} />
                      <AvatarFallback>
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{member.role}</Badge>
                        <Badge
                          variant={member.status === "Active" ? "default" : "secondary"}
                          className={member.status === "Active" ? "bg-green-600" : ""}
                        >
                          {member.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                                onChange={(e) => setEditMember({ ...editMember, name: e.target.value })}
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
                                  <SelectItem value="TLA">TLA</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setEditMember(null)}>
                            Cancel
                          </Button>
                          <Button onClick={handleEditMember}>Save Changes</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="icon" onClick={() => handleStatusToggle(member.id)}>
                      <Badge
                        variant={member.status === "Active" ? "destructive" : "default"}
                        className={member.status !== "Active" ? "bg-green-600" : ""}
                      >
                        {member.status === "Active" ? "Deactivate" : "Activate"}
                      </Badge>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => handleDeleteMember(member.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
