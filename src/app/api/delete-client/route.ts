import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// Smazani klienta — vsechny jeho reporty + auth user + profile.
// Vyzaduje admin session (server-side check, ne pouze frontend).

export async function POST(req: NextRequest) {
  const userClient = createServerSupabase()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await userClient
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { clientId } = await req.json()
  if (!clientId || typeof clientId !== 'string') {
    return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })
  }

  // Safety: admin nesmí smazat sám sebe ani jiného admina
  const { data: target } = await userClient
    .from('profiles').select('role').eq('id', clientId).single()
  if (!target) return NextResponse.json({ error: 'Klient nenalezen' }, { status: 404 })
  if (target.role === 'admin') {
    return NextResponse.json({ error: 'Adminský účet nelze smazat tímto endpointem' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1) Smazat reporty toho klienta
  const { error: reportsErr } = await admin.from('reports').delete().eq('client_id', clientId)
  if (reportsErr) {
    console.error('[delete-client] reports delete failed:', reportsErr.message)
    return NextResponse.json({ error: 'Selhalo mazání reportů: ' + reportsErr.message }, { status: 500 })
  }

  // 2) Smazat profile row (trigger nesmí cyklit zpět)
  const { error: profileErr } = await admin.from('profiles').delete().eq('id', clientId)
  if (profileErr) {
    console.error('[delete-client] profile delete failed:', profileErr.message)
    return NextResponse.json({ error: 'Selhalo mazání profilu: ' + profileErr.message }, { status: 500 })
  }

  // 3) Smazat auth uzivatele
  const { error: authErr } = await admin.auth.admin.deleteUser(clientId)
  if (authErr) {
    console.error('[delete-client] auth user delete failed:', authErr.message)
    return NextResponse.json({ error: 'Selhalo mazání uživatele: ' + authErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
