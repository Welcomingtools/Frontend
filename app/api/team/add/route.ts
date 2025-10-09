import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import nodemailer from "nodemailer"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
  },
})

function generateRandomPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnopqrstuvwxyz23456789"
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

export async function POST(req: Request) {
  try {
    const { name, email, role } = await req.json()
    
    if (!name?.trim() || !email?.trim() || !role) {
      return NextResponse.json({ error: "Missing name, email, or role" }, { status: 400 })
    }

    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()

    console.log("Checking for existing user in user table:", trimmedEmail)

    // 1. ONLY CHECK YOUR CUSTOM USER TABLE
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('user')
      .select('id, email, name')
      .eq('email', trimmedEmail)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means "no rows returned" - that's fine
      console.error("Error checking user table:", checkError)
      return NextResponse.json({ error: "Failed to check existing users" }, { status: 500 })
    }

    if (existingUser) {
      console.log("User already exists in user table:", existingUser)
      return NextResponse.json({ 
        error: "User with this email already exists in the team",
        existing: true 
      }, { status: 400 })
    }

    console.log("No existing user found, creating new user...")

    // 2. Generate temporary password
    const tempPassword = generateRandomPassword()
    console.log("Generated temp password")

    // 3. Create user in YOUR USER TABLE ONLY (skip Auth for now)
    const now = new Date().toISOString()
    const { data: newUser, error: dbError } = await supabaseAdmin
      .from('user')
      .insert([{
        name: trimmedName,
        email: trimmedEmail,
        role,
        status: "Active",
        password: tempPassword, // Store plain text temporarily
        created_at: now,  
        updated_at: now,  
      }])
      .select()
      .single()

    if (dbError) {
      console.error("DB insert error:", dbError)
      return NextResponse.json({ error: `Failed to create user: ${dbError.message}` }, { status: 400 })
    }

    console.log("User added to database successfully:", newUser)

    // 4. Send email with temporary password
    let emailSent = false
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: trimmedEmail,
        subject: "Your Welcome Tools Account Has Been Created",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0f4d92;">Welcome to the Team!</h2>
            <p>Hi <strong>${trimmedName}</strong>,</p>
            <p>Your account has been created with the following details:</p>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Email:</strong> ${trimmedEmail}</p>
              <p><strong>Role:</strong> ${role}</p>
              <p><strong> Password:</strong> <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">${tempPassword}</code></p>
            </div>
            
            <p><strong>Important:</strong> Please keep your password safe.</p>
            
            <div style="margin: 20px 0;">
              <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" 
                 style="background: #0f4d92; color: white; padding: 10px 20px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Login to Your Account
              </a>
            </div>
            
            <p style="color: #666; font-size: 12px;">
              If you didn't expect this email, please contact your administrator.
            </p>
          </div>
        `,
      })
      emailSent = true
      console.log("Email sent successfully to:", trimmedEmail)
    } catch (emailError) {
      console.error("Email sending failed:", emailError)
      // Continue even if email fails - the user was created successfully
    }

    return NextResponse.json({ 
      success: true, 
      userId: newUser.id,
      emailSent,
      message: "User created successfully" + (emailSent ? " and email sent" : " but email failed")
    })

  } catch (error: any) {
    console.error("Unexpected error in API:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" }, 
      { status: 500 }
    )
  }
}