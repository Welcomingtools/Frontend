import { supabase } from "./supabase"

// Get user session from sessionStorage
const getUserSession = () => {
  if (typeof window === "undefined") return null
  const session = sessionStorage.getItem("userSession")
  return session ? JSON.parse(session) : null
}

// Get user's IP address (client-side approximation)
const getIpAddress = async (): Promise<string | null> => {
  try {
    const response = await fetch("https://api.ipify.org?format=json")
    const data = await response.json()
    return data.ip
  } catch (error) {
    console.error("Failed to fetch IP address:", error)
    return null
  }
}

interface LogActivityParams {
  actionType: string
  actionCategory: string
  labId?: string
  sessionId?: string
  commandId?: string
  commandName?: string
  description: string
  success?: boolean
  durationMs?: number
  details?: Record<string, any>
}

/**
 * Main function to log any activity to the database
 */
export async function logActivity(params: LogActivityParams) {
  try {
    const userSession = getUserSession()
    if (!userSession) {
      console.error("No user session found - cannot log activity")
      return { success: false, error: "No user session" }
    }

    const ipAddress = await getIpAddress()

    const activityData = {
      timestamp: new Date().toISOString(),
      user_email: userSession.email,
      user_name: `${userSession.name} ${userSession.surname}`,
      user_role: userSession.role,
      action_type: params.actionType,
      action_category: params.actionCategory,
      lab_id: params.labId || null,
      session_id: params.sessionId || null,
      command_id: params.commandId || null,
      command_name: params.commandName || null,
      description: params.description,
      success: params.success !== undefined ? params.success : true,
      duration_ms: params.durationMs || null,
      details: params.details || null,
      ip_address: ipAddress,
    }

    const { data, error } = await supabase
      .from("activity_log")
      .insert([activityData])
      .select()

    if (error) {
      console.error("Failed to log activity:", error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (err) {
    console.error("Exception while logging activity:", err)
    return { success: false, error: String(err) }
  }
}

/**
 * Log a lab command execution
 */
export async function logLabCommand(
  labId: string,
  commandId: string,
  commandName: string,
  actionCategory: string,
  success: boolean,
  durationMs: number,
  details?: {
    output?: string | string[]
    machines?: string[]
    welcometoolsCommand?: string
    error?: string
  }
) {
  const description = success
    ? `Successfully executed "${commandName}" on Lab ${labId}`
    : `Failed to execute "${commandName}" on Lab ${labId}`

  return await logActivity({
    actionType: "lab_command",
    actionCategory,
    labId,
    commandId,
    commandName,
    description,
    success,
    durationMs,
    details,
  })
}

/**
 * Log session check-in
 */
export async function logSessionCheckIn(sessionId: string, labId: string) {
  return await logActivity({
    actionType: "session_checkin",
    actionCategory: "Session Management",
    labId,
    sessionId,
    description: `Checked in to session on Lab ${labId}`,
    success: true,
  })
}

/**
 * Log session check-out
 */
export async function logSessionCheckOut(sessionId: string, labId: string) {
  return await logActivity({
    actionType: "session_checkout",
    actionCategory: "Session Management",
    labId,
    sessionId,
    description: `Checked out from session on Lab ${labId}`,
    success: true,
  })
}

/**
 * Log user authentication
 */
export async function logAuthAction(action: "login" | "logout", userEmail: string) {
  return await logActivity({
    actionType: action,
    actionCategory: "Authentication",
    description: action === "login" ? `User logged in` : `User logged out`,
    success: true,
  })
}

/**
 * Log session creation
 */
export async function logSessionCreation(sessionId: string, labId: string, purpose: string) {
  return await logActivity({
    actionType: "session_created",
    actionCategory: "Session Management",
    labId,
    sessionId,
    description: `Created new session for Lab ${labId}: ${purpose}`,
    success: true,
  })
}

/**
 * Log session update
 */
export async function logSessionUpdate(sessionId: string, labId: string, changes: string) {
  return await logActivity({
    actionType: "session_updated",
    actionCategory: "Session Management",
    labId,
    sessionId,
    description: `Updated session for Lab ${labId}: ${changes}`,
    success: true,
  })
}

/**
 * Log session status change
 */
export async function logSessionStatusChange(
  sessionId: string,
  labId: string,
  oldStatus: string,
  newStatus: string
) {
  return await logActivity({
    actionType: "session_status_change",
    actionCategory: "Session Management",
    labId,
    sessionId,
    description: `Session status changed from "${oldStatus}" to "${newStatus}" for Lab ${labId}`,
    success: true,
    details: { oldStatus, newStatus },
  })
}