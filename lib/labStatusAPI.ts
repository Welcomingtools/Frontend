// lib/labStatusAPI.ts
export interface LabStatus {
  id: string
  name: string
  totalMachines: number
  machinesUp: number
  machinesDown: number
  lastUpdated: string
}

export interface CommandResult {
  command: string
  success: boolean
  output: string | string[]
  timestamp: string
  duration: number
  welcometoolsCommand?: string
  description?: string
  labId?: string
}

const SERVER_BASE_URL = "http://10.100.15.252:3001"

export class LabStatusAPI {
  // Get status for a specific lab
  static async getLabStatus(labId: string): Promise<LabStatus | null> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/api/commands/${labId}/listmachinesup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success && Array.isArray(data.output)) {
        const cleanOutput = data.output.map((line: string) => 
          line.replace(/\u001b\[\?2004[lh]|\r/g, '').trim()
        ).filter((line: string) => line.length > 0)
        
        const machinesUp = cleanOutput.length
        const totalMachines = this.getLabCapacity(labId)
        
        return {
          id: labId,
          name: `Lab ${labId}`,
          totalMachines,
          machinesUp,
          machinesDown: totalMachines - machinesUp,
          lastUpdated: new Date().toISOString()
        }
      }
      
      return null
    } catch (error) {
      console.error(`Failed to fetch status for lab ${labId}:`, error)
      return null
    }
  }

  // Get status for all labs
  static async getAllLabsStatus(): Promise<LabStatus[]> {
    const labIds = ["004", "005", "006", "106", "108", "109", "110", "111"]
    const statusPromises = labIds.map(id => this.getLabStatus(id))
    const results = await Promise.allSettled(statusPromises)
    
    return results
      .filter((result): result is PromiseFulfilledResult<LabStatus> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value)
  }

  // Execute a command on a specific lab
  static async executeCommand(labId: string, command: string, description: string): Promise<CommandResult> {
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
            displayOutput = `✅ ${description} completed successfully for Lab ${labId}\n\n${cleanOutput.join('\n')}`
          }
        } else {
          displayOutput = `✅ ${description} completed successfully for Lab ${labId}\nCommand executed on welcometools server\nDuration: ${(data.duration / 1000).toFixed(1)}s`
        }
      } else {
        displayOutput = `❌ ${description} failed for Lab ${labId}\nError: ${data.error}\nDuration: ${(data.duration / 1000).toFixed(1)}s`
      }

      return {
        command: description,
        success: data.success,
        output: displayOutput,
        timestamp: new Date().toLocaleTimeString(),
        duration: data.duration,
        welcometoolsCommand: data.welcometoolsCommand,
        description: data.description,
        labId: labId
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      
      return {
        command: description,
        success: false,
        output: `❌ Connection failed: ${errorMessage}\n\nMake sure the command server is running on ${SERVER_BASE_URL}`,
        timestamp: new Date().toLocaleTimeString(),
        duration: 0,
        labId: labId
      }
    }
  }

  // Test server connection
  static async testServerConnection(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/api/health`)
      
      if (!response.ok) {
        return {
          success: false,
          error: `Server responded with status ${response.status}`
        }
      }
      
      const data = await response.json()
      return {
        success: true,
        data
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // Get lab capacity configuration
  private static getLabCapacity(labId: string): number {
    const capacities: Record<string, number> = {
      "004": 100,
      "005": 100,
      "006": 100,
      "106": 16,
      "108": 50,
      "109": 50,
      "110": 50,
      "111": 50,
    }
    return capacities[labId] || 16
  }

  // Get all lab capacities
  static getLabCapacities(): Record<string, number> {
    return {
      "004": 100,
      "005": 100,
      "006": 100,
      "106": 16,
      "108": 50,
      "109": 50,
      "110": 50,
      "111": 50,
    }
  }

  // Check if server is online (quick health check)
  static async isServerOnline(): Promise<boolean> {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      return response.ok
    } catch {
      return false
    }
  }

  // NEW: Parse machine count from command output
  static parseMachineCount(output: string | string[]): number {
    if (!output) return 0

    if (Array.isArray(output)) {
      return output
        .map(line => line.replace(/\u001b\[\?2004[lh]|\r/g, '').trim())
        .filter(line => line.length > 0).length
    }

    if (typeof output === "string") {
      return output
        .split("\n")
        .map(line => line.replace(/\u001b\[\?2004[lh]|\r/g, '').trim())
        .filter(line => line.length > 0).length
    }

    return 0
  }
}
