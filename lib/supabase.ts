// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database type definitions for TypeScript
export type Database = {
  public: {
    Tables: {
      team_members: {
        Row: {
          id: string
          email: string
          name: string
          role: string
          status: string
          password: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          role: string
          status?: string
          password: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: string
          status?: string
          password?: string
          created_at?: string
          updated_at?: string
        }
      }
      user_reports: {
        Row: {
          id: string
          reported_user_id: string
          reported_user_name: string
          reported_user_email: string
          reported_user_role: string
          reporter_email: string
          reporter_name: string
          reporter_role: string
          reason: string
          details: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reported_user_id: string
          reported_user_name: string
          reported_user_email: string
          reported_user_role: string
          reporter_email: string
          reporter_name: string
          reporter_role: string
          reason: string
          details?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reported_user_id?: string
          reported_user_name?: string
          reported_user_email?: string
          reported_user_role?: string
          reporter_email?: string
          reporter_name?: string
          reporter_role?: string
          reason?: string
          details?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      maintenance_issues: {
        Row: {
          id: string
          title: string
          description: string
          status: string
          assignedTo: string | null
          reportedBy: string
          createdAt: string
          updatedAt: string | null
          category: string
          lab: string
          machineId: string
          severity: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          status?: string
          assignedTo?: string | null
          reportedBy: string
          createdAt?: string
          updatedAt?: string | null
          category: string
          lab: string
          machineId: string
          severity: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          status?: string
          assignedTo?: string | null
          reportedBy?: string
          createdAt?: string
          updatedAt?: string | null
          category?: string
          lab?: string
          machineId?: string
          severity?: string
        }
      }
      sessions: {
        Row: {
          id: number
          lab: string
          date: string
          start_time: string
          end_time: string
          purpose: string
          status: string
          created_by: string
          created_by_email: string
          created_at: string
          config_windows: boolean
          config_internet: boolean
          config_homes: boolean
          config_user_cleanup: boolean
        }
        Insert: {
          lab: string
          date: string
          start_time: string
          end_time: string
          purpose: string
          status?: string
          created_by: string
          created_by_email: string
          config_windows?: boolean
          config_internet?: boolean
          config_homes?: boolean
          config_user_cleanup?: boolean
        }
        Update: {
          lab?: string
          date?: string
          start_time?: string
          end_time?: string
          purpose?: string
          status?: string
          created_by?: string
          created_by_email?: string
          config_windows?: boolean
          config_internet?: boolean
          config_homes?: boolean
          config_user_cleanup?: boolean
        }
      }
    }
  }
}