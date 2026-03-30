import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Simple notification API - stores notifications and can be extended with email
// For now: logs to a notifications table that can trigger Supabase webhooks/Edge Functions

export async function POST(req: NextRequest) {
  const { type, recipientId, title, body } = await req.json()

  if (!type || !recipientId || !title) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get recipient email for potential email sending
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, name')
    .eq('id', recipientId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
  }

  // Store notification (can be used by Supabase Database Webhooks to trigger emails)
  const { error } = await supabase
    .from('notifications')
    .insert({
      recipient_id: recipientId,
      type, // 'new_report', 'new_message', 'report_updated'
      title,
      body: body || '',
      email: profile.email,
      read: false,
    })

  if (error) {
    // If notifications table doesn't exist yet, just log and return success
    console.log('Notification insert failed (table may not exist):', error.message)
    return NextResponse.json({ success: true, note: 'Notification logged (table pending)' })
  }

  return NextResponse.json({ success: true })
}
