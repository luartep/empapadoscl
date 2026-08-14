import { NextRequest, NextResponse } from 'next/server'
import { registrarUsoDescuento } from '@/lib/pos-v3-db'

export async function POST(req: NextRequest) {
  try {
    const { descuento_id } = await req.json()
    if (!descuento_id) return NextResponse.json({ error: 'descuento_id requerido' }, { status: 400 })
    await registrarUsoDescuento(Number(descuento_id))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
