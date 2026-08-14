'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin/pos',         label: 'Caja POS',     icon: '🛒' },
  { href: '/admin/cocina',      label: 'Cocina',       icon: '👨‍🍳' },
  { href: '/admin/dashboard',   label: 'Dashboard',    icon: '📊' },
  { href: '/admin/catalogo',    label: 'Catálogo',     icon: '🍔' },
  { href: '/admin/inventario',  label: 'Inventario',   icon: '📦' },
  { href: '/admin/descuentos',  label: 'Descuentos',   icon: '🏷️' },
  { href: '/admin/reportes',    label: 'Reportes',     icon: '📋' },
]

export default function AdminLayoutV3({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // POS y cocina: pantalla completa
  if (pathname.startsWith('/admin/pos') || pathname.startsWith('/admin/cocina')) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-zinc-800 bg-zinc-900 flex flex-col">
        <div className="px-5 py-5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🍔</span>
            <div className="leading-tight">
              <p className="font-black text-zinc-100 text-sm tracking-wide">EMPAPADOS</p>
              <p className="text-xs text-zinc-500">Admin · v3</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV.map(item => {
            const activo = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  activo
                    ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-600/30'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-transparent'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-5 py-4 border-t border-zinc-800">
          <Link
            href="/admin/pos"
            className="flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-3 py-2.5 text-sm font-bold text-white transition-colors"
          >
            <span>🛒</span>
            <span>Ir al POS</span>
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
