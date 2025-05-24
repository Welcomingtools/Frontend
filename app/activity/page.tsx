"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Mock activity data
const activityData = [
  { id: 1, action: "powerup 004", user: "John Doe", timestamp: "2023-05-06 10:15:00", lab: "004" },
  { id: 2, action: "internetdown 002", user: "Jane Smith", timestamp: "2023-05-06 10:10:00", lab: "002" },
  { id: 3, action: "armwindows 001", user: "Mike Johnson", timestamp: "2023-05-06 10:05:00", lab: "001" },
  { id: 4, action: "disarmhomes 003", user: "Sarah Williams", timestamp: "2023-05-06 10:00:00", lab: "003" },
  { id: 5, action: "handoutdata 004", user: "John Doe", timestamp: "2023-05-06 09:55:00", lab: "004" },
  { id: 6, action: "reboot 007", user: "Jane Smith", timestamp: "2023-05-06 09:50:00", lab: "007" },
  { id: 7, action: "listmachinesdown 002", user: "Mike Johnson", timestamp: "2023-05-06 09:45:00", lab: "002" },
  { id: 8, action: "armvmusercleanup 001", user: "Sarah Williams", timestamp: "2023-05-06 09:40:00", lab: "001" },
  { id: 9, action: "internetup 003", user: "John Doe", timestamp: "2023-05-06 09:35:00", lab: "003" },
  { id: 10, action: "powerdown 007", user: "Jane Smith", timestamp: "2023-05-06 09:30:00", lab: "007" },
]

export default function ActivityPage() {
  const [filter, setFilter] = useState("all")
  const [labFilter, setLabFilter] = useState("all")

  const filteredActivity = activityData.filter((activity) => {
    if (filter !== "all" && !activity.action.includes(filter)) {
      return false
    }
    if (labFilter !== "all" && activity.lab !== labFilter) {
      return false
    }
    return true
  })

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
            <h1 className="text-xl font-bold">Activity Log</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Filter Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Action Type</label>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="power">Power Actions</SelectItem>
                    <SelectItem value="internet">Internet Actions</SelectItem>
                    <SelectItem value="windows">Windows Actions</SelectItem>
                    <SelectItem value="homes">Home Directory Actions</SelectItem>
                    <SelectItem value="data">Data Actions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Lab</label>
                <Select value={labFilter} onValueChange={setLabFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by lab" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Labs</SelectItem>
                    <SelectItem value="001">Lab 001</SelectItem>
                    <SelectItem value="002">Lab 002</SelectItem>
                    <SelectItem value="003">Lab 003</SelectItem>
                    <SelectItem value="004">Lab 004</SelectItem>
                    <SelectItem value="005">Lab 005</SelectItem>
                    <SelectItem value="006">Lab 006</SelectItem>
                    <SelectItem value="007">Lab 007</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredActivity.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">
                  No activity found matching the selected filters.
                </p>
              ) : (
                filteredActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 last:border-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Lab {activity.lab}</Badge>
                        <p className="font-mono text-sm">{activity.action}</p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">By {activity.user}</p>
                    </div>
                    <Badge variant="secondary" className="mt-2 sm:mt-0 self-start sm:self-auto">
                      {new Date(activity.timestamp).toLocaleString()}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
