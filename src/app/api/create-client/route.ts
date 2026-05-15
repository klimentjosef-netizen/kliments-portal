import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Auth gate: jen admin smí vytvořit klienta
  const userClient = createServerSupabase()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: profile } = await userClient
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, name, password, service } = await req.json()

  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Update profile (trigger already creates it)
  if (authData.user) {
    await supabase.from('profiles').update({
      name,
      role: 'client',
      service: service || null,
      active: true,
    }).eq('id', authData.user.id)
  }

  return NextResponse.json({ success: true, userId: authData.user?.id })
}