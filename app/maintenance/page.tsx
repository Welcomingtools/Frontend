"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, AlertTriangle, Search } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

// Issue categories
const issueCategories = [
  { id: "hardware", name: "Hardware" },
  { id: "software", name: "Software" },
  { id: "network", name: "Network" },
  { id: "peripheral", name: "Peripheral" },
  { id: "power", name: "Power" },
  { id: "other", name: "Other" },
]

// Issue severity levels
const severityLevels = [
  { id: "critical", name: "Critical", color: "bg-red-100 text-red-800" },
  { id: "high", name: "High", color: "bg-orange-100 text-orange-800" },
  { id: "medium", name: "Medium", color: "bg-yellow-100 text-yellow-800" },
  { id: "low", name: "Low", color: "bg-blue-100 text-blue-800" },
]

// Issue status options
const statusOptions = [
  { id: "reported", name: "Reported", color: "bg-blue-100 text-blue-800" },
  { id: "in-progress", name: "In Progress", color: "bg-yellow-100 text-yellow-800" },
  { id: "resolved", name: "Resolved", color: "bg-green-100 text-green-800" },
]

// Issue interface for type safety
interface Issue {
  id: number
  lab: string
  title: string
  description: string
  category: string
  severity: string
  status: string
  reportedBy: string
  reportedAt: string
  assignedTo: string | null
  updatedAt: string | null
  machineId: string
}

// Mock data for maintenance issues
const initialIssues: Issue[] = [
  {
    id: 1,
    lab: "004",
    title: "Projector not working",
    description: "The main projector in Lab 004 is not displaying any image. Power light is on but no signal.",
    category: "hardware",
    severity: "high",
    status: "in-progress",
    reportedBy: "John Doe",
    reportedAt: "2023-05-05T10:30:00",
    assignedTo: "Maintenance Team",
    updatedAt: "2023-05-05T14:15:00",
    machineId: "PC-004-12",
  },
  {
    id: 2,
    lab: "002",
    title: "Network connectivity issues",
    description: "Several computers in Lab 002 are experiencing intermittent network connectivity issues.",
    category: "network",
    severity: "medium",
    status: "reported",
    reportedBy: "Jane Smith",
    reportedAt: "2023-05-06T09:15:00",
    assignedTo: null,
    updatedAt: null,
    machineId: "Multiple",
  },
  {
    id: 3,
    lab: "001",
    title: "Software installation failure",
    description: "Unable to install required software package on machines in Lab 001. Error code: 0x80070643",
    category: "software",
    severity: "medium",
    status: "resolved",
    reportedBy: "Mike Johnson",
    reportedAt: "2023-05-04T11:20:00",
    assignedTo: "IT Support",
    updatedAt: "2023-05-06T16:45:00",
    machineId: "All machines",
  },
  {
    id: 4,
    lab: "003",
    title: "Keyboard not working",
    description: "Keyboard on station 15 is not responding. Tried different USB ports but still not working.",
    category: "peripheral",
    severity: "low",
    status: "resolved",
    reportedBy: "Sarah Williams",
    reportedAt: "2023-05-05T13:10:00",
    assignedTo: "Lab Support",
    updatedAt: "2023-05-05T15:30:00",
    machineId: "PC-003-15",
  },
  {
    id: 5,
    lab: "007",
    title: "Power outage in section",
    description: "The back row of Lab 007 (stations 60-72) has no power. Circuit breaker may have tripped.",
    category: "power",
    severity: "critical",
    status: "in-progress",
    reportedBy: "David Brown",
    reportedAt: "2023-05-06T08:45:00",
    assignedTo: "Facilities Management",
    updatedAt: "2023-05-06T09:30:00",
    machineId: "Stations 60-72",
  },
]

export default function MaintenancePage() {
  // Load issues from localStorage on component mount, fallback to initialIssues
  const [issues, setIssues] = useState<Issue[]>(() => {
    if (typeof window !== 'undefined') {
      const savedIssues = localStorage.getItem('maintenanceIssues')
      return savedIssues ? JSON.parse(savedIssues) : initialIssues
    }
    return initialIssues
  })
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [statusFilter, setStatusFilter] = useState("all")
  const [labFilter, setLabFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()

  // New issue form state
  const [newIssue, setNewIssue] = useState({
    lab: "",
    title: "",
    description: "",
    category: "",
    severity: "medium",
    machineId: "",
  })

  // Navigate back to dashboard
  const handleBackToDashboard = () => {
    router.push("/dashboard") // Change this to your actual dashboard route
  }

  // Filter issues based on selected filters and search query
  const filteredIssues = issues.filter((issue) => {
    // Apply status filter
    if (statusFilter !== "all" && issue.status !== statusFilter) {
      return false
    }

    // Apply lab filter
    if (labFilter !== "all" && issue.lab !== labFilter) {
      return false
    }

    // Apply category filter
    if (categoryFilter !== "all" && issue.category !== categoryFilter) {
      return false
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        issue.title.toLowerCase().includes(query) ||
        issue.description.toLowerCase().includes(query) ||
        issue.machineId.toLowerCase().includes(query)
      )
    }

    return true
  })

  // Handle form changes
  const handleFormChange = (field: string, value: string) => {
    setNewIssue({
      ...newIssue,
      [field]: value,
    })
  }

  // Handle issue creation
  const handleCreateIssue = () => {
    if (newIssue.lab && newIssue.title && newIssue.description && newIssue.category && newIssue.severity) {
      const newIssueObj: Issue = {
        id: issues.length + 1,
        ...newIssue,
        status: "reported",
        reportedBy: "You",
        reportedAt: new Date().toISOString(),
        assignedTo: null,
        updatedAt: null,
      }
      const updatedIssues = [newIssueObj, ...issues]
      setIssues(updatedIssues)
      
      // Save to localStorage
      localStorage.setItem('maintenanceIssues', JSON.stringify(updatedIssues))
      
      setIsAddDialogOpen(false)
      // Reset form
      setNewIssue({
        lab: "",
        title: "",
        description: "",
        category: "",
        severity: "medium",
        machineId: "",
      })
    }
  }

  // Handle viewing issue details
  const handleViewIssue = (issue: Issue) => {
    setSelectedIssue(issue)
    setIsViewDialogOpen(true)
  }

  // Handle updating issue status
  const handleUpdateStatus = (issueId: number, newStatus: string) => {
    const updatedIssues = issues.map((issue) =>
      issue.id === issueId
        ? {
            ...issue,
            status: newStatus,
            updatedAt: new Date().toISOString(),
            assignedTo: newStatus === "in-progress" ? "Maintenance Team" : issue.assignedTo,
          }
        : issue,
    )
    setIssues(updatedIssues)
    
    // Save to localStorage
    localStorage.setItem('maintenanceIssues', JSON.stringify(updatedIssues))
    
    setIsViewDialogOpen(false)
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    const statusOption = statusOptions.find((option) => option.id === status)
    return statusOption ? statusOption.color : "bg-gray-100 text-gray-800"
  }

  // Get severity badge color
  const getSeverityColor = (severity: string) => {
    const severityLevel = severityLevels.find((level) => level.id === severity)
    return severityLevel ? severityLevel.color : "bg-gray-100 text-gray-800"
  }

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleString()
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
            <h1 className="text-xl font-bold">Maintenance Issues</h1>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-white text-[#0f4d92] hover:bg-gray-100">
                <Plus className="h-4 w-4 mr-2" />
                Report Issue
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Report Maintenance Issue</DialogTitle>
                <DialogDescription>Report a new maintenance issue for a lab.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="lab">Lab</Label>
                    <Select value={newIssue.lab} onValueChange={(value) => handleFormChange("lab", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select lab" />
                      </SelectTrigger>
                      <SelectContent>
                        {labsData.map((lab) => (
                          <SelectItem key={lab.id} value={lab.id}>
                            Lab {lab.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="machineId">Machine ID</Label>
                    <Input
                      id="machineId"
                      placeholder="e.g., PC-001-15 or 'All'"
                      value={newIssue.machineId}
                      onChange={(e) => handleFormChange("machineId", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="title">Issue Title</Label>
                  <Input
                    id="title"
                    placeholder="Brief description of the issue"
                    value={newIssue.title}
                    onChange={(e) => handleFormChange("title", e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Detailed Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Provide details about the issue"
                    value={newIssue.description}
                    onChange={(e) => handleFormChange("description", e.target.value)}
                    required
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={newIssue.category} onValueChange={(value) => handleFormChange("category", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {issueCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="severity">Severity</Label>
                    <Select value={newIssue.severity} onValueChange={(value) => handleFormChange("severity", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        {severityLevels.map((level) => (
                          <SelectItem key={level.id} value={level.id}>
                            {level.name}
                          </SelectItem>
                        ))}
                      </SelectContent>  
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateIssue}>Report Issue</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle>Filter Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search issues..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lab-filter">Lab</Label>
                <Select value={labFilter} onValueChange={setLabFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by lab" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Labs</SelectItem>
                    {labsData.map((lab) => (
                      <SelectItem key={lab.id} value={lab.id}>
                        Lab {lab.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category-filter">Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {issueCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="all">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="all">All Issues</TabsTrigger>
            <TabsTrigger value="open">Open Issues</TabsTrigger>
            <TabsTrigger value="resolved">Resolved Issues</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="space-y-4">
              {filteredIssues.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No Issues Found</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      No maintenance issues match your current filters.
                    </p>
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Report New Issue
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                filteredIssues.map((issue) => (
                  <Card key={issue.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="flex flex-col items-center">
                            <Badge className={getStatusColor(issue.status)}>{issue.status}</Badge>
                            <Badge variant="outline" className="mt-2">
                              Lab {issue.lab}
                            </Badge>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{issue.title}</h3>
                              <Badge className={getSeverityColor(issue.severity)}>
                                {severityLevels.find((level) => level.id === issue.severity)?.name}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Reported by {issue.reportedBy} on {formatDate(issue.reportedAt)}
                            </p>
                            <p className="text-sm mt-1 line-clamp-2">{issue.description}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge variant="outline">
                                {issueCategories.find((category) => category.id === issue.category)?.name}
                              </Badge>
                              {issue.machineId && <Badge variant="outline">Machine: {issue.machineId}</Badge>}
                            </div>
                          </div>
                        </div>
                        <Button className="self-start md:self-center" onClick={() => handleViewIssue(issue)}>
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="open">
            <div className="space-y-4">
              {filteredIssues.filter((issue) => issue.status !== "resolved").length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No Open Issues</h3>
                    <p className="text-sm text-muted-foreground mb-4">There are no open maintenance issues.</p>
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Report New Issue
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                filteredIssues
                  .filter((issue) => issue.status !== "resolved")
                  .map((issue) => (
                    <Card key={issue.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center">
                              <Badge className={getStatusColor(issue.status)}>{issue.status}</Badge>
                              <Badge variant="outline" className="mt-2">
                                Lab {issue.lab}
                              </Badge>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{issue.title}</h3>
                                <Badge className={getSeverityColor(issue.severity)}>
                                  {severityLevels.find((level) => level.id === issue.severity)?.name}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Reported by {issue.reportedBy} on {formatDate(issue.reportedAt)}
                              </p>
                              <p className="text-sm mt-1 line-clamp-2">{issue.description}</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="outline">
                                  {issueCategories.find((category) => category.id === issue.category)?.name}
                                </Badge>
                                {issue.machineId && <Badge variant="outline">Machine: {issue.machineId}</Badge>}
                              </div>
                            </div>
                          </div>
                          <Button className="self-start md:self-center" onClick={() => handleViewIssue(issue)}>
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="resolved">
            <div className="space-y-4">
              {filteredIssues.filter((issue) => issue.status === "resolved").length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No Resolved Issues</h3>
                    <p className="text-sm text-muted-foreground mb-4">There are no resolved maintenance issues.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredIssues
                  .filter((issue) => issue.status === "resolved")
                  .map((issue) => (
                    <Card key={issue.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center">
                              <Badge className={getStatusColor(issue.status)}>{issue.status}</Badge>
                              <Badge variant="outline" className="mt-2">
                                Lab {issue.lab}
                              </Badge>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{issue.title}</h3>
                                <Badge className={getSeverityColor(issue.severity)}>
                                  {severityLevels.find((level) => level.id === issue.severity)?.name}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Reported by {issue.reportedBy} on {formatDate(issue.reportedAt)}
                              </p>
                              <p className="text-sm mt-1 line-clamp-2">{issue.description}</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="outline">
                                  {issueCategories.find((category) => category.id === issue.category)?.name}
                                </Badge>
                                {issue.machineId && <Badge variant="outline">Machine: {issue.machineId}</Badge>}
                              </div>
                            </div>
                          </div>
                          <Button className="self-start md:self-center" onClick={() => handleViewIssue(issue)}>
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Issue Detail Dialog */}
        {selectedIssue && (
          <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Maintenance Issue Details</DialogTitle>
                <DialogDescription>
                  Issue #{selectedIssue.id} - Lab {selectedIssue.lab}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Badge className={getStatusColor(selectedIssue.status)}>
                    {statusOptions.find((status) => status.id === selectedIssue.status)?.name}
                  </Badge>
                  <Badge className={getSeverityColor(selectedIssue.severity)}>
                    {severityLevels.find((level) => level.id === selectedIssue.severity)?.name} Severity
                  </Badge>
                </div>

                <div>
                  <h3 className="text-lg font-semibold">{selectedIssue.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Reported by {selectedIssue.reportedBy} on {formatDate(selectedIssue.reportedAt)}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Description</h4>
                  <p className="text-sm">{selectedIssue.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium">Category</h4>
                    <p className="text-sm">
                      {issueCategories.find((category) => category.id === selectedIssue.category)?.name}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">Machine ID</h4>
                    <p className="text-sm">{selectedIssue.machineId || "N/A"}</p>
                  </div>
                </div>

                {selectedIssue.assignedTo && (
                  <div>
                    <h4 className="font-medium">Assigned To</h4>
                    <p className="text-sm">{selectedIssue.assignedTo}</p>
                  </div>
                )}

                {selectedIssue.updatedAt && (
                  <div>
                    <h4 className="font-medium">Last Updated</h4>
                    <p className="text-sm">{formatDate(selectedIssue.updatedAt)}</p>
                  </div>
                )}
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                {selectedIssue.status !== "resolved" && (
                  <>
                    {selectedIssue.status === "reported" && (
                      <Button
                        variant="outline"
                        onClick={() => handleUpdateStatus(selectedIssue.id, "in-progress")}
                        className="w-full sm:w-auto"
                      >
                        Mark In Progress
                      </Button>
                    )}
                    <Button
                      onClick={() => handleUpdateStatus(selectedIssue.id, "resolved")}
                      className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                    >
                      Mark Resolved
                    </Button>
                  </>
                )}
                {selectedIssue.status === "resolved" && (
                  <Button
                    variant="outline"
                    onClick={() => handleUpdateStatus(selectedIssue.id, "reported")}
                    className="w-full sm:w-auto"
                  >
                    Reopen Issue
                  </Button>
                )}
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} className="w-full sm:w-auto">
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  )
}