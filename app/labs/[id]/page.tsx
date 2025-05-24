"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Power, Monitor, Globe, Database, Home, RefreshCcw, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"

export default function LabDetailPage() {
  const { id } = useParams()
  const [isPowerOn, setIsPowerOn] = useState(true)
  const [isWindowsArmed, setIsWindowsArmed] = useState(false)
  const [isUserCleanupArmed, setIsUserCleanupArmed] = useState(true)
  const [areHomesArmed, setAreHomesArmed] = useState(true)
  const [isInternetOn, setIsInternetOn] = useState(true)
  const [isDataHandoutActive, setIsDataHandoutActive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingAction, setLoadingAction] = useState("")
  const [progress, setProgress] = useState(0)
  const [machinesUp, setMachinesUp] = useState(68)
  const [machinesDown, setMachinesDown] = useState(4)
  const [recentActions, setRecentActions] = useState([
    { action: "Internet enabled", timestamp: "10:45 AM", user: "John D." },
    { action: "Windows disarmed", timestamp: "10:30 AM", user: "Sarah M." },
    { action: "Power cycled", timestamp: "10:15 AM", user: "John D." },
  ])

  const totalMachines = machinesUp + machinesDown

  const executeCommand = (command: string) => {
    setIsLoading(true)
    setLoadingAction(command)
    setProgress(0)

    // Simulate command execution with progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsLoading(false)

          // Add action to recent actions
          const newAction = {
            action: command,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            user: "You",
          }
          setRecentActions([newAction, ...recentActions.slice(0, 4)])

          return 0
        }
        return prev + 10
      })
    }, 300)
  }

  const handlePowerToggle = () => {
    const command = isPowerOn ? `powerdown ${id}` : `powerup ${id}`
    executeCommand(command)
    setIsPowerOn(!isPowerOn)
  }

  const handleWindowsToggle = () => {
    const command = isWindowsArmed ? `disarmwindows ${id}` : `armwindows ${id}`
    executeCommand(command)
    setIsWindowsArmed(!isWindowsArmed)
  }

  const handleUserCleanupToggle = () => {
    const command = isUserCleanupArmed ? `disarmvmusercleanup ${id}` : `armvmusercleanup ${id}`
    executeCommand(command)
    setIsUserCleanupArmed(!isUserCleanupArmed)
  }

  const handleHomesToggle = () => {
    const command = areHomesArmed ? `disarmhomes ${id}` : `armhomes ${id}`
    executeCommand(command)
    setAreHomesArmed(!areHomesArmed)
  }

  const handleInternetToggle = () => {
    const command = isInternetOn ? `internetdown ${id}` : `internetup ${id}`
    executeCommand(command)
    setIsInternetOn(!isInternetOn)
  }

  const handleDataHandout = () => {
    if (!isDataHandoutActive) {
      executeCommand(`handoutdata ${id}`)
      setIsDataHandoutActive(true)
    }
  }

  const handleReboot = () => {
    executeCommand(`reboot ${id}`)
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
            <h1 className="text-xl font-bold">Lab {id} Management</h1>
          </div>
          <Badge className="bg-green-600">Locked by You</Badge>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        {isLoading && (
          <div className="mb-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Executing command</AlertTitle>
              <AlertDescription>
                <div className="flex flex-col gap-2">
                  <p>
                    Running: <code>{loadingAction}</code>
                  </p>
                  <Progress value={progress} className="h-2" />
                </div>
              </AlertDescription>
            </Alert>
          </div>
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
                    <span className="text-2xl font-bold">{machinesUp}</span>
                    <span className="text-xs text-muted-foreground">Machines Up</span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
                    <span className="text-2xl font-bold">{machinesDown}</span>
                    <span className="text-xs text-muted-foreground">Machines Down</span>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" size="sm" onClick={() => executeCommand(`listmachinesup ${id}`)}>
                    List Machines Up
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => executeCommand(`listmachinesdown ${id}`)}>
                    List Machines Down
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={isPowerOn ? "default" : "destructive"}
                  className="flex items-center gap-2"
                  onClick={handlePowerToggle}
                >
                  <Power className="h-4 w-4" />
                  {isPowerOn ? "Power Down" : "Power Up"}
                </Button>

                <Button variant="outline" className="flex items-center gap-2" onClick={handleReboot}>
                  <RefreshCcw className="h-4 w-4" />
                  Reboot Lab
                </Button>

                <Button
                  variant={isInternetOn ? "default" : "outline"}
                  className="flex items-center gap-2"
                  onClick={handleInternetToggle}
                >
                  <Globe className="h-4 w-4" />
                  {isInternetOn ? "Disable Internet" : "Enable Internet"}
                </Button>

                <Button
                  variant={isDataHandoutActive ? "secondary" : "outline"}
                  className="flex items-center gap-2"
                  onClick={handleDataHandout}
                  disabled={isDataHandoutActive}
                >
                  <Database className="h-4 w-4" />
                  Handout Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="controls">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="controls">Lab Controls</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="controls" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-5 w-5 text-muted-foreground" />
                      <Label htmlFor="windows-toggle">Windows Boot</Label>
                    </div>
                    <Switch id="windows-toggle" checked={isWindowsArmed} onCheckedChange={handleWindowsToggle} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCcw className="h-5 w-5 text-muted-foreground" />
                      <Label htmlFor="cleanup-toggle">VM User Cleanup</Label>
                    </div>
                    <Switch
                      id="cleanup-toggle"
                      checked={isUserCleanupArmed}
                      onCheckedChange={handleUserCleanupToggle}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Home className="h-5 w-5 text-muted-foreground" />
                      <Label htmlFor="homes-toggle">Home Directories</Label>
                    </div>
                    <Switch id="homes-toggle" checked={areHomesArmed} onCheckedChange={handleHomesToggle} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                      <Label htmlFor="internet-toggle">Internet Access</Label>
                    </div>
                    <Switch id="internet-toggle" checked={isInternetOn} onCheckedChange={handleInternetToggle} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActions.map((action, index) => (
                    <div key={index} className="flex justify-between items-center border-b pb-2 last:border-0">
                      <div>
                        <p className="font-medium">{action.action}</p>
                        <p className="text-sm text-muted-foreground">By {action.user}</p>
                      </div>
                      <Badge variant="outline">{action.timestamp}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
