// app/api/team/add/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Role = "Admin" | "BCDR" | "Welcoming Team";
const ROLE_TABLE: Record<Role, string> = {
  Admin: "admin",
  BCDR: "bcdr",
  "Welcoming Team": "wtm",
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // keep server-side only
);

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const role = body.role as Role;
    const name = String(body.name ?? "").trim();
    const surname = String(body.surname ?? "").trim();
    const phone_number = String(body.phone_number ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!name || !surname || !phone_number || !email || !ROLE_TABLE[role]) {
      return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
    }

    const table = ROLE_TABLE[role];
    const password = generatePassword(); // temporary password (plaintext)

    const { error } = await supabaseAdmin.from(table).insert([
      {
        username: name,
        name,
        surname,
        phone_number,
        email,
        status: "Active",
        password_hash: password, // stored as-is
      },
    ]);

    // @ts-ignore
    if (error?.code === "23505") {
      return NextResponse.json({ error: "A member with this email already exists in this team." }, { status: 409 });
    }
    if (error) {
      return NextResponse.json({ error: error.message ?? "Insert failed." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, password, email }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unexpected error." }, { status: 500 });
  }
}
