'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/Topbar'
import type { Message } from '@/lib/types'

export default function ZpravyPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [adminId, setAdminId] = useState<string | null>(null)
  const messagesEnd = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      // Find admin user
      const { data: admin } = await supabase
        .from('profiles').select('id').eq('role', 'admin').limit(1).single()
      if (admin) setAdminId(admin.id)

      // Load messages
      const { data } = await supabase
        .from('messages').select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true })
      if (data) setMessages(data as Message[])

      // Mark as read
      await supabase.from('messages')
        .update({ read: true })
        .eq('receiver_id', user.id)
        .eq('read', false)
    }
    load()
  }, [])

  // Realtime subscription
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new as Message
        if (msg.sender_id === userId || msg.receiver_id === userId) {
          setMessages(prev => [...prev, msg])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Auto scroll
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!newMsg.trim() || !userId || !adminId) return

    const receiverId = adminId // client always sends to admin
    await supabase.from('messages').insert({
      sender_id: userId,
      receiver_id: receiverId,
      content: newMsg.trim(),
      read: false,
    })

    setNewMsg('')
  }

  return (
    <>
      <Topbar title="Zprávy" />
      <div className="p-9 flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
        <div className="bg-white rounded-[20px] border border-black/[0.06] flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-black/[0.06] flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-rose flex items-center justify-center text-white text-sm font-medium">JK</div>
            <div>
              <div className="text-[0.88rem] font-medium text-ink">Josef Kliment</div>
              <div className="text-[0.7rem] text-mid">Váš finanční poradce</div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
            {messages.length === 0 && (
              <div className="text-center text-mid text-sm py-12">Zatím žádné zprávy. Napište první.</div>
            )}
            {messages.map((msg) => {
              const isMe = msg.sender_id === userId
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[68%] px-4 py-2.5 text-[0.82rem] leading-relaxed ${
                    isMe
                      ? 'bg-rose text-white rounded-[14px_4px_14px_14px]'
                      : 'bg-sand text-ink rounded-[4px_14px_14px_14px]'
                  }`}>
                    {msg.content}
                    <div className={`text-[0.62rem] mt-1 ${isMe ? 'opacity-50' : 'text-mid'}`}>
                      {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEnd} />
          </div>

          {/* Input */}
          <div className="px-5 py-4 border-t border-black/[0.06] flex gap-2.5 items-center">
            <input
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Napište zprávu..."
              className="flex-1 border border-black/10 rounded-full px-5 py-2.5 text-[0.85rem] outline-none bg-sand focus:border-rose transition-colors"
            />
            <button
              onClick={sendMessage}
              className="w-9 h-9 rounded-full bg-rose text-white flex items-center justify-center hover:bg-rose-deep transition-colors text-lg"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </>
  )
}