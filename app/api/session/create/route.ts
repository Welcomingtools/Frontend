// app/api/session/create/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  try {
    // Next 15: cookies() is async and may be read-only
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          // set/remove may throw in read-only contexts; ignore if they do.
          set(name: string, value: string, options: any) {
            try {
              // Next 15 signature
              cookieStore.set({ name, value, ...options });
            } catch {}
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: "", ...options, maxAge: 0 });
            } catch {}
          },
        },
      }
    );

    // Get current user (requires you’re logged in on the site)
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    // Expect: { date, start_time, end_time, purpose_type, lab_id? }
    const b = await req.json();

    const row = {
      date: b.date,
      start_time: b.start_time,
      end_time: b.end_time,
      purpose_type: b.purpose_type,
      lab_id: b.lab_id ?? null,
      admin_id: user.id, // server sets this
    };

    const { data, error } = await supabase.from("session").insert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
  }
}
