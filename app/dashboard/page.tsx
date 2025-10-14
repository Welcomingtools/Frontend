"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight, Server, Users, Activity, Calendar, CalendarRange, AlertTriangle, FileText, LogOut } from "lucide-react"

type UserSession = {
  email: string
  name: string
  surname:string
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

  const handleLogout = () => {
    // Clear session data
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('userSession')
    }
    
    // Redirect to login page
    router.push('/login')
  }

  // Show loading state while checking session
  if (!userSession) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-[#000068] text-white py-4 px-0">
        <div className="container mx-auto flex justify-between items-start px-2 sm:px-4 ">
          <div className="flex flex-col gap-0"> 
            
            <div className=""> {/* Added mb-2 for spacing between logo and text */}
                <img 
                    src="/images/mss logo.png" 
                    alt="Site Logo" 
                    className="h-20 w-auto" 
                />
            </div>
            
            {/* 2. Text Section: Centered text stack */}
            <div className="text-left -mt-4"> {/* Use text-center to center the paragraph content */}
                <p className="text-sm opacity-80">University of the Witwatersrand</p>
                <p className="text-xs opacity-60">Welcome, {userSession.name} {userSession.surname}</p>
            </div>
        </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-white hover:bg-white/10 hover:text-white flex items-center gap-2"
          >
              <LogOut className="h-4 w-4 text-white group-hover:text-white" />
              Logout
          </Button>
        </div>
      </header>

      {/* Second Header */}
      <main className="flex-1 container mx-auto p-4">
        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Welcome to TWK Labs Management</h2>
            <p className="text-muted-foreground">
              Manage the TW Kambule Laboratories efficiently with this mobile application.
            </p>
          </div>

          {/* Lab Management Tab */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="bg-card rounded-lg border border-[#000068] shadow-md p-6">
              <div className="flex items-center gap-4">
                <Server className="h-8 w-8 text-[#000068]" />
                <div>
                  <h3 className="font-semibold">Lab Management</h3>
                  <p className="text-sm text-muted-foreground">Control lab settings and configurations</p>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/labs">
                  <Button className="w-full bg-[#000068] hover:bg-[#030384]">
                    Access Labs
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Schedule Session Tab - Conditionally rendered based on role */}
            {userSession.role !== "BCDR" && (
              <div className="bg-card rounded-lg border border-[#000068] shadow-md p-6">
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
                  <Link href="/schedule">
                    <Button className="w-full bg-[#000068] hover:bg-[#030384]">
                      {userSession.role === "Welcoming Team" ? "View Sessions" : "Schedule"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Lab Timetable Tab */}
            <div className="bg-card rounded-lg border border-[#000068] shadow-md p-6">
              <div className="flex items-center gap-4">
                <CalendarRange className="h-8 w-8 text-[#000068]" />
                <div>
                  <h3 className="font-semibold">Lab Timetable</h3>
                  <p className="text-sm text-muted-foreground">View complete lab booking schedule</p>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/calendar">
                  <Button className="w-full bg-[#000068] hover:bg-[#030384]">
                    View Timetable
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Maintenance Tab */}
            <div className="bg-card rounded-lg border border-[#000068] shadow-md p-6">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-[#000068]" />
                <div>
                  <h3 className="font-semibold">Maintenance Issues</h3>
                  <p className="text-sm text-muted-foreground">Report and track lab maintenance issues</p>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/maintenance">
                  <Button className="w-full bg-[#000068] hover:bg-[#030384]">
                    Maintenance
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Activity Tab */}
            <div className="bg-card rounded-lg border border-[#000068] shadow-md p-6">
              <div className="flex items-center gap-4">
                <Activity className="h-8 w-8 text-[#000068]" />
                <div>
                  <h3 className="font-semibold">Activity Log</h3>
                  <p className="text-sm text-muted-foreground">View recent operations and changes</p>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/activity">
                  <Button className="w-full bg-[#000068] hover:bg-[#030384]">
                    View Activity
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* ROLE-BASED ACCESS: Only show Team Management for Admin and TLA */}
            {(userSession.role === "Admin" || userSession.role === "TLA") ? (
              <div className="bg-card rounded-lg border border-[#000068] shadow-md p-6">
                <div className="flex items-center gap-4">
                  <Users className="h-8 w-8 text-[#000068]" />
                  <div>
                    <h3 className="font-semibold">Team Management</h3>
                    <p className="text-sm text-muted-foreground">Manage user access and permissions</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Link href="/team">
                    <Button className="w-full bg-[#000068] hover:bg-[#030384]">
                      Manage Team
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-lg border border-[#000068] shadow-md p-6">
                <div className="flex items-center gap-4">
                  <Users className="h-8 w-8 text-[#000068]" />
                  <div>
                    <h3 className="font-semibold">My Team</h3>
                    <p className="text-sm text-muted-foreground">View team members</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Link href="/team">
                    <Button className="w-full bg-[#000068] hover:bg-[#030384]">
                      View Team
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          
            {/* ROLE-BASED ACCESS: Only show Reports to Admins */}
            {userSession.role === "Admin" && (
              <div className="bg-card rounded-lg border border-[#000068] shadow-md p-6">
                <div className="flex items-center gap-4">
                  <FileText className="h-8 w-8 text-[#000068]" />
                  <div>
                    <h3 className="font-semibold">Reports</h3>
                    <p className="text-sm text-muted-foreground">View reports based on current session activity, staff activity and maintenance</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Link href="/reports">
                    <Button className="w-full bg-[#000068] hover:bg-[#030384]">
                      View Reports
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
          
          <div className="rounded-lg border bg-card shadow-md p-6">
            <h3 className="font-semibold mb-2">About MSS Welcoming Team App</h3>
            <p className="text-sm text-muted-foreground">
              This application replaces the command-line welcometools with a user-friendly interface, allowing TLAs to
              manage the TW Kambule Laboratories more efficiently. The app enables parallel operations, real-time status
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