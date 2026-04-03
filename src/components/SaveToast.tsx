'use client'

import { useEffect, useState } from 'react'

interface SaveToastProps {
  status: string // '', 'Ukládám...', '✓ Uloženo HH:MM', 'Chyba ukládání'
}

export default function SaveToast({ status }: SaveToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!status) {
      setVisible(false)
      return
    }
    setVisible(true)
    // Auto-hide success after 2.5s
    if (status.startsWith('✓')) {
      const t = setTimeout(() => setVisible(false), 2500)
      return () => clearTimeout(t)
    }
  }, [status])

  if (!visible || !status) return null

  const isSuccess = status.startsWith('✓')
  const isError = status.startsWith('Chyba')

  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-[0.75rem] font-medium transition-all duration-300 ${
      isSuccess ? 'bg-green text-white' :
      isError ? 'bg-rose-deep text-white' :
      'bg-ink text-white/70'
    }`}>
      {status}
    </div>
  )
}
