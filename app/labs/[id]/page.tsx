"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { 
  ArrowLeft, Monitor, Globe, Home, RefreshCcw, CheckCircle, 
  XCircle, Clock, Power, Wifi, WifiOff, Users, HardDrive, 
  Download, Shield, FileText, Activity, Loader2 
} from "lucide-react"

// Lab capacity data with proper typing
const labCapacities: Record<string, number> = {
  "004": 100,
  "005": 100,
  "006": 100,
  "106": 16,
  "108": 50,
  "109": 50,
  "110": 50,
  "111": 50,
}

// Server configuration
const SERVER_BASE_URL = "http://10.100.15.252:3001"

interface CommandResult {
  command: string
  success: boolean
  output: string | string[]
  timestamp: string
  duration: number
  welcometoolsCommand?: string
  description?: string
  labId?: string
  machines?: string[] // Added machines array to interface
}

interface SessionData {
  sessionId: string
  scheduledBy: string
  course: string
  startTime: string
  endTime: string
  date: string
  configurations: {
    windowsBoot: boolean
    userCleanup: boolean
    homeDirectories: boolean
    internetAccess: boolean
    dataHandout: boolean
  }
  appliedAt: string
  status: string
}

export default function LabStatusPage() {
  const { id } = useParams()
  
  // Get the correct lab ID and capacity
  const labId = Array.isArray(id) ? id[0] : id || "106"
  const totalMachines = labCapacities[labId] || 16
  
  // State for machine status
  const [machinesUp, setMachinesUp] = useState(0)
  const [machinesDown, setMachinesDown] = useState(totalMachines)
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleTimeString())
  
  // State for command execution
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [commandResults, setCommandResults] = useState<CommandResult[]>([])
  const [error, setError] = useState("")
  
  // Session data state - initially empty
  const [sessionData, setSessionData] = useState<SessionData | null>(null)

  // Fetch initial machine status
  useEffect(() => {
    const fetchInitialStatus = async () => {
      try {
        setIsLoading('initial')
        const response = await fetch(`${SERVER_BASE_URL}/api/commands/${labId}/listmachinesup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          // Use machines array if available, otherwise fall back to output parsing
          if (data.success && data.machines && Array.isArray(data.machines)) {
            setMachinesUp(data.machines.length)
            setMachinesDown(totalMachines - data.machines.length)
            setLastUpdated(new Date().toLocaleTimeString())
          } else if (data.success && Array.isArray(data.output)) {
            const cleanOutput = data.output.map((line: string) => 
              line.replace(/\u001b\[\?2004[lh]|\r/g, '').trim()
            ).filter((line: string) => line.length > 0)
            
            setMachinesUp(cleanOutput.length)
            setMachinesDown(totalMachines - cleanOutput.length)
            setLastUpdated(new Date().toLocaleTimeString())
          }
        }
      } catch (err) {
        console.error('Failed to fetch initial machine status:', err)
      } finally {
        setIsLoading(null)
      }
    }

    fetchInitialStatus()
  }, [totalMachines, labId])

  // Real command execution - calls your Node.js server with lab ID
  const executeCommand = async (command: string, description: string) => {
    setIsLoading(command)
    setError("")

    try {
      const response = await fetch(`${SERVER_BASE_URL}/api/commands/${labId}/${command}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Format output for display
      let displayOutput = ''
      if (data.success) {
        // Use machines array if available, otherwise fall back to output
        const machinesList = data.machines && Array.isArray(data.machines) ? data.machines : 
                            (Array.isArray(data.output) ? data.output : []);
        
        if (machinesList.length > 0) {
          // Clean up machine names (remove terminal control characters)
          const cleanOutput = machinesList.map((line: string) => 
            line.replace(/\u001b\[\?2004[lh]|\r/g, '').trim()
          ).filter((line: string) => line.length > 0)
          
          if (command.includes('listmachines')) {
            displayOutput = `✅ ${description} completed successfully\n\nMachines found:\n${cleanOutput.join('\n')}\n\nTotal: ${cleanOutput.length} machines`
            
            // Update machine status if this was a status check
            if (command === 'listmachinesup') {
              setMachinesUp(cleanOutput.length)
              setMachinesDown(totalMachines - cleanOutput.length)
              setLastUpdated(new Date().toLocaleTimeString())
            } else if (command === 'listmachinesdown') {
              setMachinesDown(cleanOutput.length)
              setMachinesUp(totalMachines - cleanOutput.length)
              setLastUpdated(new Date().toLocaleTimeString())
            }
          } else if (command.includes('report')) {
            displayOutput = `✅ ${description} completed successfully\n\nReport:\n${cleanOutput.join('\n')}`
          } else {
            displayOutput = `✅ ${description} completed successfully for Lab ${labId}\n\n${cleanOutput.join('\n')}`
            
            // Update session configurations if relevant
            updateSessionData(command)
          }
        } else {
          displayOutput = `✅ ${description} completed successfully for Lab ${labId}\nCommand executed on welcometools server\nDuration: ${(data.duration / 1000).toFixed(1)}s`
          updateSessionData(command)
        }
      } else {
        displayOutput = `❌ ${description} failed for Lab ${labId}\nError: ${data.error}\nDuration: ${(data.duration / 1000).toFixed(1)}s`
      }

      const result: CommandResult = {
        command: description,
        success: data.success,
        output: displayOutput,
        timestamp: new Date().toLocaleTimeString(),
        duration: data.duration,
        welcometoolsCommand: data.welcometoolsCommand,
        description: data.description,
        labId: labId,
        machines: data.machines // Include machines array in result
      }

      setCommandResults(prev => [result, ...prev.slice(0, 14)]) // Keep last 15 results

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(`Failed to execute ${description} for Lab ${labId}: ${errorMessage}`)
      
      // Add failed result to results
      const result: CommandResult = {
        command: description,
        success: false,
        output: `❌ Connection failed: ${errorMessage}\n\nMake sure the command server is running on ${SERVER_BASE_URL}`,
        timestamp: new Date().toLocaleTimeString(),
        duration: 0,
        labId: labId
      }
      setCommandResults(prev => [result, ...prev.slice(0, 14)])
    } finally {
      setIsLoading(null)
    }
  }

  // Update session data based on command
  const updateSessionData = (command: string) => {
    const getDefaultSessionData = () => ({
      sessionId: "",
      scheduledBy: "",
      course: "",
      startTime: "",
      endTime: "",
      date: "",
      configurations: {
        windowsBoot: false,
        userCleanup: false,
        homeDirectories: false,
        internetAccess: false,
        dataHandout: false
      },
      appliedAt: new Date().toLocaleTimeString(),
      status: "active"
    })

    setSessionData(prev => {
      const currentData = prev || getDefaultSessionData()
      const updatedConfigurations = { ...currentData.configurations }

      switch (command) {
        case 'armwindows':
          updatedConfigurations.windowsBoot = true
          break
        case 'disarmwindows':
          updatedConfigurations.windowsBoot = false
          break
        case 'armvmusercleanup':
          updatedConfigurations.userCleanup = true
          break
        case 'disarmvmusercleanup':
          updatedConfigurations.userCleanup = false
          break
        case 'armhomes':
          updatedConfigurations.homeDirectories = true
          break
        case 'disarmhomes':
          updatedConfigurations.homeDirectories = false
          break
        case 'internetup':
          updatedConfigurations.internetAccess = true
          break
        case 'internetdown':
          updatedConfigurations.internetAccess = false
          break
        case 'handoutdata':
          updatedConfigurations.dataHandout = true
          break
      }

      return {
        ...currentData,
        configurations: updatedConfigurations,
        appliedAt: new Date().toLocaleTimeString(),
        status: "active"
      }
    })
  }

  // Test server connection
  const testConnection = async () => {
    setIsLoading('test')
    setError("")

    try {
      const response = await fetch(`${SERVER_BASE_URL}/api/health`)
      const data = await response.json()
      
      const result: CommandResult = {
        command: "Health Check",
        success: true,
        output: `✅ Server connection successful\n\nServer: ${data.server}\nVersion: ${data.version || '1.0.0'}\nStatus: ${data.status}\nAvailable commands: ${data.availableCommands?.length || 0} total\nAvailable labs: ${data.availableLabs?.join(', ') || 'Unknown'}\n\nCommands: ${data.availableCommands?.join(', ') || 'None'}`,
        timestamp: new Date().toLocaleTimeString(),
        duration: 0
      }
      setCommandResults(prev => [result, ...prev.slice(0, 14)])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(`Health check failed: ${errorMessage}`)
    } finally {
      setIsLoading(null)
    }
  }

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

  const getSessionStatusBadge = (status: string | undefined) => {
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

  // All 18 commands organized by category
  const commandCategories = {
    'Power Management': [
      {
        id: "powerup",
        name: "Power Up",
        description: `Power up all machines in Lab ${labId}`,
        icon: <Power className="h-5 w-5" />,
        color: "bg-green-600 hover:bg-green-700"
      },
      {
        id: "powerdown",
        name: "Power Down",
        description: `Power down all machines in Lab ${labId}`,
        icon: <Power className="h-5 w-5" />,
        color: "bg-red-600 hover:bg-red-700"
      },
      {
        id: "reboot",
        name: "Reboot All",
        description: `Reboot all machines in Lab ${labId}`,
        icon: <RefreshCcw className="h-5 w-5" />,
        color: "bg-blue-600 hover:bg-blue-700"
      }
    ],
    'Machine Status': [
      {
        id: "listmachinesup",
        name: "List Machines Up",
        description: "Show machines that are powered up",
        icon: <CheckCircle className="h-5 w-5" />,
        color: "bg-emerald-600 hover:bg-emerald-700"
      },
      {
        id: "listmachinesdown",
        name: "List Machines Down",
        description: "Show machines that are powered down",
        icon: <XCircle className="h-5 w-5" />,
        color: "bg-gray-600 hover:bg-gray-700"
      }
    ],
    'Windows Management': [
      {
        id: "armwindows",
        name: "Arm Windows",
        description: "Enable Windows boot configuration",
        icon: <Shield className="h-5 w-5" />,
        color: "bg-purple-600 hover:bg-purple-700"
      },
      {
        id: "disarmwindows",
        name: "Disarm Windows",
        description: "Disable Windows boot configuration",
        icon: <Shield className="h-5 w-5" />,
        color: "bg-purple-400 hover:bg-purple-500"
      },
      {
        id: "windowsdown",
        name: "Windows Down",
        description: "Shutdown Windows on all machines",
        icon: <Monitor className="h-5 w-5" />,
        color: "bg-indigo-600 hover:bg-indigo-700"
      }
    ],
    'User Management': [
      {
        id: "armvmusercleanup",
        name: "Arm User Cleanup",
        description: "Enable automatic user cleanup",
        icon: <Users className="h-5 w-5" />,
        color: "bg-orange-600 hover:bg-orange-700"
      },
      {
        id: "disarmvmusercleanup",
        name: "Disarm User Cleanup",
        description: "Disable automatic user cleanup",
        icon: <Users className="h-5 w-5" />,
        color: "bg-orange-400 hover:bg-orange-500"
      }
    ],
    'Home Directories': [
      {
        id: "armhomes",
        name: "Arm Homes",
        description: "Enable home directory mounting",
        icon: <HardDrive className="h-5 w-5" />,
        color: "bg-cyan-600 hover:bg-cyan-700"
      },
      {
        id: "disarmhomes",
        name: "Disarm Homes",
        description: "Disable home directory mounting",
        icon: <HardDrive className="h-5 w-5" />,
        color: "bg-cyan-400 hover:bg-cyan-500"
      }
    ],
    'Internet Control': [
      {
        id: "internetup",
        name: "Internet Up",
        description: "Enable internet access",
        icon: <Wifi className="h-5 w-5" />,
        color: "bg-teal-600 hover:bg-teal-700"
      },
      {
        id: "internetdown",
        name: "Internet Down",
        description: "Disable internet access",
        icon: <WifiOff className="h-5 w-5" />,
        color: "bg-rose-600 hover:bg-rose-700"
      }
    ],
    'Data & Reports': [
      {
        id: "handoutdata",
        name: "Handout Data",
        description: "Distribute data files to machines",
        icon: <Download className="h-5 w-5" />,
        color: "bg-lime-600 hover:bg-lime-700"
      },
      {
        id: "reportwindows",
        name: "Windows Report",
        description: "Generate Windows status report",
        icon: <FileText className="h-5 w-5" />,
        color: "bg-violet-600 hover:bg-violet-700"
      },
      {
        id: "reportvmuser",
        name: "VM User Report",
        description: "Generate VM user status report",
        icon: <FileText className="h-5 w-5" />,
        color: "bg-fuchsia-600 hover:bg-fuchsia-700"
      },
      {
        id: "reportinternet",
        name: "Internet Report",
        description: "Generate internet status report",
        icon: <FileText className="h-5 w-5" />,
        color: "bg-amber-600 hover:bg-amber-700"
      }
    ]
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
            <h1 className="text-xl font-bold">Lab {labId} Status & Control</h1>
          </div>
          {getSessionStatusBadge(sessionData?.status)}
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Session Information */}
        {sessionData && sessionData.status === "active" && (
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
              <CardTitle>Lab {labId} Status</CardTitle>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Last updated: {lastUpdated}
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
                  {getConfigurationStatus(sessionData?.configurations.windowsBoot || false)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCcw className="h-5 w-5 text-muted-foreground" />
                    <Label>VM User Cleanup</Label>
                  </div>
                  {getConfigurationStatus(sessionData?.configurations.userCleanup || false)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-muted-foreground" />
                    <Label>Home Directories</Label>
                  </div>
                  {getConfigurationStatus(sessionData?.configurations.homeDirectories || false)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <Label>Internet Access</Label>
                  </div>
                  {getConfigurationStatus(sessionData?.configurations.internetAccess || false)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="commands">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="commands">Lab Commands</TabsTrigger>
            <TabsTrigger value="status">Configuration Details</TabsTrigger>
          </TabsList>

          <TabsContent value="commands" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Server Connection
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Command server: 10.100.15.252:3001 | Lab: {labId}
                </p>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={testConnection}
                  disabled={isLoading !== null}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading === 'test' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Test Server Connection
                </Button>
              </CardContent>
            </Card>

            {/* Commands organized by category */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {Object.entries(commandCategories).map(([category, commands]) => (
                <Card key={category}>
                  <CardHeader>
                    <CardTitle className="text-lg">{category}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {commands.length} command{commands.length > 1 ? 's' : ''} available for Lab {labId}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {commands.map((cmd) => (
                        <Button
                          key={cmd.id}
                          onClick={() => executeCommand(cmd.id, cmd.name)}
                          disabled={isLoading !== null}
                          className={`w-full ${cmd.color} text-white p-4 h-auto flex items-center gap-3 relative`}
                        >
                          {isLoading === cmd.id ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            cmd.icon
                          )}
                          <div className="text-left flex-1">
                            <div className="font-medium text-sm">{cmd.name}</div>
                            <div className="text-xs opacity-90">{cmd.description}</div>
                          </div>
                          {isLoading === cmd.id && (
                            <div className="absolute bottom-1 right-2 text-xs">
                              Executing...
                            </div>
                          )}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {commandResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Command Results</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Recent command executions from welcometools server for Lab {labId}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {commandResults.map((result, index) => (
                      <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {result.success ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <span className="font-medium">{result.command}</span>
                            {result.labId && (
                              <Badge variant="secondary" className="text-xs">
                                Lab {result.labId}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={result.success ? "default" : "destructive"}>
                              {result.success ? "Success" : "Failed"}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {result.timestamp} • {(result.duration / 1000).toFixed(1)}s
                            </span>
                          </div>
                        </div>
                        {result.welcometoolsCommand && (
                          <div className="text-xs text-gray-500 mb-2 font-mono">
                            Command: {result.welcometoolsCommand}
                          </div>
                        )}
                        <pre className="text-sm bg-gray-50 p-3 rounded border overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {typeof result.output === 'string' ? result.output : result.output.join('\n')}
                        </pre>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Configuration Status - Lab {labId}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-medium mb-2">System Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Windows Boot:</span>
                        <span className={`ml-2 font-medium ${sessionData?.configurations.windowsBoot ? 'text-green-600' : 'text-red-600'}`}>
                          {sessionData?.configurations.windowsBoot ? 'Armed' : 'Disarmed'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">User Cleanup:</span>
                        <span className={`ml-2 font-medium ${sessionData?.configurations.userCleanup ? 'text-green-600' : 'text-red-600'}`}>
                          {sessionData?.configurations.userCleanup ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Home Directories:</span>
                        <span className={`ml-2 font-medium ${sessionData?.configurations.homeDirectories ? 'text-green-600' : 'text-red-600'}`}>
                          {sessionData?.configurations.homeDirectories ? 'Mounted' : 'Unmounted'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Internet Access:</span>
                        <span className={`ml-2 font-medium ${sessionData?.configurations.internetAccess ? 'text-green-600' : 'text-red-600'}`}>
                          {sessionData?.configurations.internetAccess ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {sessionData?.configurations.dataHandout && (
                    <div className="border-l-4 border-green-500 pl-4">
                      <h4 className="font-medium mb-2">Data Distribution</h4>
                      <p className="text-sm text-muted-foreground">
                        Course materials have been distributed to all machines in Lab {labId}
                      </p>
                    </div>
                  )}

                  <div className="border-l-4 border-gray-500 pl-4">
                    <h4 className="font-medium mb-2">Lab Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Lab ID:</span>
                        <span className="ml-2 font-medium">{labId}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Machines:</span>
                        <span className="ml-2 font-medium">{totalMachines}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Machines Up:</span>
                        <span className="ml-2 font-medium text-green-600">{machinesUp}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Machines Down:</span>
                        <span className="ml-2 font-medium text-red-600">{machinesDown}</span>
                      </div>
                    </div>
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