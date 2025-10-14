"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Users, Monitor, AlertTriangle, CheckCircle2, UserPlus, Download, RotateCcw, FileText, Calendar, Eye, Loader2, RefreshCw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase" // Import your Supabase client

// Server configuration - SAME AS LabStatusPage
const SERVER_BASE_URL = "http://10.100.15.252:3001"

// Global cache for lab data
interface LabCache {
  data: Lab[]
  lastFetched: number
  isInitialized: boolean
}

// Create a global cache object that persists across page navigation
declare global {
  interface Window {
    labsCache?: LabCache
  }
}

// Initialize global cache if it doesn't exist
const getLabsCache = (): LabCache => {
  if (typeof window !== 'undefined') {
    if (!window.labsCache) {
      window.labsCache = {
        data: [],
        lastFetched: 0,
        isInitialized: false
      }
    }
    return window.labsCache
  }
  return { data: [], lastFetched: 0, isInitialized: false }
}

const setLabsCache = (data: Lab[]) => {
  if (typeof window !== 'undefined') {
    window.labsCache = {
      data: [...data],
      lastFetched: Date.now(),
      isInitialized: true
    }
  }
}

const clearLabsCache = () => {
  if (typeof window !== 'undefined') {
    window.labsCache = {
      data: [],
      lastFetched: 0,
      isInitialized: false
    }
  }
}

// Tooltip component
const Tooltip = ({ children, content }: { children: React.ReactNode; content: string }) => {
  return (
    <div className="relative group">
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 pointer-events-none">
        {content}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
      </div>
    </div>
  )
}

interface Machine {
  id: string // e.g., "TWK-005-01-01"
  labId: string
  row: number
  position: number
  isWorking: boolean
  assignedStudent?: string
}

interface Lab {
  id: string
  name: string
  totalMachines: number
  machinesUp: number
  machinesDown: number
  status: "Available" | "In Use" | "Offline" | "Loading"
  currentBooking?: {
    course: string
    instructor: string
    time: string
    studentsBooked: number
  }
  machines: Machine[]
  allocatedStudents: string[]
  lastUpdated?: string
  isLoading?: boolean
  // NEW: Store the actual list of online machines
  onlineMachineIds: string[]
}

interface StudentAllocation {
  studentNumber: string
  labId: string
  machineId: string
  row: number
  position: number
}

export default function LabsOverview() {
  const [labs, setLabs] = useState<Lab[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [studentNumbers, setStudentNumbers] = useState("")
  const [allocationStrategy, setAllocationStrategy] = useState<"balanced" | "fill-first" | "preference" | "select-manually">("fill-first")
  const [allocations, setAllocations] = useState<StudentAllocation[]>([])
  const [error, setError] = useState("")
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0])
  const [examType, setExamType] = useState<"exam" | "test">("exam")
  const [examName, setExamName] = useState("")
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importedStudents, setImportedStudents] = useState<string[]>([])
  const [inputMethod, setInputMethod] = useState<"manual" | "csv">("manual")
  const [selectedLabs, setSelectedLabs] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Lab capacity data - SAME AS LabStatusPage
  const labCapacities: Record<string, number> = {
    "004": 100,
    "005": 100,
    "006": 100,
    "106": 16,
    "108": 50,
    "109": 50,
    "110": 50,
    "111": 50,
  }

  // Function to save seating plan to Supabase
  // Function to save seating plan to Supabase
// Function to save seating plan to Supabase
// Function to save seating plan to Supabase
const saveSeatingPlanToDatabase = async (allocations: StudentAllocation[]) => {
  setIsSaving(true)
  try {
    // Get the current user session
    const userSessionStr = sessionStorage.getItem('userSession')
    if (!userSessionStr) {
      throw new Error("User not authenticated")
    }
    
    const userSession = JSON.parse(userSessionStr)
    const userEmail = userSession.email
    
    if (!userEmail) {
      throw new Error("User email not found in session")
    }

    // Fetch the user's database ID using their email
    const { data: userData, error: userError } = await supabase
      .from('user')
      .select('id')
      .eq('email', userEmail)
      .single()

    if (userError) {
      console.error('Error fetching user data:', userError)
      throw new Error(`Failed to find user in database: ${userError.message}`)
    }

    if (!userData || !userData.id) {
      throw new Error("User not found in user table")
    }

    const adminId = userData.id
    console.log('Found admin ID:', adminId)

    // Prepare data for insertion - REMOVED machine_id completely
    const seatingData = allocations.map(allocation => ({
      admin_id: adminId,
      lab_id: allocation.labId,
      student_number: allocation.studentNumber,
      assessment_type: examType,
      assessment_name: examName,
      assessment_date: examDate,
      //row: allocation.row,
      //position: allocation.position
    }))

    console.log('Sample seating data:', seatingData[0]) // Debug log

    // Insert data into Supabase
    const { data, error: supabaseError } = await supabase
      .from('seating')
      .insert(seatingData)
      .select()

    if (supabaseError) {
      console.error('Supabase error details:', supabaseError)
      throw new Error(supabaseError.message)
    }

    console.log('Successfully inserted seating data:', data)
    showSuccessToast(
      "Seating Plan Saved", 
      "Seating plan has been successfully saved to the database"
    )
    return data
  } catch (error: any) {
    console.error("Error saving seating plan:", error)
    showErrorToast("Save Failed", error.message || "Failed to save seating plan to database")
    throw error
  } finally {
    setIsSaving(false)
  }
}

  // NEW: Function to fetch machine status from server
  const fetchLabMachineStatus = async (labId: string): Promise<{ 
    machinesUp: number; 
    machinesDown: number; 
    lastUpdated: string;
    onlineMachineIds: string[]
  }> => {
    try {
      const response = await fetch(`${SERVER_BASE_URL}/api/commands/${labId}/listmachinesup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        const totalMachines = labCapacities[labId] || 50
        
        if (data.success && data.machines && Array.isArray(data.machines)) {
          const onlineMachineIds = data.machines
          return {
            machinesUp: onlineMachineIds.length,
            machinesDown: totalMachines - onlineMachineIds.length,
            lastUpdated: new Date().toLocaleTimeString(),
            onlineMachineIds
          }
        } else if (data.success && Array.isArray(data.output)) {
          const cleanOutput = data.output.map((line: string) => 
            line.replace(/\u001b\[\?2004[lh]|\r/g, '').trim()
          ).filter((line: string) => line.length > 0)
          
          return {
            machinesUp: cleanOutput.length,
            machinesDown: totalMachines - cleanOutput.length,
            lastUpdated: new Date().toLocaleTimeString(),
            onlineMachineIds: cleanOutput
          }
        }
      }
      
      // Fallback to previous values if request fails
      throw new Error('Failed to fetch machine status')
      
    } catch (error) {
      console.error(`Failed to fetch status for Lab ${labId}:`, error)
      // Return current values as fallback
      const cache = getLabsCache()
      const cachedLab = cache.data.find(l => l.id === labId)
      if (cachedLab) {
        return {
          machinesUp: cachedLab.machinesUp,
          machinesDown: cachedLab.machinesDown,
          lastUpdated: cachedLab.lastUpdated || 'Unknown',
          onlineMachineIds: cachedLab.onlineMachineIds || []
        }
      }
      
      // Final fallback
      const totalMachines = labCapacities[labId] || 50
      return {
        machinesUp: 0,
        machinesDown: totalMachines,
        lastUpdated: 'Error',
        onlineMachineIds: []
      }
    }
  }

  // Generate machines for each lab with the corrected TWK naming convention
  const generateMachines = (labId: string, totalMachines: number, onlineMachineIds: string[]): Machine[] => {
    const machines: Machine[] = []
    let machineIndex = 0

    if (labId === "004" || labId === "005" || labId === "006") {
      for (let row = 1; row <= 10; row++) {
        for (let position = 1; position <= 10; position++) {
          machineIndex++
          const machineId = `twk${labId}-${String(row).padStart(2, "0")}-${String(position).padStart(2, "0")}`
          machines.push({
            id: machineId,
            labId,
            row,
            position,
            isWorking: onlineMachineIds.includes(machineId),
          })
        }
      }
    } else if (labId === "106") {
      const lab106Layout = [
        { row: 1, positions: 2 },
        { row: 2, positions: 1 },
        { row: 3, positions: 2 },
        { row: 4, positions: 3 },
        { row: 5, positions: 5 },
        { row: 6, positions: 3 },
      ]

      for (const rowConfig of lab106Layout) {
        for (let position = 1; position <= rowConfig.positions; position++) {
          machineIndex++
          const machineId = `twk${labId}-${String(rowConfig.row).padStart(2, "0")}-${String(position).padStart(2, "0")}`
          machines.push({
            id: machineId,
            labId,
            row: rowConfig.row,
            position,
            isWorking: onlineMachineIds.includes(machineId),
          })
        }
      }
    } else {
      const layouts = {
        "108": [
          { row: 1, seats: 9 },
          { row: 2, seats: 9 },
          { row: 3, seats: 8 },
          { row: 4, seats: 8 },
          { row: 5, seats: 8 },
          { row: 6, seats: 8 },
        ],
        "109": [
          { row: 1, seats: 9 },
          { row: 2, seats: 9 },
          { row: 3, seats: 8 },
          { row: 4, seats: 8 },
          { row: 5, seats: 8 },
          { row: 6, seats: 8 },
        ],
        "110": [
          { row: 1, seats: 9 },
          { row: 2, seats: 9 },
          { row: 3, seats: 8 },
          { row: 4, seats: 8 },
          { row: 5, seats: 8 },
          { row: 6, seats: 8 },
        ],
        "111": [
          { row: 1, seats: 9 },
          { row: 2, seats: 9 },
          { row: 3, seats: 8 },
          { row: 4, seats: 8 },
          { row: 5, seats: 8 },
          { row: 6, seats: 8 },
        ],
      }

      const layout = layouts[labId as keyof typeof layouts] || []

      for (const rowConfig of layout) {
        for (let position = 1; position <= rowConfig.seats; position++) {
          machineIndex++
          const machineId = `twk${labId}-${String(rowConfig.row).padStart(2, "0")}-${String(position).padStart(2, "0")}`
          machines.push({
            id: machineId,
            labId,
            row: rowConfig.row,
            position,
            isWorking: onlineMachineIds.includes(machineId),
          })
        }
      }
    }

    return machines
  }

  useEffect(() => {
    const cache = getLabsCache()
    
    if (cache.isInitialized && cache.data.length > 0) {
      setLabs(cache.data)
      setIsLoading(false)
      return
    }

    fetchAllLabsData()
  }, [])

  const fetchAllLabsData = async () => {
    setIsLoading(true)
    
    const labIds = ["004", "005", "006", "106", "108", "109", "110", "111"]
    const initialLabs: Lab[] = labIds.map(labId => ({
      id: labId,
      name: `Lab ${labId}`,
      totalMachines: labCapacities[labId],
      machinesUp: 0,
      machinesDown: labCapacities[labId],
      status: "Loading" as const,
      machines: [],
      allocatedStudents: [],
      lastUpdated: undefined,
      isLoading: true,
      onlineMachineIds: []
    }))
    
    setLabs(initialLabs)
    setIsLoading(false)

    labIds.forEach(async (labId) => {
      try {
        const status = await fetchLabMachineStatus(labId)
        
        setLabs(prevLabs => {
          const updatedLabs = prevLabs.map(lab => {
            if (lab.id === labId) {
              return {
                ...lab,
                machinesUp: status.machinesUp,
                machinesDown: status.machinesDown,
                lastUpdated: status.lastUpdated,
                status: status.machinesUp > 0 ? "Available" as const : "Offline" as const,
                machines: generateMachines(lab.id, lab.totalMachines, status.onlineMachineIds),
                isLoading: false,
                onlineMachineIds: status.onlineMachineIds
              }
            }
            return lab
          })
          
          setLabsCache(updatedLabs)
          return updatedLabs
        })
        
      } catch (error) {
        console.error(`Failed to fetch data for Lab ${labId}:`, error)
        
        setLabs(prevLabs => {
          const updatedLabs = prevLabs.map(lab => 
            lab.id === labId ? { 
              ...lab, 
              isLoading: false, 
              status: "Offline" as const,
              lastUpdated: 'Error',
              onlineMachineIds: []
            } : lab
          )
          setLabsCache(updatedLabs)
          return updatedLabs
        })
      }
    })
  }

  const refreshAllLabs = async () => {
    setIsRefreshing(true)
    
    clearLabsCache()
    
    setLabs(prevLabs => 
      prevLabs.map(lab => ({ ...lab, isLoading: true, status: "Loading" as const }))
    )
    
    try {
      const labIds = ["004", "005", "006", "106", "108", "109", "110", "111"]
      
      const refreshPromises = labIds.map(async (labId) => {
        try {
          const status = await fetchLabMachineStatus(labId)
          
          setLabs(prevLabs => {
            const updatedLabs = prevLabs.map(lab => {
              if (lab.id === labId) {
                return {
                  ...lab,
                  machinesUp: status.machinesUp,
                  machinesDown: status.machinesDown,
                  lastUpdated: status.lastUpdated,
                  status: status.machinesUp > 0 ? "Available" as const : "Offline" as const,
                  machines: generateMachines(lab.id, lab.totalMachines, status.onlineMachineIds),
                  isLoading: false,
                  onlineMachineIds: status.onlineMachineIds
                }
              }
              return lab
            })
            
            setLabsCache(updatedLabs)
            return updatedLabs
          })
          
        } catch (error) {
          console.error(`Failed to refresh Lab ${labId}:`, error)
          
          setLabs(prevLabs => {
            const updatedLabs = prevLabs.map(lab => 
              lab.id === labId ? { 
                ...lab, 
                isLoading: false, 
                status: "Offline" as const,
                lastUpdated: 'Error',
                onlineMachineIds: []
              } : lab
            )
            setLabsCache(updatedLabs)
            return updatedLabs
          })
        }
      })
      
      await Promise.allSettled(refreshPromises)
      
      showSuccessToast(
        "Labs Refreshed Successfully", 
        "All lab data has been updated with the latest machine status"
      )
    } catch (error) {
      showErrorToast("Refresh Failed", "Error refreshing lab data. Please try again.")
    } finally {
      setIsRefreshing(false)
    }
  }

  const refreshLabData = async (labId: string) => {
    setLabs(prevLabs => 
      prevLabs.map(lab => 
        lab.id === labId ? { ...lab, isLoading: true } : lab
      )
    )

    try {
      const status = await fetchLabMachineStatus(labId)
      
      const updatedLabs = labs.map(lab => {
        if (lab.id === labId) {
          return {
            ...lab,
            machinesUp: status.machinesUp,
            machinesDown: status.machinesDown,
            lastUpdated: status.lastUpdated,
            status: status.machinesUp > 0 ? "Available" as const : "Offline" as const,
            machines: generateMachines(lab.id, lab.totalMachines, status.onlineMachineIds),
            isLoading: false,
            onlineMachineIds: status.onlineMachineIds
          }
        }
        return lab
      })

      setLabs(updatedLabs)
      setLabsCache(updatedLabs)
      
    } catch (error) {
      const updatedLabs = labs.map(lab => 
        lab.id === labId ? { 
          ...lab, 
          isLoading: false, 
          status: "Offline" as const,
          lastUpdated: 'Error',
          onlineMachineIds: []
        } : lab
      )
      setLabs(updatedLabs)
      setLabsCache(updatedLabs)
    }
  }

  const showSuccessToast = (title: string, description: string) => {
    const toastDiv = document.createElement('div')
    toastDiv.className = 'fixed top-4 right-4 bg-green-600 text-white p-4 rounded-lg shadow-lg z-50 max-w-md transform transition-all duration-300 ease-in-out'
    toastDiv.innerHTML = `
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <div>
          <div class="font-semibold text-sm">${title}</div>
          <div class="text-sm opacity-90 mt-1">${description}</div>
        </div>
      </div>
    `
    document.body.appendChild(toastDiv)
    
    setTimeout(() => {
      toastDiv.style.transform = 'translateX(0)'
    }, 100)
    
    setTimeout(() => {
      toastDiv.style.transform = 'translateX(100%)'
      setTimeout(() => {
        if (document.body.contains(toastDiv)) {
          document.body.removeChild(toastDiv)
        }
      }, 300)
    }, 5000)
  }

  const showErrorToast = (title: string, description: string) => {
    setError(`${title}: ${description}`)
    setTimeout(() => setError(""), 5000)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Available":
        return "bg-green-500"
      case "In Use":
        return "bg-blue-500"
      case "Offline":
        return "bg-red-500"
      case "Loading":
        return "bg-gray-400"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Available":
        return <CheckCircle2 className="h-4 w-4" />
      case "In Use":
        return <Users className="h-4 w-4" />
      case "Offline":
        return <AlertTriangle className="h-4 w-4" />
      case "Loading":
        return <Loader2 className="h-4 w-4 animate-spin" />
      default:
        return <Monitor className="h-4 w-4" />
    }
  }

  const getAvailableMachines = (lab: Lab): Machine[] => {
    if (lab.status === "Offline") return []

    const currentlyBooked = lab.currentBooking?.studentsBooked || 0
    const workingMachines = lab.machines.filter((m) => m.isWorking && !m.assignedStudent)

    return workingMachines.slice(currentlyBooked)
  }

  const getNextAvailableMachine = (lab: Lab): Machine | null => {
    const availableMachines = getAvailableMachines(lab)
    return availableMachines.length > 0 ? availableMachines[0] : null
  }

  const calculateAvailableSeats = (lab: Lab) => {
    return getAvailableMachines(lab).length
  }

  const getTotalAvailableSeats = () => {
    if (allocationStrategy === "select-manually") {
      return labs
        .filter(lab => selectedLabs.includes(lab.id))
        .reduce((total, lab) => total + calculateAvailableSeats(lab), 0)
    } else {
      return labs
        .filter(lab => lab.status !== "Offline")
        .reduce((total, lab) => total + calculateAvailableSeats(lab), 0)
    }
  }

  const parseStudentNumbers = (input: string): string[] => {
    return input
      .split(/[\n,;]/)
      .map((num) => num.trim())
      .filter((num) => num.length > 0)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      showErrorToast("Invalid File Type", "Please upload a CSV file")
      return
    }

    setCsvFile(file)
    
    try {
      const text = await file.text()
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
      
      const students = lines.map(line => {
        const columns = line.split(',').map(col => col.trim().replace(/"/g, ''))
        return columns[0]
      }).filter(student => {
        if (!student || student.length === 0) return false
        
        const lowerStudent = student.toLowerCase()
        const commonHeaders = [
          'student', 'student number', 'student_number', 'studentnumber', 
          'id', 'number', 'student id', 'student_id', 'studentid',
          'reg', 'registration', 'reg_no', 'regno', 'registration_number',
          'matric', 'matriculation', 'matric_no', 'matricno'
        ]
        if (commonHeaders.some(header => lowerStudent.includes(header))) return false
        
        if (!/\d/.test(student)) return false
        
        const letterCount = (student.match(/[a-zA-Z]/g) || []).length
        const totalLength = student.length
        if (letterCount > totalLength * 0.5) return false
        
        return true
      })

      if (students.length === 0) {
        showErrorToast(
          "No Valid Student Numbers Found", 
          "Make sure student numbers are in the first column and contain numeric characters. Headers will be automatically skipped."
        )
        return
      }

      const sortedStudents = students.sort((a, b) => {
        const aNum = a.match(/\d+/)?.[0] || a
        const bNum = b.match(/\d+/)?.[0] || b
        return aNum.localeCompare(bNum, undefined, { numeric: true })
      })
      
      setImportedStudents(sortedStudents)
      setStudentNumbers(sortedStudents.join('\n'))
      
      showSuccessToast(
        "CSV Imported Successfully", 
        `${sortedStudents.length} student numbers imported from ${file.name}`
      )
    } catch (error) {
      showErrorToast("Import Failed", "Error reading CSV file. Please check file format.")
    }
  }

  const getCurrentStudentList = (): string[] => {
    if (inputMethod === "csv" && importedStudents.length > 0) {
      return importedStudents
    }
    return parseStudentNumbers(studentNumbers)
  }

  const handleLabSelection = (labId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedLabs(prev => [...prev, labId])
    } else {
      setSelectedLabs(prev => prev.filter(id => id !== labId))
    }
  }

  const toggleAllLabs = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedLabs(labs.map(lab => lab.id))
    } else {
      setSelectedLabs([])
    }
  }

  const generateSeatingPlan = async () => {
    if (!examType) {
      showErrorToast("Missing Information", "Please select an assessment type")
      return
    }
    
    if (!examDate) {
      showErrorToast("Missing Information", "Please select an assessment date")
      return
    }
    
    if (!examName.trim()) {
      showErrorToast("Missing Information", "Please enter an assessment name")
      return
    }

    if (allocationStrategy === "select-manually" && selectedLabs.length === 0) {
      showErrorToast("No Labs Selected", "Please select at least one lab for allocation")
      return
    }

    const students = getCurrentStudentList()
    if (students.length === 0) {
      showErrorToast("No Students Found", "Please enter student numbers manually or import a CSV file")
      return
    }

    const totalAvailable = getTotalAvailableSeats()
    if (students.length > totalAvailable) {
      showErrorToast(
        "Insufficient Capacity",
        `Only ${totalAvailable} seats available in selected labs. Cannot allocate ${students.length} students.`
      )
      return
    }

    const newAllocations: StudentAllocation[] = []
    const updatedLabs = [...labs]

    // Determine which labs to use based on allocation strategy
    let labsToUse: Lab[]
    if (allocationStrategy === "select-manually") {
      labsToUse = updatedLabs.filter(lab => selectedLabs.includes(lab.id))
    } else {
      labsToUse = updatedLabs.filter(lab => lab.status !== "Offline")
    }

    switch (allocationStrategy) {
      case "balanced":
      case "select-manually": // Use balanced strategy for manual selection too
        const availableLabs = labsToUse.filter((lab) => calculateAvailableSeats(lab) > 0)
        let labIndex = 0

        for (const student of students) {
          let allocated = false
          let attempts = 0

          while (!allocated && attempts < availableLabs.length) {
            const lab = availableLabs[labIndex % availableLabs.length]
            const machine = getNextAvailableMachine(lab)

            if (machine) {
              machine.assignedStudent = student

              newAllocations.push({
                studentNumber: student,
                labId: lab.id,
                machineId: machine.id,
                row: machine.row,
                position: machine.position,
              })

              lab.allocatedStudents.push(student)
              allocated = true
            }

            labIndex++
            attempts++
          }

          if (!allocated) {
            console.warn(`Could not allocate student ${student} - no available seats`)
          }
        }
        break

      case "fill-first":
        for (const student of students) {
          let allocated = false

          for (const lab of labsToUse) {
            const machine = getNextAvailableMachine(lab)
            if (machine) {
              machine.assignedStudent = student

              newAllocations.push({
                studentNumber: student,
                labId: lab.id,
                machineId: machine.id,
                row: machine.row,
                position: machine.position,
              })

              lab.allocatedStudents.push(student)
              allocated = true
              break
            }
          }

          if (!allocated) {
            console.warn(`Could not allocate student ${student} - no available seats`)
            break
          }
        }
        break

      case "preference":
        const sortedLabs = [...labsToUse].sort((a, b) => calculateAvailableSeats(b) - calculateAvailableSeats(a))

        for (const student of students) {
          let allocated = false

          for (const lab of sortedLabs) {
            const machine = getNextAvailableMachine(lab)
            if (machine) {
              machine.assignedStudent = student

              newAllocations.push({
                studentNumber: student,
                labId: lab.id,
                machineId: machine.id,
                row: machine.row,
                position: machine.position,
              })

              lab.allocatedStudents.push(student)
              allocated = true
              break
            }
          }

          if (!allocated) {
            console.warn(`Could not allocate student ${student} - no available seats`)
            break
          }
        }
        break
    }

    setLabs(updatedLabs)
    setAllocations(newAllocations)
    setError("")

    setLabsCache(updatedLabs)

    // Save to database
    try {
      await saveSeatingPlanToDatabase(newAllocations)
      showSuccessToast(
        "Seating Plan Generated and Saved Successfully!",
        `${newAllocations.length} students allocated across ${
          new Set(newAllocations.map((a) => a.labId)).size
        } labs. Data has been saved to the database. You can now export to PDF.`
      )
    } catch (error) {
      // Error is already handled in saveSeatingPlanToDatabase
      // Still show success for generation but mention database save failed
      showSuccessToast(
        "Seating Plan Generated!",
        `${newAllocations.length} students allocated across ${
          new Set(newAllocations.map((a) => a.labId)).size
        } labs. However, saving to database failed. You can still export to PDF.`
      )
    }
  }

  const clearAllAllocations = () => {
    const clearedLabs = labs.map((lab) => ({
      ...lab,
      allocatedStudents: [],
      machines: lab.machines.map((machine) => ({
        ...machine,
        assignedStudent: undefined,
      })),
    }))
    
    setLabs(clearedLabs)
    setAllocations([])
    setStudentNumbers("")
    setCsvFile(null)
    setImportedStudents([])
    setError("")

    setLabsCache(clearedLabs)

    showSuccessToast("Allocations Cleared", "All seat allocations have been cleared successfully")
  }

  const exportToPDF = () => {
    if (allocations.length === 0) {
      showErrorToast("No Allocations Found", "Generate a seating plan first before exporting")
      return
    }

    const sortedAllocations = [...allocations].sort((a, b) => 
      a.studentNumber.localeCompare(b.studentNumber, undefined, { numeric: true })
    )

    const pdfContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>TW Kambule Labs - Seating Plan</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #000;
              margin: 0;
              font-size: 24px;
              font-weight: bold;
            }
            .header h2 {
              color: #000;
              margin: 10px 0;
              font-size: 20px;
              font-weight: normal;
            }
            .header h3 {
              color: #333;
              margin: 10px 0;
              font-size: 18px;
              font-weight: bold;
            }
            .header p {
              margin: 5px 0;
              color: #666;
              font-size: 14px;
            }
            
            .summary-info {
              margin-bottom: 20px;
              text-align: center;
            }
            
            .allocation-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
              font-size: 12px;
            }
            
            .allocation-table th {
              background-color: #000;
              color: white;
              padding: 8px;
              text-align: center;
              font-weight: bold;
              border: 1px solid #000;
            }
            
            .allocation-table td {
              padding: 6px 8px;
              text-align: center;
              border: 1px solid #000;
              vertical-align: middle;
            }
            
            .allocation-table tbody tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            
            .student-number {
              font-weight: bold;
              font-family: monospace;
            }
            
            .module-code {
              font-family: monospace;
              font-weight: bold;
            }
            
            .seat-number {
              font-weight: bold;
              color: #1e40af;
            }
            
            .lab-header {
              background-color: #e5e7eb;
              font-weight: bold;
              text-align: center;
              padding: 10px;
              border: 2px solid #000;
            }
            
            .page-break {
              page-break-before: always;
            }
            
            @media print {
              body { 
                margin: 15px;
                font-size: 11px;
              }
              .allocation-table {
                font-size: 10px;
              }
              .lab-header {
                background-color: #e5e7eb !important;
                -webkit-print-color-adjust: exact;
              }
              .allocation-table th {
                background-color: #000 !important;
                color: white !important;
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>TW KAMBULE LABORATORIES</h1>
            <h2>${examType.toUpperCase() === 'EXAM' ? 'EXAMINATION' : 'TEST'} SEATING PLAN</h2>
            ${examName ? `<h3>${examName.toUpperCase()}</h3>` : ''}
            <p><strong>Date:</strong> ${new Date(examDate).toLocaleDateString('en-GB', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
            <p><strong>Total Students:</strong> ${allocations.length} | <strong>Labs Used:</strong> ${new Set(allocations.map((a) => a.labId)).size}</p>
          </div>

          <table class="allocation-table">
            <thead>
              <tr>
                <th style="width: 25%;">STUDENT NUMBER</th>
                <th style="width: 20%;">VENUE</th>
                <th style="width: 15%;">LAB</th>
                <th style="width: 10%;">ROW</th>
                <th style="width: 15%;">SEAT</th>
              </tr>
            </thead>
            <tbody>
              ${allocations
                .filter((allocation) => labs.find(l => l.id === allocation.labId))
                .sort((a, b) => a.studentNumber.localeCompare(b.studentNumber, undefined, { numeric: true }))
                .map((allocation, index, sortedAllocations) => {
                  const lab = labs.find(l => l.id === allocation.labId)
                  const isFirstInLab = index === 0 || sortedAllocations[index - 1].labId !== allocation.labId
                  const labHeaderRow = isFirstInLab ? `
                    <tr>
                      <td colspan="5" class="lab-header">
                        ${lab?.name.toUpperCase()} - ${sortedAllocations.filter(a => a.labId === allocation.labId).length} STUDENTS
                      </td>
                    </tr>
                  ` : ''
                  
                  return `
                    ${labHeaderRow}
                    <tr>
                      <td class="student-number">${allocation.studentNumber}</td>
                      <td class="module-code">MSL${allocation.labId}</td>
                      <td>${allocation.labId}</td>
                      <td>${allocation.row}</td>
                      <td class="seat-number">${allocation.position}</td>
                    </tr>
                  `
                }).join('')}
            </tbody>
          </table>

          <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #666;">
            <p>TW Kambule Laboratories - Computer Lab Management System</p>
            <p>Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </body>
      </html>
    `

    const blob = new Blob([pdfContent], { type: 'text/html' })
    const url = window.URL.createObjectURL(blob)
    const printWindow = window.open(url, '_blank')
    
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.focus()
        printWindow.print()
        setTimeout(() => {
          printWindow.close()
          window.URL.revokeObjectURL(url)
        }, 1000)
      }
    }

    showSuccessToast("PDF Export Completed", "Seating plan has been sent to your printer/PDF viewer")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-[#0f4d92] text-white p-4">
          <div className="container mx-auto flex justify-between items-center">
          <Button variant="ghost" size="icon" asChild className="text-white hover:bg-white/10">
              <Link href="/dashboard">
                <ArrowLeft className="h-5 w-5 text-white group-hover:text-white" />
              </Link>
            </Button>
            <h1 className="text-xl font-bold">TW Kambule Laboratories</h1>
          </div>
        </header>
        <main className="container mx-auto p-4 sm:p-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <div className="text-center">
              <h2 className="text-lg font-medium text-gray-700">Loading Lab Data</h2>
              <p className="text-sm text-gray-500">Fetching real-time machine status across all labs...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#0f4d92] text-white p-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                <ArrowLeft className="h-5 w-5 text-white group-hover:text-white" />
              </Button>
            </Link>
              <h1 className="text-lg sm:text-2xl font-bold">TW Kambule Labs</h1>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="hidden sm:block text-sm text-blue-100">
                {getLabsCache().lastFetched > 0 && (
                  `Last updated: ${new Date(getLabsCache().lastFetched).toLocaleTimeString()}`
                )}
              </span>
              <Tooltip content="Refresh all lab data to get the latest machine status">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshAllLabs}
                  disabled={isRefreshing}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs sm:text-sm"
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">
                    {isRefreshing ? "Refreshing..." : "Refresh All Labs"}
                  </span>
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {getLabsCache().isInitialized && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-blue-700">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm font-medium">Using cached lab data</span>
              </div>
              <div className="text-xs text-blue-600">
                Fetched: {new Date(getLabsCache().lastFetched).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <UserPlus className="h-5 w-5" />
              Generate Seating Plan
            </CardTitle>
            <CardDescription className="text-sm">
              Allocate students across available labs. Total capacity: {getTotalAvailableSeats()} seats
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2 text-sm sm:text-base">
                <Calendar className="h-4 w-4" />
                Required Information
              </h4>
              
              <div className="space-y-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4 sm:space-y-0">
                <div>
                  <Label htmlFor="examType" className="text-blue-900 text-sm">
                    Assessment Type <span className="text-red-500">*</span>
                  </Label>
                  <Select value={examType} onValueChange={(value: any) => setExamType(value)}>
                    <SelectTrigger className="border-blue-200 mt-1">
                      <SelectValue placeholder="Select assessment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exam">Examination</SelectItem>
                      <SelectItem value="test">Test</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="examDate" className="text-blue-900 text-sm">
                    Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="examDate"
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="border-blue-200 mt-1"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="examName" className="text-blue-900 text-sm">
                    Assessment Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="examName"
                    placeholder="e.g., Computer Science Mid-term"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    className="border-blue-200 mt-1"
                  />
                </div>
              </div>
            </div>

            {/* NEW: Only show lab selection when manual strategy is selected */}
            {allocationStrategy === "select-manually" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <Monitor className="h-4 w-4" />
                  Select Labs for Allocation
                </h4>
                
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-blue-900 text-sm">Available Labs</Label>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => toggleAllLabs(true)}
                      className="text-xs h-8"
                    >
                      Select All
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => toggleAllLabs(false)}
                      className="text-xs h-8"
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {labs.map((lab) => (
                    <div key={lab.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`lab-${lab.id}`}
                        checked={selectedLabs.includes(lab.id)}
                        onCheckedChange={(checked) => 
                          handleLabSelection(lab.id, checked as boolean)
                        }
                        disabled={lab.status === "Offline" || lab.isLoading}
                      />
                      <Label 
                        htmlFor={`lab-${lab.id}`} 
                        className={`text-sm font-normal ${
                          lab.status === "Offline" || lab.isLoading ? "text-gray-400" : ""
                        }`}
                      >
                        {lab.name}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {selectedLabs.length} of {labs.length} labs selected
                </p>
              </div>
            )}

            <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Student Numbers Input Method</Label>
                  <div className="flex gap-2 mt-2">
                    <Tooltip content="Type student numbers manually in the text area">
                      <Button
                        type="button"
                        variant={inputMethod === "manual" ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setInputMethod("manual")
                          setImportedStudents([])
                          setCsvFile(null)
                        }}
                        className="flex-1 text-xs sm:text-sm"
                      >
                        Manual Entry
                      </Button>
                    </Tooltip>
                    <Tooltip content="Upload a CSV file containing student numbers">
                      <Button
                        type="button"
                        variant={inputMethod === "csv" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setInputMethod("csv")}
                        className="flex-1 text-xs sm:text-sm"
                      >
                        CSV Import
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                {inputMethod === "manual" && (
                  <div>
                    <Label htmlFor="students" className="text-sm">Student Numbers <span className="text-red-500">*</span></Label>
                    <Textarea
                      id="students"
                      placeholder="Enter student numbers (one per line or comma-separated)&#10;e.g.:&#10;2024001&#10;2024002&#10;2024003"
                      value={studentNumbers}
                      onChange={(e) => setStudentNumbers(e.target.value)}
                      rows={6}
                      className="font-mono text-sm mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Students entered: {parseStudentNumbers(studentNumbers).length}
                    </p>
                  </div>
                )}

                {inputMethod === "csv" && (
                  <div className="space-y-3">
                    <Label htmlFor="csvFile" className="text-sm">Upload CSV File <span className="text-red-500">*</span></Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 text-center">
                      <input
                        id="csvFile"
                        type="file"
                        accept=".csv"
                        onChange={handleCSVUpload}
                        className="hidden"
                      />
                      <Tooltip content="Upload a CSV file with student numbers in the first column. Headers will be automatically detected and skipped.">
                        <label
                          htmlFor="csvFile"
                          className="cursor-pointer flex flex-col items-center gap-2"
                        >
                          <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">
                            Click to upload CSV file
                          </span>
                          <span className="text-xs text-gray-500 text-center">
                            Student numbers should be in the first column
                          </span>
                        </label>
                      </Tooltip>
                    </div>
                    
                    {csvFile && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-green-800">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm font-medium truncate">{csvFile.name}</span>
                        </div>
                        <p className="text-xs text-green-600 mt-1">
                          {importedStudents.length} student numbers imported
                        </p>
                      </div>
                    )}

                    {importedStudents.length > 0 && (
                      <div className="max-h-32 overflow-y-auto bg-gray-50 rounded p-3">
                        <p className="text-xs text-gray-600 mb-2">Preview (first 10):</p>
                        <div className="text-xs font-mono space-y-1">
                          {importedStudents.slice(0, 10).map((student, index) => (
                            <div key={index}>{student}</div>
                          ))}
                          {importedStudents.length > 10 && (
                            <div className="text-gray-500">...and {importedStudents.length - 10} more</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label htmlFor="strategy" className="text-sm">Allocation Strategy</Label>
                  <Tooltip content="Choose how students are distributed across available labs">
                    <Select value={allocationStrategy} onValueChange={(value: any) => setAllocationStrategy(value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="balanced">Balanced - Distribute evenly</SelectItem>
                        <SelectItem value="fill-first">Fill First - Fill labs in order</SelectItem>
                        <SelectItem value="preference">Preference - Prefer larger labs</SelectItem>
                        <SelectItem value="select-manually">Select Labs Manually</SelectItem>
                      </SelectContent>
                    </Select>
                  </Tooltip>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                  <h4 className="font-medium mb-3 text-sm sm:text-base">Capacity Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total Available Seats:</span>
                      <span className="font-medium text-green-600">{getTotalAvailableSeats()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Students to Allocate:</span>
                      <span className="font-medium text-blue-600">{getCurrentStudentList().length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Remaining Capacity:</span>
                      <span className="font-medium text-gray-600">
                        {Math.max(0, getTotalAvailableSeats() - getCurrentStudentList().length)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-0 sm:flex sm:gap-2">
                  <Tooltip content="Create seating plan with current settings and student list">
                    <Button 
                      onClick={generateSeatingPlan} 
                      className="w-full sm:flex-1 text-sm" 
                      disabled={!examType || !examDate || !examName.trim() || getCurrentStudentList().length === 0 || (allocationStrategy === "select-manually" && selectedLabs.length === 0) || isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-2" />
                      )}
                      {isSaving ? "Saving..." : "Generate Plan"}
                    </Button>
                  </Tooltip>
                  
                  <div className="flex gap-2">
                    <Tooltip content="Remove all current seat allocations and reset the system">
                      <Button variant="outline" onClick={clearAllAllocations} className="flex-1 sm:flex-none text-sm">
                        <RotateCcw className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Clear All</span>
                        <span className="sm:hidden">Clear</span>
                      </Button>
                    </Tooltip>
                    <Tooltip content="Export the current seating plan as a printable PDF document">
                      <Button variant="outline" onClick={exportToPDF} disabled={allocations.length === 0} className="flex-1 sm:flex-none text-sm">
                        <FileText className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Export PDF</span>
                        <span className="sm:hidden">PDF</span>
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {labs.map((lab) => {
            const availableSeats = calculateAvailableSeats(lab)
            const allocatedCount = lab.allocatedStudents.length
            const currentlyBooked = lab.currentBooking?.studentsBooked || 0
            const isSelected = selectedLabs.includes(lab.id) && allocationStrategy === "select-manually"

            return (
              <Card key={lab.id} className={`relative ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
                <CardHeader className="pb-3 sm:pb-6">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg sm:text-xl truncate">{lab.name}</CardTitle>
                      <CardDescription className="text-sm">{lab.totalMachines} machines</CardDescription>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      <Badge className={`${getStatusColor(lab.status)} text-white flex items-center gap-1 text-xs`}>
                        {getStatusIcon(lab.status)}
                        <span className="hidden sm:inline">{lab.status}</span>
                      </Badge>
                      {!lab.isLoading && (
                        <Tooltip content="Refresh machine status for this lab only">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => refreshLabData(lab.id)}
                            className="h-8 w-8 p-0"
                          >
                            <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 sm:space-y-4">
                  {allocationStrategy === "select-manually" && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`select-${lab.id}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => 
                          handleLabSelection(lab.id, checked as boolean)
                        }
                        disabled={lab.status === "Offline" || lab.isLoading}
                      />
                      <Label 
                        htmlFor={`select-${lab.id}`} 
                        className="text-sm font-medium"
                      >
                        Include in seating plan
                      </Label>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Machines Online</span>
                      <span className="font-medium text-green-600">
                        {lab.isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin inline" />
                        ) : (
                          `${lab.machinesUp}/${lab.totalMachines}`
                        )}
                      </span>
                    </div>
                    <Progress value={lab.isLoading ? 0 : (lab.machinesUp / lab.totalMachines) * 100} className="h-2" />
                    {lab.lastUpdated && (
                      <p className="text-xs text-gray-500">
                        Last updated: {lab.lastUpdated}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 p-3 sm:p-4 rounded-lg space-y-3">
                    <h4 className="font-medium text-sm">Seat Status</h4>

                    <div className="grid grid-cols-2 gap-2 sm:gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-lg sm:text-xl font-bold text-green-600">{availableSeats}</div>
                        <div className="text-gray-500 text-xs sm:text-sm">Available</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg sm:text-xl font-bold text-blue-600">{allocatedCount}</div>
                        <div className="text-gray-500 text-xs sm:text-sm">Allocated</div>
                      </div>
                    </div>

                    {lab.status === "In Use" && lab.currentBooking && (
                      <div className="border-t pt-3 space-y-1">
                        <div className="text-xs font-medium text-gray-700 truncate">{lab.currentBooking.course}</div>
                        <div className="text-xs text-gray-500 truncate">{lab.currentBooking.instructor}</div>
                        <div className="text-xs text-gray-500">{lab.currentBooking.time}</div>
                        <div className="text-xs">
                          <span className="font-medium">{currentlyBooked}</span> pre-booked
                        </div>
                      </div>
                    )}

                    {allocatedCount > 0 && (
                      <div className="border-t pt-2">
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">{allocatedCount}</span> students allocated by seating plan
                        </div>
                      </div>
                    )}
                  </div>
                  <Link 
                    href={{
                      pathname: `/labs/${lab.id}`,
                      query: { 
                        up: lab.machinesUp,
                        down: lab.machinesDown,
                        total: lab.totalMachines,
                        loading: lab.isLoading ? 'true' : 'false'
                      }
                    }} 
                    className={`block ${lab.isLoading ? 'pointer-events-none' : ''}`}
                  >
                    <Button 
                      className="w-full bg-[#1e40af] hover:bg-[#1d4ed8] text-sm"
                      disabled={lab.isLoading}
                    >
                      {lab.isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Lab Dashboard"
                      )}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {allocations.length > 0 && (
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="text-lg sm:text-xl">Generated Seating Plan</CardTitle>
              <CardDescription className="text-sm">
                {allocations.length} students allocated across {new Set(allocations.map((a) => a.labId)).size} labs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 sm:space-y-4">
                {labs
                  .filter((lab) => lab.allocatedStudents.length > 0)
                  .map((lab) => (
                    <div key={lab.id} className="border rounded-lg p-3 sm:p-4">
                      <h4 className="font-medium mb-3 text-sm sm:text-base">
                        {lab.name} - {lab.allocatedStudents.length} students
                      </h4>
                      <div className="space-y-1 sm:space-y-2">
                        {allocations
                          .filter((a) => a.labId === lab.id)
                          .map((allocation) => (
                            <div
                              key={`${allocation.labId}-${allocation.studentNumber}`}
                              className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-blue-50 px-3 py-2 rounded gap-2 sm:gap-0"
                            >
                              <span className="font-medium text-blue-800 text-sm">{allocation.studentNumber}</span>
                              <div className="text-xs sm:text-sm text-gray-600 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">
                                  {allocation.machineId}
                                </span>
                                <span>
                                  Row {allocation.row}, Seat {allocation.position}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}