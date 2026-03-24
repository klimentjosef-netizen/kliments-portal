export type UserRole = 'admin' | 'client'

export interface Profile {
  id: string
  email: string
  name: string
  role: UserRole
  service: string | null
  active: boolean
}

export interface Report {
  id: string
  client_id: string
  type: 'diagnoza' | 'cfo' | 'valuace' | 'investor' | 'mentoring'
  title: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
  created_at?: string
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  read: boolean
  created_at?: string
}