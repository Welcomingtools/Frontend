"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ChevronLeft, ChevronRight, Filter } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

// Define preset lecture slots
const LECTURE_SLOTS = [
  { id: 1, startTime: "08:00", endTime: "09:45", label: "08:00 - 09:45" },
  { id: 2, startTime: "10:15", endTime: "12:00", label: "10:15 - 12:00" },
  { id: 3, startTime: "12:30", endTime: "13:15", label: "12:30 - 13:15" },
  { id: 4, startTime: "14:15", endTime: "16:00", label: "14:15 - 16:00" },
  { id: 5, startTime: "17:00", endTime: "19:00", label: "17:00 - 19:00" },
]

// Mock data for labs
const labsData = [
  { id: "001", name: "Lab 001", capacity: 72, color: "#4f46e5" },
  { id: "002", name: "Lab 002", capacity: 72, color: "#0891b2" },
  { id: "003", name: "Lab 003", capacity: 72, color: "#16a34a" },
  { id: "004", name: "Lab 004", capacity: 72, color: "#ca8a04" },
  { id: "005", name: "Lab 005", capacity: 72, color: "#dc2626" },
  { id: "006", name: "Lab 006", capacity: 72, color: "#9333ea" },
  { id: "007", name: "Lab 007", capacity: 72, color: "#f97316" },
]

// Mock data for scheduled sessions
const initialSessions = [
  {
    id: 1,
    lab: "004",
    date: "2023-05-07",
    startTime: "08:00",
    endTime: "09:45",
    slotId: 1,
    purpose: "CS1 Programming Tutorial",
    configurations: {
      windows: true,
      internet: true,
      homes: true,
      userCleanup: true,
    },
    createdBy: "John Doe",
  },
  {
    id: 2,
    lab: "002",
    date: "2023-05-07",
    startTime: "10:15",
    endTime: "12:00",
    slotId: 2,
    purpose: "MATH2 Exam",
    configurations: {
      windows: false,
      internet: false,
      homes: true,
      userCleanup: true,
    },
    createdBy: "Jane Smith",
  },
  {
    id: 3,
    lab: "001",
    date: "2023-05-07",
    startTime: "14:15",
    endTime: "16:00",
    slotId: 4,
    purpose: "STATS1 R Workshop",
    configurations: {
      windows: false,
      internet: true,
      homes: true,
      userCleanup: true,
    },
    createdBy: "Mike Johnson",
  },
  {
    id: 4,
    lab: "003",
    date: "2023-05-08",
    startTime: "08:00",
    endTime: "09:45",
    slotId: 1,
    purpose: "CS2 Programming Assignment",
    configurations: {
      windows: true,
      internet: true,
      homes: true,
      userCleanup: true,
    },
    createdBy: "Sarah Williams",
  },
  {
    id: 5,
    lab: "005",
    date: "2023-05-08",
    startTime: "10:15",
    endTime: "12:00",
    slotId: 2,
    purpose: "PHYS1 Lab Session",
    configurations: {
      windows: false,
      internet: true,
      homes: true,
      userCleanup: true,
    },
    createdBy: "David Brown",
  },
  {
    id: 6,
    lab: "006",
    date: "2023-05-09",
    startTime: "12:30",
    endTime: "13:15",
    slotId: 3,
    purpose: "CHEM1 Tutorial",
    configurations: {
      windows: true,
      internet: false,
      homes: true,
      userCleanup: true,
    },
    createdBy: "Emily Davis",
  },
  {
    id: 7,
    lab: "007",
    date: "2023-05-09",
    startTime: "17:00",
    endTime: "19:00",
    slotId: 5,
    purpose: "CS3 Evening Class",
    configurations: {
      windows: true,
      internet: true,
      homes: true,
      userCleanup: true,
    },
    createdBy: "Michael Wilson",
  },
  {
    id: 8,
    lab: "001",
    date: "2023-05-10",
    startTime: "08:00",
    endTime: "09:45",
    slotId: 1,
    purpose: "MATH1 Tutorial",
    configurations: {
      windows: false,
      internet: true,
      homes: true,
      userCleanup: true,
    },
    createdBy: "Jessica Taylor",
  },
  {
    id: 9,
    lab: "002",
    date: "2023-05-10",
    startTime: "14:15",
    endTime: "16:00",
    slotId: 4,
    purpose: "CS1 Lab Session",
    configurations: {
      windows: true,
      internet: true,
      homes: true,
      userCleanup: true,
    },
    createdBy: "Robert Johnson",
  },
  {
    id: 10,
    lab: "003",
    date: "2023-05-11",
    startTime: "10:15",
    endTime: "12:00",
    slotId: 2,
    purpose: "STATS2 Exam",
    configurations: {
      windows: false,
      internet: false,
      homes: true,
      userCleanup: true,
    },
    createdBy: "Amanda Lee",
  },
]

// Helper function to get the Monday of the current week
const getMonday = (date: Date) => {
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  return new Date(date.setDate(diff))
}

// Helper function to format date as YYYY-MM-DD
const formatDate = (date: Date) => {
  return date.toISOString().split("T")[0]
}

// Helper function to add days to a date
const addDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// Helper function to format date for display
const formatDateForDisplay = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

export default function CalendarPage() {
  const [sessions] = useState(initialSessions)
  const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()))
  const [visibleLabs, setVisibleLabs] = useState(labsData.map((lab) => lab.id))
  const router = useRouter()

  // Generate dates for the current week
  const weekDates = Array.from({ length: 5 }, (_, i) => formatDate(addDays(new Date(currentWeekStart), i)))

  // Navigate to previous week
  const goToPreviousWeek = () => {
    const newWeekStart = addDays(currentWeekStart, -7)
    setCurrentWeekStart(newWeekStart)
  }

  // Navigate to next week
  const goToNextWeek = () => {
    const newWeekStart = addDays(currentWeekStart, 7)
    setCurrentWeekStart(newWeekStart)
  }

  // Navigate to current week
  const goToCurrentWeek = () => {
    setCurrentWeekStart(getMonday(new Date()))
  }

  // Toggle lab visibility
  const toggleLabVisibility = (labId: string) => {
    if (visibleLabs.includes(labId)) {
      setVisibleLabs(visibleLabs.filter((id) => id !== labId))
    } else {
      setVisibleLabs([...visibleLabs, labId])
    }
  }

  // Get sessions for a specific date, slot, and lab
  const getSessionForDateSlotLab = (date: string, slotId: number, labId: string) => {
    return sessions.find(
      (session) =>
        session.date === date && session.slotId === slotId && session.lab === labId && visibleLabs.includes(labId),
    )
  }

  // Navigate to session detail
  const navigateToSession = (sessionId: number) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (session) {
      router.push(`/labs/${session.lab}`)
    }
  }

  // Get lab color
  const getLabColor = (labId: string) => {
    const lab = labsData.find((lab) => lab.id === labId)
    return lab ? lab.color : "#000000"
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-[#0f4d92] text-white p-4 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="text-white">
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-xl font-bold">Lab Timetable</h1>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="bg-white text-[#0f4d92] hover:bg-gray-100">
                <Filter className="h-4 w-4 mr-2" />
                Filter Labs
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <h4 className="font-medium">Show/Hide Labs</h4>
                <div className="grid gap-2">
                  {labsData.map((lab) => (
                    <div key={lab.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`lab-${lab.id}`}
                        checked={visibleLabs.includes(lab.id)}
                        onCheckedChange={() => toggleLabVisibility(lab.id)}
                      />
                      <Label htmlFor={`lab-${lab.id}`} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: lab.color }}></div>
                        Lab {lab.id}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle>Weekly Timetable</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={goToNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDateForDisplay(weekDates[0])} - {formatDateForDisplay(weekDates[4])}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border bg-muted text-left min-w-[100px]">Time Slot</th>
                    {weekDates.map((date, index) => (
                      <th key={date} className="p-2 border bg-muted text-center min-w-[180px]">
                        {formatDateForDisplay(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LECTURE_SLOTS.map((slot) => (
                    <tr key={slot.id}>
                      <td className="p-2 border font-medium text-sm">{slot.label}</td>
                      {weekDates.map((date) => (
                        <td key={`${date}-${slot.id}`} className="p-2 border relative">
                          <div className="grid gap-1">
                            {labsData
                              .filter((lab) => visibleLabs.includes(lab.id))
                              .map((lab) => {
                                const session = getSessionForDateSlotLab(date, slot.id, lab.id)
                                if (!session) return null

                                return (
                                  <TooltipProvider key={`${date}-${slot.id}-${lab.id}`}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div
                                          className="p-1 rounded text-xs text-white cursor-pointer truncate"
                                          style={{ backgroundColor: getLabColor(lab.id) }}
                                          onClick={() => navigateToSession(session.id)}
                                        >
                                          <div className="font-bold">Lab {lab.id}</div>
                                          <div className="truncate">{session.purpose}</div>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="space-y-1">
                                          <p className="font-bold">{session.purpose}</p>
                                          <p>
                                            Lab {session.lab} | {session.createdBy}
                                          </p>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {session.configurations.windows && (
                                              <Badge variant="outline" className="text-xs">
                                                Windows
                                              </Badge>
                                            )}
                                            {session.configurations.internet && (
                                              <Badge variant="outline" className="text-xs">
                                                Internet
                                              </Badge>
                                            )}
                                            {session.configurations.homes && (
                                              <Badge variant="outline" className="text-xs">
                                                Home Dirs
                                              </Badge>
                                            )}
                                            {session.configurations.userCleanup && (
                                              <Badge variant="outline" className="text-xs">
                                                User Cleanup
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="text-xs italic mt-1">Click to manage</p>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )
                              })}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lab Color Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {labsData.map((lab) => (
                <div key={lab.id} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: lab.color, opacity: visibleLabs.includes(lab.id) ? 1 : 0.3 }}
                  ></div>
                  <span className={visibleLabs.includes(lab.id) ? "font-medium" : "text-muted-foreground"}>
                    Lab {lab.id}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
