"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Power, RefreshCw, Monitor, Wifi, Home, Globe, CheckCircle, XCircle, Loader2 } from "lucide-react"

interface CommandResult {
  command: string
  success: boolean
  output: string | string[]
  timestamp: string
  duration: number
  welcometoolsCommand?: string
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
          
          if (command === 'list_machines') {
            displayOutput = `✅ ${description} completed successfully\n\nMachines found:\n${cleanOutput.join('\n')}\n\nTotal: ${cleanOutput.length} machines`
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
        welcometoolsCommand: data.welcometoolsCommand
      }

      setResults(prev => [result, ...prev.slice(0, 9)]) // Keep last 10 results

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
      setResults(prev => [result, ...prev.slice(0, 9)])
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
        output: `✅ Server connection successful\n\nServer: ${data.server}\nStatus: ${data.status}\nAvailable commands: ${data.availableCommands?.join(', ') || 'None'}`,
        timestamp: new Date().toLocaleTimeString(),
        duration: 0
      }
      setResults(prev => [result, ...prev.slice(0, 9)])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(`Health check failed: ${errorMessage}`)
    } finally {
      setIsLoading(null)
    }
  }

  const commands = [
    {
      id: "list_machines",
      name: "List Machines",
      description: "Show all machines in Lab 106",
      icon: <Monitor className="h-5 w-5" />,
      color: "bg-blue-600 hover:bg-blue-700"
    },
    {
      id: "power_on",
      name: "Power On Lab",
      description: "Boot all machines in the lab",
      icon: <Power className="h-5 w-5" />,
      color: "bg-green-600 hover:bg-green-700"
    },
    {
      id: "power_off", 
      name: "Power Off Lab",
      description: "Shutdown all machines safely",
      icon: <Power className="h-5 w-5" />,
      color: "bg-red-600 hover:bg-red-700"
    },
    {
      id: "reboot",
      name: "Reboot All",
      description: "Restart all machines",
      icon: <RefreshCw className="h-5 w-5" />,
      color: "bg-blue-600 hover:bg-blue-700"
    },
    {
      id: "windows_boot",
      name: "Enable Windows Boot",
      description: "Configure machines to boot Windows",
      icon: <Monitor className="h-5 w-5" />,
      color: "bg-purple-600 hover:bg-purple-700"
    },
    {
      id: "disable_internet",
      name: "Disable Internet",
      description: "Block internet access on all machines",
      icon: <Wifi className="h-5 w-5" />,
      color: "bg-orange-600 hover:bg-orange-700"
    },
    {
      id: "enable_internet",
      name: "Enable Internet",
      description: "Allow internet access on all machines",
      icon: <Globe className="h-5 w-5" />,
      color: "bg-teal-600 hover:bg-teal-700"
    },
    {
      id: "mount_home",
      name: "Mount Home Dirs",
      description: "Mount user home directories",
      icon: <Home className="h-5 w-5" />,
      color: "bg-indigo-600 hover:bg-indigo-700"
    },
    {
      id: "cleanup_users",
      name: "Cleanup Users",
      description: "Clean up temporary user accounts",
      icon: <RefreshCw className="h-5 w-5" />,
      color: "bg-gray-600 hover:bg-gray-700"
    }
  ]

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
            <h1 className="text-2xl font-bold">Command Testing Interface</h1>
            <p className="text-sm opacity-80">Real lab control commands - Lab 106</p>
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
            <CardTitle>Server Connection</CardTitle>
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

        <Card>
          <CardHeader>
            <CardTitle>Lab Control Commands</CardTitle>
            <p className="text-sm text-muted-foreground">
              Execute real commands on Lab 106 machines via welcometools server.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {commands.map((cmd) => (
                <Button
                  key={cmd.id}
                  onClick={() => executeCommand(cmd.id, cmd.name)}
                  disabled={isLoading !== null}
                  className={`h-20 flex flex-col items-center gap-2 text-white ${cmd.color} relative`}
                >
                  {isLoading === cmd.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    cmd.icon
                  )}
                  <span className="text-xs font-medium">{cmd.name}</span>
                  {isLoading === cmd.id && (
                    <div className="absolute bottom-1 text-xs">
                      Executing...
                    </div>
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Command Results</CardTitle>
              <p className="text-sm text-muted-foreground">
                Real command executions from welcometools server
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4">
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
                      <div className="text-xs text-gray-500 mb-2">
                        Command: {result.welcometoolsCommand}
                      </div>
                    )}
                    <pre className="text-sm bg-gray-50 p-3 rounded border overflow-x-auto whitespace-pre-wrap">
                      {result.output}
                    </pre>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="bg-green-50 border border-green-200 rounded p-4">
                <h4 className="font-semibold text-green-900 mb-2">✅ Command Service Running</h4>
                <p className="text-green-800">Node.js server active on 10.100.15.252:3001 with SSH connection to welcometools</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <h4 className="font-semibold text-blue-900 mb-2">🔗 Real Commands Connected</h4>
                <p className="text-blue-800">This interface now executes actual welcometools commands on Lab 106</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded p-4">
                <h4 className="font-semibold text-purple-900 mb-2">🚀 Ready for Integration</h4>
                <p className="text-purple-800">Commands can be integrated into your main lab management workflow</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}