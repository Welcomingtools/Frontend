"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight, Server, Users, Activity, Calendar, CalendarRange, AlertTriangle, FileText, LogOut, Monitor } from "lucide-react"
import { logAuthAction } from "@/lib/activityLogger"

type UserSession = {
  email: string
  name: string
  surname: string
  role: string
  loginTime: string
  accountType: string
}

export default function Dashboard() {
  const router = useRouter()
  const [userSession, setUserSession] = useState<UserSession | null>(null)

  useEffect(() => {
    // Get user session data
    if (typeof window !== 'undefined') {
      const sessionData = sessionStorage.getItem('userSession')
      if (sessionData) {
        setUserSession(JSON.parse(sessionData))
      } else {
        // No session found, redirect to login
        router.push('/login')
      }
    }
  }, [router])

  const handleLogout = async () => {
    try {
      // Get current user session for logging
      if (typeof window !== 'undefined') {
        const sessionData = sessionStorage.getItem('userSession')
        if (sessionData) {
          const userSession = JSON.parse(sessionData)
          
          // Log logout activity
          await logAuthAction("logout", userSession.email)
        }

        // Clear session
        sessionStorage.removeItem('userSession')
      }
      
      // Redirect to login
      router.push('/login')
    } catch (error) {
      console.error("Error during logout:", error)
      // Still clear session and redirect even if logging fails
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('userSession')
      }
      router.push('/login')
    }
  }

  // Show loading state while checking session
  if (!userSession) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-gradient-to-r from-[#000068] to-[#1e5fa8] text-white h-20 flex items-center p-4">
        <div className="container mx-auto flex justify-between px-2 sm:px-4">
          <div className="flex items-center"> 
            <div className="p-2">
                <img 
                    src="/images/mss logo.png" 
                    alt="Site Logo" 
                    className="h-14 w-auto" 
                />
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-white hover:bg-white/10 hover:text-white flex items-center gap-2 mt-4"
          >
              <LogOut className="h-4 w-4 text-white group-hover:text-white" />
              Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto p-4">
        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Welcome, {userSession.name} {userSession.surname} to TWK Labs Management</h2>
            <p className="text-muted-foreground">
              Manage the TW Kambule Laboratories efficiently with this mobile application.
            </p>
          </div>

          {/* Dashboard Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Lab Management Card */}
            <div 
              className="group bg-card rounded-lg border border-[#000068] shadow-md p-6 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg cursor-pointer"
              onClick={() => router.push("/labs")}
            >
              <div className="flex items-center gap-4">
                <Server className="h-8 w-8 text-[#000068]" />
                <div>
                  <h3 className="font-semibold">Lab Management</h3>
                  <p className="text-sm text-muted-foreground">Control lab settings and configurations</p>
                </div>
              </div>
              <div className="mt-4">
                <Button className="w-full bg-[#000068] group-hover:bg-gradient-to-r from-[#030384] to-[#1e5fa8]">
                  Access Labs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Schedule Session Tab - Conditionally rendered based on role */}
            {userSession.role !== "BCDR" && (
              <div 
                className="group bg-card rounded-lg border border-[#000068] shadow-md p-6 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg cursor-pointer"
                onClick={() => router.push("/schedule")}
              >
                <div className="flex items-center gap-4">
                  <Calendar className="h-8 w-8 text-[#000068]" />
                  <div>
                    <h3 className="font-semibold">
                      {userSession.role === "Welcoming Team" ? "Scheduled Sessions" : "Schedule Sessions"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {userSession.role === "Welcoming Team" 
                        ? "View upcoming lab sessions" 
                        : "Book labs for upcoming classes and exams"}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <Button className="w-full bg-[#000068] group-hover:bg-gradient-to-r from-[#030384] to-[#1e5fa8]">
                    {userSession.role === "Welcoming Team" ? "View Sessions" : "Schedule"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Lab Timetable Card */}
            <div 
              className="group bg-card rounded-lg border border-[#000068] shadow-md p-6 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg cursor-pointer"
              onClick={() => router.push("/calendar")}
            >
              <div className="flex items-center gap-4">
                <CalendarRange className="h-8 w-8 text-[#000068]" />
                <div>
                  <h3 className="font-semibold">Lab Timetable</h3>
                  <p className="text-sm text-muted-foreground">View complete lab booking schedule</p>
                </div>
              </div>
              <div className="mt-4">
                <Button className="w-full bg-[#000068] group-hover:bg-gradient-to-r from-[#030384] to-[#1e5fa8]">
                  View Timetable
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Maintenance Card */}
            <div 
              className="group bg-card rounded-lg border border-[#000068] shadow-md p-6 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg cursor-pointer"
              onClick={() => router.push("/maintenance")}
            >
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-[#000068]" />
                <div>
                  <h3 className="font-semibold">Maintenance Issues</h3>
                  <p className="text-sm text-muted-foreground">Report and track lab maintenance issues</p>
                </div>
              </div>
              <div className="mt-4">
                <Button className="w-full bg-[#000068] group-hover:bg-gradient-to-r from-[#030384] to-[#1e5fa8]">
                  Maintenance
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Activity Log Card - ONLY SHOW FOR ADMINS */}
            {userSession.role === "Admin" && (
              <div 
                className="group bg-card rounded-lg border border-[#000068] shadow-md p-6 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg cursor-pointer"
                onClick={() => router.push("/activity")}
              >
                <div className="flex items-center gap-4">
                  <Activity className="h-8 w-8 text-[#000068]" />
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      Activity Log
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Admin
                      </span>
                    </h3>
                    <p className="text-sm text-muted-foreground">View system activity and audit logs</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Button className="w-full bg-[#000068] group-hover:bg-gradient-to-r from-[#030384] to-[#1e5fa8]">
                    View Activity
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ROLE-BASED ACCESS: Only show Team Management for Admin and TLA */}
            {(userSession.role === "Admin" || userSession.role === "TLA") ? (
              <div 
                className="group bg-card rounded-lg border border-[#000068] shadow-md p-6 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg cursor-pointer"
                onClick={() => router.push("/team")}
              >
                <div className="flex items-center gap-4">
                  <Users className="h-8 w-8 text-[#000068]" />
                  <div>
                    <h3 className="font-semibold">Team Management</h3>
                    <p className="text-sm text-muted-foreground">Manage user access and permissions</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Button className="w-full bg-[#000068] group-hover:bg-gradient-to-r from-[#030384] to-[#1e5fa8]">
                    Manage Team
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div 
                className="group bg-card rounded-lg border border-[#000068] shadow-md p-6 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg cursor-pointer"
                onClick={() => router.push("/team")}
              >
                <div className="flex items-center gap-4">
                  <Users className="h-8 w-8 text-[#000068]" />
                  <div>
                    <h3 className="font-semibold">My Team</h3>
                    <p className="text-sm text-muted-foreground">View team members</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Button className="w-full bg-[#000068] group-hover:bg-gradient-to-r from-[#030384] to-[#1e5fa8]">
                    View Team
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          
            {/* ROLE-BASED ACCESS: Only show Reports to Admins */}
            {userSession.role === "Admin" && (
              <div 
                className="group bg-card rounded-lg border border-[#000068] shadow-md p-6 transition-all duration-200 transform hover:scale-[1.02] hover:shadow-lg cursor-pointer"
                onClick={() => router.push("/reports")}
              >
                <div className="flex items-center gap-4">
                  <FileText className="h-8 w-8 text-[#000068]" />
                  <div>
                    <h3 className="font-semibold">Reports</h3>
                    <p className="text-sm text-muted-foreground">View reports based on current session activity, staff activity and maintenance</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Button className="w-full bg-[#000068] group-hover:bg-gradient-to-r from-[#030384] to-[#1e5fa8]">
                    View Reports
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          {/* About Section */}
          <div className="rounded-lg border bg-gradient-to-r from-[#000068] to-[#1e5fa8] shadow-md p-6">
            <h3 className="font-semibold text-white mb-2">About MSS Welcoming Team App</h3>
            <p className="text-sm text-white">
              This application allows Admins and TLAs to manage the TW Kambule Laboratories more efficiently. The app enables parallel operations, real-time status
              updates, and improved coordination between team members.
            </p>
          </div>
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