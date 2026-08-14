import { NextRequest, NextResponse } from 'next/server'
import { getNotificaciones, marcarNotificacionesLeidas } from '@/lib/pos-v3-db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const soloNoLeidas = searchParams.get('no_leidas') === '1'
    const notifs = await getNotificaciones(soloNoLeidas)
    return NextResponse.json(notifs)
  } catch (e) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    await marcarNotificacionesLeidas(body.ids)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
