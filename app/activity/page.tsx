"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  ArrowLeft, Filter, Download, Search, Calendar as CalendarIcon,
  User, Activity as ActivityIcon, CheckCircle, XCircle, Clock,
  Power, Wifi, Monitor, Shield, Users, HardDrive, FileText,
  Loader2, RefreshCcw, AlertCircle, ChevronDown, ChevronUp, FileDown
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface Activity {
  id: string
  timestamp: string
  user_email: string
  user_name: string
  user_role: string
  action_type: string
  action_category: string
  lab_id: string | null
  session_id: string | null
  command_id: string | null
  command_name: string | null
  description: string
  success: boolean
  duration_ms: number | null
  details: any
  ip_address: string | null
}

// Action category icons
const getCategoryIcon = (category: string) => {
  switch (category) {
    case "Power Management":
      return <Power className="h-4 w-4" />
    case "Internet Control":
      return <Wifi className="h-4 w-4" />
    case "Windows Management":
      return <Monitor className="h-4 w-4" />
    case "User Management":
      return <Users className="h-4 w-4" />
    case "Home Directories":
      return <HardDrive className="h-4 w-4" />
    case "Data & Reports":
      return <FileText className="h-4 w-4" />
    case "Session Management":
      return <CalendarIcon className="h-4 w-4" />
    case "Authentication":
      return <Shield className="h-4 w-4" />
    default:
      return <ActivityIcon className="h-4 w-4" />
  }
}

// Category color mapping
const getCategoryColor = (category: string) => {
  switch (category) {
    case "Power Management":
      return "bg-green-100 text-green-800 border-green-200"
    case "Internet Control":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "Windows Management":
      return "bg-purple-100 text-purple-800 border-purple-200"
    case "User Management":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "Home Directories":
      return "bg-cyan-100 text-cyan-800 border-cyan-200"
    case "Data & Reports":
      return "bg-indigo-100 text-indigo-800 border-indigo-200"
    case "Session Management":
      return "bg-pink-100 text-pink-800 border-pink-200"
    case "Authentication":
      return "bg-gray-100 text-gray-800 border-gray-200"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

export default function ActivityLogPage() {
  const router = useRouter()
  const [activities, setActivities] = useState<Activity[]>([])
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null)

  // Check if user is admin
  const [isAdmin, setIsAdmin] = useState(false)
  const [userSession, setUserSession] = useState<any>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterLab, setFilterLab] = useState("all")
  const [filterUser, setFilterUser] = useState("all")
  const [filterSuccess, setFilterSuccess] = useState("all")
  const [filterDateRange, setFilterDateRange] = useState("7") // days

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Check admin status
  useEffect(() => {
    const session = sessionStorage.getItem("userSession")
    if (!session) {
      router.push("/login")
      return
    }

    const parsedSession = JSON.parse(session)
    setUserSession(parsedSession)

    if (parsedSession.role !== "Admin") {
      router.push("/dashboard")
      return
    }

    setIsAdmin(true)
  }, [router])

  // Fetch activities
  useEffect(() => {
    if (!isAdmin) return

    const fetchActivities = async () => {
      setIsLoading(true)
      setError("")

      try {
        // Calculate date range
        const daysAgo = Number.parseInt(filterDateRange)
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - daysAgo)

        let query = supabase
          .from("activity_log")
          .select("*")
          .gte("timestamp", startDate.toISOString())
          .order("timestamp", { ascending: false })

        const { data, error: fetchError } = await query

        if (fetchError) {
          throw fetchError
        }

        setActivities(data || [])
      } catch (err) {
        console.error("Error fetching activities:", err)
        setError("Failed to load activity log. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchActivities()

    // Set up real-time subscription
    const subscription = supabase
      .channel("activity_log_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_log",
        },
        (payload) => {
          setActivities((prev) => [payload.new as Activity, ...prev])
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [isAdmin, filterDateRange])

  // Apply filters
  useEffect(() => {
    let filtered = [...activities]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (activity) =>
          activity.description.toLowerCase().includes(query) ||
          activity.user_name.toLowerCase().includes(query) ||
          activity.user_email.toLowerCase().includes(query) ||
          activity.command_name?.toLowerCase().includes(query) ||
          activity.lab_id?.toLowerCase().includes(query)
      )
    }

    // Category filter
    if (filterCategory !== "all") {
      filtered = filtered.filter((activity) => activity.action_category === filterCategory)
    }

    // Lab filter
    if (filterLab !== "all") {
      filtered = filtered.filter((activity) => activity.lab_id === filterLab)
    }

    // User filter
    if (filterUser !== "all") {
      filtered = filtered.filter((activity) => activity.user_email === filterUser)
    }

    // Success filter
    if (filterSuccess !== "all") {
      const successValue = filterSuccess === "success"
      filtered = filtered.filter((activity) => activity.success === successValue)
    }

    setFilteredActivities(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [activities, searchQuery, filterCategory, filterLab, filterUser, filterSuccess])

  // Get unique values for filters
  const uniqueCategories = Array.from(new Set(activities.map((a) => a.action_category).filter(Boolean)))
  const uniqueLabs = Array.from(
    new Set(
      activities
        .map((a) => a.lab_id)
        .filter((lab): lab is string => lab !== null && lab !== undefined)
    )
  ).sort()
  const uniqueUsers = Array.from(new Set(activities.map((a) => a.user_email).filter(Boolean)))

  // Pagination
  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedActivities = filteredActivities.slice(startIndex, endIndex)

  // Format date and time
  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const isToday = date.toDateString() === today.toDateString()
    const isYesterday = date.toDateString() === yesterday.toDateString()

    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })

    if (isToday) {
      return `Today at ${timeStr}`
    } else if (isYesterday) {
      return `Yesterday at ${timeStr}`
    } else {
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    }
  }

  // Export to PDF with graphics and analytics
  const exportToPDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    
    // Header with gradient background (simulated)
    doc.setFillColor(0, 0, 104) // #000068
    doc.rect(0, 0, pageWidth, 40, 'F')
    
    // Title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('Activity Log Report', 20, 25)
    
    // Subtitle
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated on ${new Date().toLocaleString()}`, 20, 32)
    
    // Reset text color
    doc.setTextColor(0, 0, 0)
    
    let yPosition = 50

    // Summary Statistics Section
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Summary Statistics', 20, yPosition)
    yPosition += 10

    const totalActivities = filteredActivities.length
    const successfulActivities = filteredActivities.filter(a => a.success).length
    const failedActivities = filteredActivities.filter(a => !a.success).length
    const successRate = totalActivities > 0 ? ((successfulActivities / totalActivities) * 100).toFixed(1) : 0
    const uniqueUsersCount = new Set(filteredActivities.map(a => a.user_email)).size
    const uniqueLabsCount = new Set(filteredActivities.filter(a => a.lab_id).map(a => a.lab_id)).size

    // Stats boxes
    const stats = [
      { label: 'Total Activities', value: totalActivities, color: [0, 0, 104] },
      { label: 'Successful', value: successfulActivities, color: [34, 197, 94] },
      { label: 'Failed', value: failedActivities, color: [239, 68, 68] },
      { label: 'Success Rate', value: `${successRate}%`, color: [59, 130, 246] },
      { label: 'Unique Users', value: uniqueUsersCount, color: [168, 85, 247] },
      { label: 'Labs Involved', value: uniqueLabsCount, color: [249, 115, 22] }
    ]

    let xPos = 20
    stats.forEach((stat, index) => {
      if (index > 0 && index % 3 === 0) {
        yPosition += 25
        xPos = 20
      }
      
      // Draw stat box
      doc.setFillColor(stat.color[0], stat.color[1], stat.color[2])
      doc.roundedRect(xPos, yPosition, 50, 20, 3, 3, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(String(stat.value), xPos + 25, yPosition + 10, { align: 'center' })
      
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(stat.label, xPos + 25, yPosition + 16, { align: 'center' })
      
      xPos += 60
    })

    yPosition += 35
    doc.setTextColor(0, 0, 0)

    // Category Breakdown Chart
    if (yPosition > pageHeight - 80) {
      doc.addPage()
      yPosition = 20
    }

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Activity by Category', 20, yPosition)
    yPosition += 5

    const categoryCount: { [key: string]: number } = {}
    filteredActivities.forEach(activity => {
      categoryCount[activity.action_category] = (categoryCount[activity.action_category] || 0) + 1
    })

    // Simple bar chart
    const categories = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).slice(0, 8)
    const maxCount = Math.max(...categories.map(c => c[1]))
    const barHeight = 8
    const maxBarWidth = 120

    categories.forEach(([category, count]) => {
      const barWidth = (count / maxCount) * maxBarWidth
      
      // Category name
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(category, 20, yPosition + 5)
      
      // Bar
      doc.setFillColor(59, 130, 246)
      doc.rect(90, yPosition, barWidth, barHeight, 'F')
      
      // Count
      doc.setFont('helvetica', 'bold')
      doc.text(String(count), 95 + barWidth, yPosition + 5)
      
      yPosition += barHeight + 3
    })

    yPosition += 10

    // User Activity Summary
    if (yPosition > pageHeight - 60) {
      doc.addPage()
      yPosition = 20
    }

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Top Users', 20, yPosition)
    yPosition += 5

    const userCount: { [key: string]: number } = {}
    filteredActivities.forEach(activity => {
      userCount[activity.user_email] = (userCount[activity.user_email] || 0) + 1
    })

    const topUsers = Object.entries(userCount).sort((a, b) => b[1] - a[1]).slice(0, 5)

    topUsers.forEach(([email, count]) => {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(email, 20, yPosition + 5)
      
      const barWidth = (count / Math.max(...topUsers.map(u => u[1]))) * 100
      doc.setFillColor(168, 85, 247)
      doc.rect(100, yPosition, barWidth, 6, 'F')
      
      doc.setFont('helvetica', 'bold')
      doc.text(String(count), 105 + barWidth, yPosition + 4)
      
      yPosition += 10
    })

    yPosition += 10

    // Detailed Activity Table
    doc.addPage()
    yPosition = 20

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Detailed Activity Log', 20, yPosition)
    yPosition += 5

    // Prepare table data
    const tableData = filteredActivities.slice(0, 100).map(activity => [
      new Date(activity.timestamp).toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      activity.user_name,
      activity.action_category,
      activity.lab_id || '-',
      activity.description.substring(0, 50) + (activity.description.length > 50 ? '...' : ''),
      activity.success ? '✓' : '✗'
    ])

    autoTable(doc, {
      startY: yPosition,
      head: [['Time', 'User', 'Category', 'Lab', 'Description', 'Status']],
      body: tableData,
      styles: { 
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [0, 0, 104],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 25 },
        2: { cellWidth: 30 },
        3: { cellWidth: 15 },
        4: { cellWidth: 60 },
        5: { cellWidth: 15, halign: 'center' }
      },
      didDrawPage: (data) => {
        // Footer
        doc.setFontSize(8)
        doc.setTextColor(128, 128, 128)
        doc.text(
          `Page ${doc.getCurrentPageInfo().pageNumber}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        )
      }
    })

    // Save the PDF
    doc.save(`activity_log_report_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("")
    setFilterCategory("all")
    setFilterLab("all")
    setFilterUser("all")
    setFilterSuccess("all")
  }

  if (!isAdmin) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gradient-to-r from-[#000068] to-[#1e5fa8] text-white h-20 flex items-center p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="text-white hover:bg-white/10">
              <Link href="/dashboard">
                <ArrowLeft className="h-5 w-5 text-white" />
              </Link>
            </Button>
            <h1 className="text-xl font-bold">Activity Log</h1>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Admin Only
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/20 text-white">
              {filteredActivities.length} Activities
            </Badge>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters Card */}
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToPDF}
                  disabled={filteredActivities.length === 0}
                  className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Export PDF Report
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Search */}
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search activities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lab Filter */}
              <div className="space-y-2">
                <Label>Lab</Label>
                <Select value={filterLab} onValueChange={setFilterLab}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Labs</SelectItem>
                    {uniqueLabs.map((lab) => (
                      <SelectItem key={lab} value={lab}>
                        Lab {lab}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User Filter */}
              <div className="space-y-2">
                <Label>User</Label>
                <Select value={filterUser} onValueChange={setFilterUser}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {uniqueUsers.map((user) => (
                      <SelectItem key={user} value={user}>
                        {user}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Success Filter */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filterSuccess} onValueChange={setFilterSuccess}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">Success Only</SelectItem>
                    <SelectItem value="failed">Failed Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-2">
                <Label>Date Range</Label>
                <Select value={filterDateRange} onValueChange={setFilterDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Last 24 hours</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="14">Last 14 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activities List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ActivityIcon className="h-5 w-5" />
              Recent Activities
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-3 text-gray-600">Loading activities...</span>
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="text-center py-12">
                <ActivityIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No activities found</p>
                <p className="text-sm text-gray-500 mt-1">
                  Try adjusting your filters or check back later
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {paginatedActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                        activity.success
                          ? "border-green-200 bg-green-50/50"
                          : "border-red-200 bg-red-50/50"
                      }`}
                    >
                      {/* Main Activity Row */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {/* Success/Failure Icon */}
                            {activity.success ? (
                              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                            )}

                            {/* Category Badge */}
                            <Badge
                              variant="outline"
                              className={`${getCategoryColor(activity.action_category)} flex items-center gap-1`}
                            >
                              {getCategoryIcon(activity.action_category)}
                              {activity.action_category}
                            </Badge>

                            {/* Lab Badge */}
                            {activity.lab_id && (
                              <Badge variant="secondary" className="text-xs">
                                Lab {activity.lab_id}
                              </Badge>
                            )}

                            {/* Command Name */}
                            {activity.command_name && (
                              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                {activity.command_name}
                              </span>
                            )}
                          </div>

                          {/* Description */}
                          <p className="text-sm font-medium text-gray-900 mb-2">
                            {activity.description}
                          </p>

                          {/* User and Time Info */}
                          <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{activity.user_name}</span>
                              <span className="text-gray-400">({activity.user_email})</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatDateTime(activity.timestamp)}</span>
                            </div>
                            {activity.duration_ms && (
                              <div className="flex items-center gap-1">
                                <span>Duration: {(activity.duration_ms / 1000).toFixed(2)}s</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expand Button */}
                        {activity.details && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedActivity(
                                expandedActivity === activity.id ? null : activity.id
                              )
                            }
                          >
                            {expandedActivity === activity.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {expandedActivity === activity.id && activity.details && (
                        <div className="mt-4 pt-4 border-t">
                          <h5 className="text-xs font-medium text-gray-700 mb-2">
                            Additional Details:
                          </h5>
                          <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                            {JSON.stringify(activity.details, null, 2)}
                          </pre>
                          {activity.ip_address && (
                            <p className="text-xs text-gray-600 mt-2">
                              IP Address: {activity.ip_address}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <p className="text-sm text-gray-600">
                      Showing {startIndex + 1} to {Math.min(endIndex, filteredActivities.length)} of{" "}
                      {filteredActivities.length} activities
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(
                            (page) =>
                              page === 1 ||
                              page === totalPages ||
                              Math.abs(page - currentPage) <= 1
                          )
                          .map((page, index, array) => (
                            <div key={page} className="flex items-center">
                              {index > 0 && array[index - 1] !== page - 1 && (
                                <span className="px-2 text-gray-400">...</span>
                              )}
                              <Button
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                                className={
                                  currentPage === page
                                    ? "bg-[#000068] hover:bg-[#030384]"
                                    : ""
                                }
                              >
                                {page}
                              </Button>
                            </div>
                          ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}