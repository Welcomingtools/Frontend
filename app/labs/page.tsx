"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Lock, Unlock } from "lucide-react"
import { useRouter } from "next/navigation"

// Mock data for labs
const labsData = [
  { id: "001", name: "Lab 001", status: "Available", machines: 72 },
  { id: "002", name: "Lab 002", status: "Available", machines: 72 },
  { id: "003", name: "Lab 003", status: "In Use", machines: 72 },
  { id: "004", name: "Lab 004", status: "Available", machines: 72 },
  { id: "005", name: "Lab 005", status: "Available", machines: 72 },
  { id: "006", name: "Lab 006", status: "Maintenance", machines: 72 },
  { id: "007", name: "Lab 007", status: "Available", machines: 72 },
]

export default function LabsPage() {
  const [lockedLabs, setLockedLabs] = useState<string[]>([])
  const router = useRouter()

  const toggleLock = (labId: string) => {
    if (lockedLabs.includes(labId)) {
      setLockedLabs(lockedLabs.filter((id) => id !== labId))
    } else {
      setLockedLabs([...lockedLabs, labId])
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Available":
        return "bg-green-100 text-green-800"
      case "In Use":
        return "bg-blue-100 text-blue-800"
      case "Maintenance":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
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
            <h1 className="text-xl font-bold">TW Kambule Laboratories</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {labsData.map((lab) => (
            <Card key={lab.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle>Lab {lab.id}</CardTitle>
                  <Badge className={getStatusColor(lab.status)}>{lab.status}</Badge>
                </div>
                <CardDescription>{lab.machines} machines</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <Button
                    variant={lockedLabs.includes(lab.id) ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => toggleLock(lab.id)}
                    className="flex items-center gap-1"
                  >
                    {lockedLabs.includes(lab.id) ? (
                      <>
                        <Unlock className="h-4 w-4" /> Release
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4" /> Lock for me
                      </>
                    )}
                  </Button>
                  <Button onClick={() => router.push(`/labs/${lab.id}`)} className="bg-[#0f4d92] hover:bg-[#0a3d7a]">
                    Manage
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
