import { NextRequest, NextResponse } from 'next/server'
import {
  getDescuentos, buscarDescuentoPorCodigo,
  crearDescuento, toggleDescuento, eliminarDescuento,
} from '@/lib/pos-v3-db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const codigo = searchParams.get('codigo')
    if (codigo) {
      const desc = await buscarDescuentoPorCodigo(codigo)
      if (!desc) return NextResponse.json({ error: 'Código no válido o expirado' }, { status: 404 })
      return NextResponse.json(desc)
    }
    const descuentos = await getDescuentos()
    return NextResponse.json(descuentos)
  } catch (e) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const descuento = await crearDescuento(body)
    return NextResponse.json(descuento, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Error al crear descuento' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    await toggleDescuento(Number(id))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    await eliminarDescuento(Number(id))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
