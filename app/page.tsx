import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Server, Users, Activity, Calendar, CalendarRange, AlertTriangle } from "lucide-react"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-[#0f4d92] text-white p-4">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold">MSS Welcoming Team</h1>
          <p className="text-sm opacity-80">University of the Witwatersrand</p>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        <div className="space-y-6 py-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Welcome to TWK Labs Management</h2>
            <p className="text-muted-foreground">
              Manage the TW Kambule Laboratories efficiently with this mobile application.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="bg-card rounded-lg border shadow-sm p-6">
              <div className="flex items-center gap-4">
                <Server className="h-8 w-8 text-[#0f4d92]" />
                <div>
                  <h3 className="font-semibold">Lab Management</h3>
                  <p className="text-sm text-muted-foreground">Control lab settings and configurations</p>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/labs">
                  <Button className="w-full bg-[#0f4d92] hover:bg-[#0a3d7a]">
                    Access Labs
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="bg-card rounded-lg border shadow-sm p-6">
              <div className="flex items-center gap-4">
                <Calendar className="h-8 w-8 text-[#0f4d92]" />
                <div>
                  <h3 className="font-semibold">Schedule Sessions</h3>
                  <p className="text-sm text-muted-foreground">Book labs for upcoming classes and exams</p>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/schedule">
                  <Button className="w-full bg-[#0f4d92] hover:bg-[#0a3d7a]">
                    Schedule
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="bg-card rounded-lg border shadow-sm p-6">
              <div className="flex items-center gap-4">
                <CalendarRange className="h-8 w-8 text-[#0f4d92]" />
                <div>
                  <h3 className="font-semibold">Lab Timetable</h3>
                  <p className="text-sm text-muted-foreground">View complete lab booking schedule</p>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/calendar">
                  <Button className="w-full bg-[#0f4d92] hover:bg-[#0a3d7a]">
                    View Timetable
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="bg-card rounded-lg border shadow-sm p-6">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-[#0f4d92]" />
                <div>
                  <h3 className="font-semibold">Maintenance Issues</h3>
                  <p className="text-sm text-muted-foreground">Report and track lab maintenance issues</p>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/maintenance">
                  <Button className="w-full bg-[#0f4d92] hover:bg-[#0a3d7a]">
                    Maintenance
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="bg-card rounded-lg border shadow-sm p-6">
              <div className="flex items-center gap-4">
                <Activity className="h-8 w-8 text-[#0f4d92]" />
                <div>
                  <h3 className="font-semibold">Activity Log</h3>
                  <p className="text-sm text-muted-foreground">View recent operations and changes</p>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/activity">
                  <Button className="w-full bg-[#0f4d92] hover:bg-[#0a3d7a]">
                    View Activity
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="bg-card rounded-lg border shadow-sm p-6">
              <div className="flex items-center gap-4">
                <Users className="h-8 w-8 text-[#0f4d92]" />
                <div>
                  <h3 className="font-semibold">Team Management</h3>
                  <p className="text-sm text-muted-foreground">Manage TLA access and permissions</p>
                </div>
              </div>
              <div className="mt-4">
                <Link href="/team">
                  <Button className="w-full bg-[#0f4d92] hover:bg-[#0a3d7a]">
                    Manage Team
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
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
