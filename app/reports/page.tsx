"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ArrowLeft, 
  FileText, 
  Users, 
  Activity, 
  AlertTriangle, 
  Download, 
  Calendar,
  Clock,
  User,
  LogOut
} from "lucide-react"

type UserSession = {
  email: string
  name: string
  role: string
  loginTime: string
  accountType: string
}

type SessionActivityReport = {
  id: string
  labName: string
  sessionDate: string
  startTime: string
  endTime: string
  course: string
  instructor: string
  studentsCount: number
  duration: string
  status: string
}

type StaffActivityReport = {
  id: string
  staffName: string
  role: string
  loginTime: string
  logoutTime: string
  actionsPerformed: number
  labsAccessed: string[]
  totalDuration: string
  lastActivity: string
}

type IncidentReport = {
  id: string
  reportDate: string
  reportedBy: string
  incidentType: string
  labAffected: string
  severity: string
  description: string
  status: string
  resolvedBy?: string
  resolutionDate?: string
}

export default function ReportsPage() {
  const router = useRouter()
  const [userSession, setUserSession] = useState<UserSession | null>(null)
  const [sessionReports, setSessionReports] = useState([])
  const [staffReports, setStaffReports] = useState([])
  const [incidentReports, setIncidentReports] = useState([])
  const [loading, setLoading] = useState(false)

    //Mock data for session report
    const mockSessionData = [
        {
            id: "1",
            labName: "TW Kambule Lab A",
            sessionDate: "2024-08-28",
            startTime: "08:00",
            endTime: "10:00",
            course: "COMS2001",
            instructor: "Dr. Smith",
            studentsCount: 45,
            duration: "2h 0m",
            status: "Completed"
        },
        {
            id: "2",
            labName: "TW Kambule Lab B",
            sessionDate: "2024-08-28",
            startTime: "10:30",
            endTime: "12:30",
            course: "MATH1024",
            instructor: "Prof. Johnson",
            studentsCount: 38,
            duration: "2h 0m",
            status: "Completed"
        }
    ]

    //Mock data for staff report
    const mockStaffData = [
        {
            id: "1",
            staffName: "John Doe",
            role: "TLA",
            loginTime: "2024-08-28 07:30",
            logoutTime: "2024-08-28 17:00",
            actionsPerformed: 24,
            labsAccessed: ["Lab A", "Lab B"],
            totalDuration: "9h 30m",
            lastActivity: "Lab setup completed"
        }
    ]

    //Mock data for Incident/log report
    const mockIncidentData = [
        {
            id: "1",
            reportDate: "2024-08-27",
            reportedBy: "John Doe",
            incidentType: "Equipment Failure",
            labAffected: "TW Kambule Lab A",
            severity: "High",
            description: "Projector not working in Lab A",
            status: "Resolved",
            resolvedBy: "IT Support",
            resolutionDate: "2024-08-27"
        }
    ]

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sessionData = sessionStorage.getItem('userSession')
      if (sessionData) {
        setUserSession(JSON.parse(sessionData))
      } else {
        router.push('/login')
      }
    }
  }, [router])

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('userSession')
    }
    router.push('/login')
  }

  const exportReport = (reportType: string) => {
    console.log(`Exporting ${reportType} report...`)
  }

  if (!userSession) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
  <div className="flex flex-col min-h-screen">
    <header className="bg-[#0f4d92] text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-4">
        <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
            </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">MSS Welcoming Tools</h1>
          <p className="text-sm opacity-80">University of the Witwatersrand</p>
          <p className="text-xs opacity-60">Welcome, {userSession.name} ({userSession.role})</p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleLogout}
          className="text-white hover:bg-white/10 flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
       </div> 
      </div>
    </header>

    <main className="flex-1 container mx-auto p-4">
      <div className="space-y-6 py-6">
        <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
        </div>

        <Tabs defaultValue="session" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="session" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Session Activity
                </TabsTrigger>
                <TabsTrigger value="staff" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Staff Activity
                </TabsTrigger>
                <TabsTrigger value="incidents" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Incident Log
                </TabsTrigger>
            </TabsList>
            
            {/* session activity content goes here */}
            <TabsContent value="session" className="space-y-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Session Activity Report
                        </CardTitle>
                        <CardDescription>
                        Track lab session usage, attendance, and completion status
                        </CardDescription>
                    </div>
                    <Button
                        onClick={() => exportReport('session')}
                        className="bg-[#0f4d92] hover:bg-[#0a3d7a] flex items-center gap-2"
                    >
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                    </CardHeader>
                    <CardContent>
                    <div className="space-y-4">
                        {mockSessionData.map((session) => (
                        <div key={session.id} className="border rounded-lg p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="font-semibold text-sm text-muted-foreground">Lab & Course</p>
                                <p className="font-medium">{session.labName}</p>
                                <p className="text-sm text-muted-foreground">{session.course}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-sm text-muted-foreground">Date & Time</p>
                                <p className="font-medium">{session.sessionDate}</p>
                                <p className="text-sm text-muted-foreground">
                                {session.startTime} - {session.endTime}
                                </p>
                            </div>
                            <div>
                                <p className="font-semibold text-sm text-muted-foreground">Instructor</p>
                                <p className="font-medium">{session.instructor}</p>
                                <p className="text-sm text-muted-foreground">{session.studentsCount} students</p>
                            </div>
                            <div>
                                <p className="font-semibold text-sm text-muted-foreground">Status</p>
                                <span className="inline-flex px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                {session.status}
                                </span>
                            </div>
                            </div>
                        </div>
                        ))}
                    </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/*Staff activity content goes here */}
            <TabsContent value="staff" className="space-y-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Staff Activity Report
                        </CardTitle>
                        <CardDescription>
                        Monitor staff login times, activities, and lab access patterns
                        </CardDescription>
                    </div>
                    <Button
                        onClick={() => exportReport('staff')}
                        className="bg-[#0f4d92] hover:bg-[#0a3d7a] flex items-center gap-2"
                    >
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                    </CardHeader>
                    <CardContent>
                    <div className="space-y-4">
                        {mockStaffData.map((staff) => (
                        <div key={staff.id} className="border rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <p className="font-semibold text-sm text-muted-foreground">Staff Member</p>
                                <p className="font-medium">{staff.staffName}</p>
                                <p className="text-sm text-muted-foreground">{staff.role}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-sm text-muted-foreground">Session Info</p>
                                <p className="font-medium">Login: {staff.loginTime}</p>
                                <p className="text-sm text-muted-foreground">Logout: {staff.logoutTime}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-sm text-muted-foreground">Activity</p>
                                <p className="font-medium">{staff.actionsPerformed} actions</p>
                                <p className="text-sm text-muted-foreground">Labs: {staff.labsAccessed.join(', ')}</p>
                            </div>
                            </div>
                        </div>
                        ))}
                    </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Incidents log report content goes here */}
            <TabsContent value="incidents" className="space-y-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Incident/Issue Log Report
                        </CardTitle>
                        <CardDescription>
                        Track maintenance issues, equipment failures, and incident resolutions
                        </CardDescription>
                    </div>
                    <Button
                        onClick={() => exportReport('incidents')}
                        className="bg-[#0f4d92] hover:bg-[#0a3d7a] flex items-center gap-2"
                    >
                        <Download className="h-4 w-4" />
                        Export
                    </Button>
                    </CardHeader>
                    <CardContent>
                    <div className="space-y-4">
                        {mockIncidentData.map((incident) => (
                        <div key={incident.id} className="border rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <p className="font-semibold text-sm text-muted-foreground">Incident Details</p>
                                <p className="font-medium">{incident.incidentType}</p>
                                <p className="text-sm text-muted-foreground">{incident.labAffected}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-sm text-muted-foreground">Status & Severity</p>
                                <div className="flex items-center gap-2">
                                <span className="inline-flex px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                    {incident.status}
                                </span>
                                <span className="inline-flex px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                                    {incident.severity}
                                </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">By: {incident.reportedBy}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-sm text-muted-foreground">Description</p>
                                <p className="text-sm">{incident.description}</p>
                                {incident.resolvedBy && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Resolved by: {incident.resolvedBy} on {incident.resolutionDate}
                                </p>
                                )}
                            </div>
                            </div>
                        </div>
                        ))}
                    </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
    </main>

    <footer className="border-t py-4 bg-muted">
      <div className="container mx-auto text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Mathematical Sciences Support, University of the Witwatersrand
      </div>
    </footer>
  </div>
    )
}