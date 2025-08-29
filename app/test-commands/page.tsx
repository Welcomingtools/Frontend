"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Power, RefreshCw, Monitor, Wifi, Home, Globe, CheckCircle, XCircle, Loader2, FileText, Users, HardDrive, Download, Shield, WifiOff, Activity } from "lucide-react"

interface CommandResult {
  command: string
  success: boolean
  output: string | string[]
  timestamp: string
  duration: number
  welcometoolsCommand?: string
  description?: string
}

export default function LabCommandTest() {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [results, setResults] = useState<CommandResult[]>([])
  const [error, setError] = useState("")

  // Real command execution - calls your Node.js server
  const executeCommand = async (command: string, description: string) => {
    setIsLoading(command)
    setError("")

    try {
      const response = await fetch(`http://10.100.15.252:3001/api/commands/${command}`, {
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
        if (Array.isArray(data.output) && data.output.length > 0) {
          // Clean up machine names (remove terminal control characters)
          const cleanOutput = data.output.map((line: string) => 
            line.replace(/\u001b\[\?2004[lh]|\r/g, '').trim()
          ).filter((line: string) => line.length > 0)
          
          if (command.includes('listmachines')) {
            displayOutput = `✅ ${description} completed successfully\n\nMachines found:\n${cleanOutput.join('\n')}\n\nTotal: ${cleanOutput.length} machines`
          } else if (command.includes('report')) {
            displayOutput = `✅ ${description} completed successfully\n\nReport:\n${cleanOutput.join('\n')}`
          } else {
            displayOutput = `✅ ${description} completed successfully\n\n${cleanOutput.join('\n')}`
          }
        } else {
          displayOutput = `✅ ${description} completed successfully\nCommand executed on welcometools server\nDuration: ${(data.duration / 1000).toFixed(1)}s`
        }
      } else {
        displayOutput = `❌ ${description} failed\nError: ${data.error}\nDuration: ${(data.duration / 1000).toFixed(1)}s`
      }

      const result: CommandResult = {
        command: description,
        success: data.success,
        output: displayOutput,
        timestamp: new Date().toLocaleTimeString(),
        duration: data.duration,
        welcometoolsCommand: data.welcometoolsCommand,
        description: data.description
      }

      setResults(prev => [result, ...prev.slice(0, 14)]) // Keep last 15 results

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(`Failed to execute ${description}: ${errorMessage}`)
      
      // Add failed result to results
      const result: CommandResult = {
        command: description,
        success: false,
        output: `❌ Connection failed: ${errorMessage}\n\nMake sure the command server is running on 10.100.15.252:3001`,
        timestamp: new Date().toLocaleTimeString(),
        duration: 0
      }
      setResults(prev => [result, ...prev.slice(0, 14)])
    } finally {
      setIsLoading(null)
    }
  }

  // Test server connection
  const testConnection = async () => {
    setIsLoading('test')
    setError("")

    try {
      const response = await fetch('http://10.100.15.252:3001/api/health')
      const data = await response.json()
      
      const result: CommandResult = {
        command: "Health Check",
        success: true,
        output: `✅ Server connection successful\n\nServer: ${data.server}\nStatus: ${data.status}\nAvailable commands: ${data.availableCommands?.length || 0} total\n\nCommands: ${data.availableCommands?.join(', ') || 'None'}`,
        timestamp: new Date().toLocaleTimeString(),
        duration: 0
      }
      setResults(prev => [result, ...prev.slice(0, 14)])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(`Health check failed: ${errorMessage}`)
    } finally {
      setIsLoading(null)
    }
  }

  // All 18 commands organized by category
  const commandCategories = {
    'Power Management': [
      {
        id: "powerup",
        name: "Power Up",
        description: "Power up all machines in Lab 106",
        icon: <Power className="h-5 w-5" />,
        color: "bg-green-600 hover:bg-green-700"
      },
      {
        id: "powerdown",
        name: "Power Down",
        description: "Power down all machines in Lab 106",
        icon: <Power className="h-5 w-5" />,
        color: "bg-red-600 hover:bg-red-700"
      },
      {
        id: "reboot",
        name: "Reboot All",
        description: "Reboot all machines in Lab 106",
        icon: <RefreshCw className="h-5 w-5" />,
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#0f4d92] text-white p-4">
        <div className="container mx-auto flex items-center gap-4">
          <Link 
            href="/dashboard"
            className="cursor-pointer hover:bg-blue-600 p-1 rounded"
            title="Go to dashboard"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Complete Lab Command Interface</h1>
            <p className="text-sm opacity-80">All 18 welcometools commands - Lab 106</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Server Connection
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Command server: 10.100.15.252:3001
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
                  {commands.length} command{commands.length > 1 ? 's' : ''} available
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

        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Command Results</CardTitle>
              <p className="text-sm text-muted-foreground">
                Recent command executions from welcometools server
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {results.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {result.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium">{result.command}</span>
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

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-green-50 border border-green-200 rounded p-4">
                <h4 className="font-semibold text-green-900 mb-2">Command Service</h4>
                <p className="text-green-800">Node.js server active with SSH connection to welcometools</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <h4 className="font-semibold text-blue-900 mb-2">All Commands Available</h4>
                <p className="text-blue-800">Complete set of 18 welcometools commands for Lab 106</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded p-4">
                <h4 className="font-semibold text-purple-900 mb-2">Real Lab Control</h4>
                <p className="text-purple-800">Interface executes actual commands on lab infrastructure</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}