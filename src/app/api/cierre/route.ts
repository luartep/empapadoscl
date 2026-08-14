import { NextRequest, NextResponse } from 'next/server'
import { generarCierreCaja } from '@/lib/pos-v3-db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const turno_id = searchParams.get('turno_id')
    if (!turno_id) return NextResponse.json({ error: 'turno_id requerido' }, { status: 400 })
    const cierre = await generarCierreCaja(Number(turno_id))
    return NextResponse.json(cierre)
  } catch (e) {
    console.error('[GET /api/cierre]', e)
    return NextResponse.json({ error: 'Error al generar cierre' }, { status: 500 })
  }
}
