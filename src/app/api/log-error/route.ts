import { NextRequest, NextResponse } from 'next/server'

// Přijme client-side chybu z error boundary a zaloguje ji (Vercel logy),
// ať ji umíme dohledat bez přístupu do klientova prohlížeče.
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    console.error('[client-error]', JSON.stringify({
      path: b?.path, message: b?.message, digest: b?.digest,
      stack: b?.stack, ua: req.headers.get('user-agent'),
    }))
  } catch {}
  return NextResponse.json({ ok: true })
}
