// LabStatusPage.tsx
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Monitor, Globe, Home, RefreshCcw, CheckCircle, XCircle, Clock } from "lucide-react"
import { Progress } from "@/components/ui/progress"

// Mock session data - this would come from your scheduling system
const mockSessionData = {
  sessionId: "SES-2024-001",
  scheduledBy: "Dr. Sarah Johnson",
  course: "Computer Science 101",
  startTime: "09:00 AM",
  endTime: "11:00 AM",
  date: "2024-08-24",
  configurations: {
    windowsBoot: true,
    userCleanup: true,
    homeDirectories: false,
    internetAccess: true,
    dataHandout: true
  },
  appliedAt: "08:55 AM",
  status: "active"
}

// Lab capacity data with proper typing
const labCapacities: Record<string, number> = {
  "004": 100,
  "005": 100,
  "006": 100,
  "108": 50,
  "109": 50,
  "110": 50,
  "111": 50,
}

export default function LabStatusPage() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const [sessionData, setSessionData] = useState(mockSessionData)
  
  // Get machine status from query parameters or generate if not provided
  const upFromQuery = searchParams.get('up')
  const downFromQuery = searchParams.get('down')
  const totalFromQuery = searchParams.get('total')
  
  // Get the correct capacity for this lab with proper type handling
  const labId = Array.isArray(id) ? id[0] : id
  const totalMachines = totalFromQuery ? parseInt(totalFromQuery) : (labCapacities[labId || ''] || 50)
  
  // Use provided machine counts or generate random ones if not provided
  const [machinesUp, setMachinesUp] = useState(
    upFromQuery ? parseInt(upFromQuery) : Math.floor(totalMachines * (0.85 + Math.random() * 0.15))
  )
  const [machinesDown, setMachinesDown] = useState(
    downFromQuery ? parseInt(downFromQuery) : totalMachines - machinesUp
  )
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString())

  // Only update the time, not the machine status
  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString())
  }, [])

  const getConfigurationStatus = (isEnabled: boolean) => {
    return isEnabled ? (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span className="text-sm font-medium">Enabled</span>
      </div>
    ) : (
      <div className="flex items-center gap-2 text-red-600">
        <XCircle className="h-4 w-4" />
        <span className="text-sm font-medium">Disabled</span>
      </div>
    )
  }

  const getSessionStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-600">Session Active</Badge>
      case "scheduled":
        return <Badge className="bg-blue-600">Scheduled</Badge>
      case "ended":
        return <Badge className="bg-gray-600">Session Ended</Badge>
      default:
        return <Badge variant="outline">No Session</Badge>
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[#0f4d92] text-white p-4 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="text-white">
              <Link href="/labs">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-xl font-bold">Lab {labId} Status</h1>
          </div>
          {getSessionStatusBadge(sessionData.status)}
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        {/* Session Information */}
        {sessionData.status === "active" && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Current Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Course</p>
                  <p className="font-medium">{sessionData.course}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Instructor</p>
                  <p className="font-medium">{sessionData.scheduledBy}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">{sessionData.startTime} - {sessionData.endTime}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Session ID</p>
                  <p className="font-mono text-sm">{sessionData.sessionId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Configurations Applied</p>
                  <p className="font-medium">{sessionData.appliedAt}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{lastUpdated}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 mb-4">
          <Card>
            <CardHeader>
              <CardTitle>Lab Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Machines Online</span>
                    <span className="text-sm font-medium">
                      {machinesUp}/{totalMachines}
                    </span>
                  </div>
                  <Progress value={(machinesUp / totalMachines) * 100} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
                    <span className="text-2xl font-bold text-green-600">{machinesUp}</span>
                    <span className="text-xs text-muted-foreground">Machines Up</span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
                    <span className="text-2xl font-bold text-red-600">{machinesDown}</span>
                    <span className="text-xs text-muted-foreground">Machines Down</span>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Lab Capacity: {totalMachines} machines
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Applied Configurations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-muted-foreground" />
                    <Label>Windows Boot</Label>
                  </div>
                  {getConfigurationStatus(sessionData.configurations.windowsBoot)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCcw className="h-5 w-5 text-muted-foreground" />
                    <Label>VM User Cleanup</Label>
                  </div>
                  {getConfigurationStatus(sessionData.configurations.userCleanup)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-muted-foreground" />
                    <Label>Home Directories</Label>
                  </div>
                  {getConfigurationStatus(sessionData.configurations.homeDirectories)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <Label>Internet Access</Label>
                  </div>
                  {getConfigurationStatus(sessionData.configurations.internetAccess)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="status">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="status">Configuration Details</TabsTrigger>
            <TabsTrigger value="history">Session History</TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Configuration Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-medium mb-2">System Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Windows Boot:</span>
                        <span className={`ml-2 font-medium ${sessionData.configurations.windowsBoot ? 'text-green-600' : 'text-red-600'}`}>
                          {sessionData.configurations.windowsBoot ? 'Armed' : 'Disarmed'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">User Cleanup:</span>
                        <span className={`ml-2 font-medium ${sessionData.configurations.userCleanup ? 'text-green-600' : 'text-red-600'}`}>
                          {sessionData.configurations.userCleanup ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Home Directories:</span>
                        <span className={`ml-2 font-medium ${sessionData.configurations.homeDirectories ? 'text-green-600' : 'text-red-600'}`}>
                          {sessionData.configurations.homeDirectories ? 'Mounted' : 'Unmounted'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Internet Access:</span>
                        <span className={`ml-2 font-medium ${sessionData.configurations.internetAccess ? 'text-green-600' : 'text-red-600'}`}>
                          {sessionData.configurations.internetAccess ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {sessionData.configurations.dataHandout && (
                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-medium mb-2">Data Distribution</h4>
                      <p className="text-sm text-muted-foreground">
                        Course materials have been distributed to all machines
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Recent Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">Computer Science 101</p>
                      <p className="text-sm text-muted-foreground">Dr. Sarah Johnson - {sessionData.date}</p>
                    </div>
                    <Badge className="bg-green-600">Active</Badge>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">Mathematics 201</p>
                      <p className="text-sm text-muted-foreground">Prof. Mike Davis - 2024-08-23</p>
                    </div>
                    <Badge className="bg-gray-600">Ended</Badge>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <div>
                      <p className="font-medium">Physics Lab</p>
                      <p className="text-sm text-muted-foreground">Dr. Lisa Wong - 2024-08-22</p>
                    </div>
                    <Badge className="bg-gray-600">Ended</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}