"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Eye, EyeOff, User, Lock, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // 1) Authenticate with Supabase Auth
    const { data: signInData, error: signInErr } =
      await supabase.auth.signInWithPassword({ email, password })

      if (signInErr || !signInData.user) {
      setError("Invalid email or password")
      setIsLoading(false)
      return
    }

    // 2) Look up the role & username in your union view
    const { data: roleRow, error: roleErr } = await supabase
        .from("user_roles")
        .select("role, email, username")
        .eq("email", email.toLowerCase())
        .maybeSingle()

      if (roleErr) {
        setError(`Could not load role (${roleErr.message})`)
        setIsLoading(false)
        return
      }

      if (!roleRow) {
        setError("Your account is not assigned to a role. Please contact an administrator.")
        setIsLoading(false)
        return
      }

      // 3) Save lightweight session
      if (typeof window !== "undefined") {
        sessionStorage.setItem("userSession", JSON.stringify({
          email: roleRow.email,
          username: roleRow.username,
          role: roleRow.role,
          loginTime: new Date().toISOString(),
          accountType: "supabase_auth",
      }))
    }

    setIsLoading(false)
    router.push("/dashboard")
}


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0 bg-white/90 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-8">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-40 h-40 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-gray-200 p-4">
                <img src="/images/crest.png" alt="Wits Crest" className="w-full h-full object-contain"/>
              </div>
              <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-2 border-white shadow-md"/>
            </div>
          </div>
          <CardTitle className="text-3xl text-center font-bold bg-gradient-to-r from-[#0f4d92] to-[#1e5fa8] bg-clip-text text-transparent">
            MSS Welcoming Tools
          </CardTitle>
          <CardDescription className="text-center text-gray-600 text-base">
            Access TW Kambule Labs Management System
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input id="email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="pl-10 h-12" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e)=>setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12"
                  required
                />
                <button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full h-12">
              {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>) : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
