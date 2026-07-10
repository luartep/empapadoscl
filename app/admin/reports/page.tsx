"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart2,
  TrendingUp,
  Store,
  Package,
  CreditCard,
  Calendar,
  CalendarDays,
  CalendarRange,
  Download,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Wallet,
  ArrowUpDown,
} from "lucide-react";

/* ============================================================================
   Tipos
   ============================================================================ */

type Branch = { id: string; name: string };

type SummaryData = {
  totals: { order_count: string; total_revenue: string; avg_ticket: string };
  byBranch: { branch_name: string; branch_id: string; order_count: string; revenue: string }[];
  byPayment: { payment_method: string; order_count: string; revenue: string }[];
  byOrderType: { order_type: string; order_count: string; revenue: string; avg_ticket: string }[];
  topProducts: { product_name: string; units_sold: string; revenue: string }[];
};

type SummaryPeriod = "anual" | "mensual" | "semanal" | "diario" | "rango";

type DailyRow = { day: string; order_count: string; revenue: string; cash: string; card: string; transfer: string };
type MonthlyRow = { year: number; month: number; order_count: string; revenue: string; cash: string; card: string; transfer: string };
type AnnualRow = { year: number; order_count: string; revenue: string; cash: string; card: string; transfer: string };
type ProductRow = { product_name: string; units_sold: string; revenue: string; order_count: string };
type BranchRow = { branch_name: string; branch_id: string; year: number; month: number; order_count: string; revenue: string };
type OrderTypeRow = { order_type: string; order_count: string; revenue: string; avg_ticket: string };
type ShiftRow = {
  id: number; branch_id: string; branch_name: string; opening_cash: number;
  opened_at: string; closed_at: string | null; closing_type: string | null;
  counted_cash: number | null; counted_card: number | null; counted_transfer: number | null;
  expected_cash: number | null; expected_card: number | null; expected_transfer: number | null;
  total_counted: number; total_expected: number; notes: string | null;
};

type ReportTab = "summary" | "daily" | "monthly" | "annual" | "by_branch" | "by_product" | "by_payment" | "by_order_type" | "shifts";

/* ============================================================================
   Helpers
   ============================================================================ */

const fmt = (v: string | number) =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(Number(v));

const fmtCLP = (v: string | number) => `$${fmt(v)}`;

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const ORDER_TYPE_LABELS: Record<string, string> = {
  delivery: "Delivery",
  retiro: "Retiro en local",
  mostrador: "Mostrador",
};

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  desconocido: "Sin especificar",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function pct(part: string | number, total: string | number) {
  const t = Number(total);
  if (!t) return "0%";
  return `${Math.round((Number(part) / t) * 100)}%`;
}

/** Fecha de hoy en formato YYYY-MM-DD (para <input type="date">). */
function todayISO() {
  const d = new Date();
  const tz = new Date(d.toLocaleString("en-US", { timeZone: "America/Santiago" }));
  return tz.toISOString().slice(0, 10);
}

/** Dado cualquier día de una semana, devuelve el rango lunes→domingo que la contiene. */
function weekRangeOf(dateStr: string): { from: string; to: string } {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay(); // 0=domingo … 6=sábado
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { from: iso(monday), to: iso(sunday) };
}

/* ============================================================================
   Componentes auxiliares
   ============================================================================ */

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-black text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function PaymentBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    efectivo: "bg-green-500/20 text-green-400",
    tarjeta: "bg-blue-500/20 text-blue-400",
    transferencia: "bg-purple-500/20 text-purple-400",
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors[method] || "bg-white/10 text-gray-400"}`}>
      {PAYMENT_LABELS[method] || method}
    </span>
  );
}

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-white/10">
        {cols.map((c) => (
          <th key={c} className="text-left py-2 px-3 text-xs text-gray-400 uppercase tracking-wider font-bold">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function BarInline({ value, max }: { value: number; max: number }) {
  const pctWidth = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-white/5 rounded-full h-1.5 mt-1">
      <div
        className="h-1.5 rounded-full bg-[#FF00C8]"
        style={{ width: `${pctWidth}%` }}
      />
    </div>
  );
}

/** Paleta de colores para gráficos con N categorías dinámicas (ej. sucursales, productos). */
const CHART_PALETTE = ["#FF00C8", "#FFEA00", "#00D9FF", "#7C3AED", "#22C55E", "#F97316", "#EC4899", "#38BDF8"];

/* ============================================================================
   Gráfico de barras (series temporales: diario / mensual / anual)
   ============================================================================ */
function TrendBarChart({
  data, valueFormatter = fmtCLP, maxBars = 60,
}: {
  data: { label: string; sublabel?: string; value: number }[];
  valueFormatter?: (v: number) => string;
  maxBars?: number;
}) {
  if (!data.length) return null;
  const shown = data.slice(-maxBars); // más recientes al final (orden cronológico)
  const max = Math.max(...shown.map((d) => d.value), 1);

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-4">
      <div className="overflow-x-auto pb-1">
        <div className="flex items-end gap-1.5 h-40 min-w-max px-1">
          {shown.map((d, i) => (
            <div
              key={i}
              className="group relative flex flex-col items-center justify-end gap-1.5 w-7 flex-shrink-0 h-full"
            >
              <div
                className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/90 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
              >
                {valueFormatter(d.value)}
              </div>
              <div
                className="w-full rounded-t bg-gradient-to-t from-[#FF00C8] to-[#FFEA00] transition-opacity group-hover:opacity-80"
                style={{ height: `${Math.max((d.value / max) * 130, d.value > 0 ? 3 : 0)}px` }}
              />
              <span className="text-[9px] text-gray-500 whitespace-nowrap leading-none">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Gráfico de dona (composición: sucursal / medio de pago / modalidad)
   ============================================================================ */
function DonutChart({
  data,
}: {
  data: { label: string; value: number; color: string }[];
}) {
  const filtered = data.filter((d) => d.value > 0);
  const total = filtered.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="text-xs text-gray-500 py-6 text-center">Sin datos</p>;

  let acc = 0;
  const stops = filtered
    .map((d) => {
      const start = (acc / total) * 360;
      acc += d.value;
      const end = (acc / total) * 360;
      return `${d.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative w-28 h-28 rounded-full flex-shrink-0"
        style={{ background: `conic-gradient(${stops})` }}
      >
        <div className="absolute inset-[10px] bg-[#121212] rounded-full flex flex-col items-center justify-center">
          <span className="text-[9px] text-gray-500 uppercase">Total</span>
          <span className="text-[11px] font-black text-white leading-tight">{fmtCLP(total)}</span>
        </div>
      </div>
      <div className="space-y-1.5 text-xs min-w-0">
        {filtered.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <span className="text-gray-300 truncate">{d.label}</span>
            <span className="text-gray-500 flex-shrink-0">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
   Componente principal
   ============================================================================ */

export default function ReportsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<ReportTab>("summary");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Selector de rango de fechas del Resumen: anual / mensual / semanal / diario / rango personalizado.
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>("mensual");
  const [summaryDay, setSummaryDay] = useState<string>(todayISO());
  const [summaryWeekAnchor, setSummaryWeekAnchor] = useState<string>(todayISO());
  const [customFrom, setCustomFrom] = useState<string>(todayISO());
  const [customTo, setCustomTo] = useState<string>(todayISO());

  // Años disponibles (desde 2024 hasta año actual)
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = new Date().getFullYear(); y >= 2024; y--) arr.push(y);
    return arr;
  }, []);

  // Cargar sucursales al montar
  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((d) => setBranches(d.branches || []))
      .catch(() => {});
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: tab });
      if (branchId) params.set("branchId", branchId);

      if (tab === "summary") {
        if (summaryPeriod === "anual") {
          params.set("year", String(year));
        } else if (summaryPeriod === "mensual") {
          params.set("year", String(year));
          params.set("month", String(month));
        } else if (summaryPeriod === "diario") {
          params.set("from", summaryDay);
          params.set("to", summaryDay);
        } else if (summaryPeriod === "semanal") {
          const { from, to } = weekRangeOf(summaryWeekAnchor);
          params.set("from", from);
          params.set("to", to);
        } else if (summaryPeriod === "rango") {
          if (!customFrom || !customTo) { setLoading(false); return; }
          const [from, to] = customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom];
          params.set("from", from);
          params.set("to", to);
        }
      } else if (tab === "daily" || tab === "by_payment") {
        params.set("year", String(year));
        params.set("month", String(month));
      } else if (tab === "monthly" || tab === "by_branch" || tab === "by_product" || tab === "by_order_type") {
        params.set("year", String(year));
      } else if (tab === "annual" || tab === "shifts") {
        // sin filtro de mes
        params.set("year", String(year));
      }

      const res = await fetch(`/api/reports?${params}`);
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab, branchId, year, month, summaryPeriod, summaryDay, summaryWeekAnchor, customFrom, customTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Exportar CSV
  function exportCSV() {
    if (!data) return;
    let rows: string[][] = [];
    let filename = `reporte_${tab}_${year}.csv`;

    if (tab === "daily" && (data as { rows: DailyRow[] }).rows) {
      const r = (data as { rows: DailyRow[] }).rows;
      rows = [["Fecha", "Pedidos", "Total", "Efectivo", "Tarjeta", "Transferencia"],
        ...r.map((x) => [x.day, x.order_count, x.revenue, x.cash, x.card, x.transfer])];
    } else if (tab === "monthly" && (data as { rows: MonthlyRow[] }).rows) {
      const r = (data as { rows: MonthlyRow[] }).rows;
      rows = [["Año", "Mes", "Pedidos", "Total", "Efectivo", "Tarjeta", "Transferencia"],
        ...r.map((x) => [String(x.year), MONTHS_FULL[x.month - 1], x.order_count, x.revenue, x.cash, x.card, x.transfer])];
    } else if (tab === "annual" && (data as { rows: AnnualRow[] }).rows) {
      const r = (data as { rows: AnnualRow[] }).rows;
      rows = [["Año", "Pedidos", "Total", "Efectivo", "Tarjeta", "Transferencia"],
        ...r.map((x) => [String(x.year), x.order_count, x.revenue, x.cash, x.card, x.transfer])];
    } else if (tab === "by_product" && (data as { rows: ProductRow[] }).rows) {
      const r = (data as { rows: ProductRow[] }).rows;
      rows = [["Producto", "Unidades", "Ingresos", "Pedidos"],
        ...r.map((x) => [x.product_name, x.units_sold, x.revenue, x.order_count])];
      filename = `reporte_productos_${year}.csv`;
    }

    if (!rows.length) return;
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- Tabs config ---------- */
  const TABS: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
    { id: "summary", label: "Resumen", icon: <BarChart2 size={14} /> },
    { id: "daily", label: "Diario", icon: <CalendarDays size={14} /> },
    { id: "monthly", label: "Mensual", icon: <Calendar size={14} /> },
    { id: "annual", label: "Anual", icon: <CalendarRange size={14} /> },
    { id: "by_branch", label: "Por Local", icon: <Store size={14} /> },
    { id: "by_product", label: "Productos", icon: <Package size={14} /> },
    { id: "by_payment", label: "Pagos", icon: <CreditCard size={14} /> },
    { id: "by_order_type", label: "Modalidad", icon: <ShoppingBag size={14} /> },
    { id: "shifts", label: "Turnos", icon: <Wallet size={14} /> },
  ];

  const showMonthFilter = ["daily", "by_payment"].includes(tab);
  const showYearFilter = tab !== "annual" && tab !== "summary";

  const SUMMARY_PERIODS: { id: SummaryPeriod; label: string }[] = [
    { id: "diario", label: "Diario" },
    { id: "semanal", label: "Semanal" },
    { id: "mensual", label: "Mensual" },
    { id: "anual", label: "Anual" },
    { id: "rango", label: "Rango" },
  ];

  /* ---------- Render contenido ---------- */
  function renderContent() {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#FF00C8]" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="text-center py-16 text-red-400">
          <p className="font-bold">Error al cargar el reporte</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      );
    }
    if (!data) return null;

    if (tab === "summary") return <SummaryView data={data as SummaryData} />;
    if (tab === "daily") return <DailyView rows={(data as { rows: DailyRow[] }).rows || []} />;
    if (tab === "monthly") return <MonthlyView rows={(data as { rows: MonthlyRow[] }).rows || []} />;
    if (tab === "annual") return <AnnualView rows={(data as { rows: AnnualRow[] }).rows || []} />;
    if (tab === "by_branch") return <ByBranchView rows={(data as { rows: BranchRow[] }).rows || []} />;
    if (tab === "by_product") return <ByProductView rows={(data as { rows: ProductRow[] }).rows || []} sortField={sortField} sortDir={sortDir} onSort={(f) => { if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortField(f); setSortDir("desc"); } }} />;
    if (tab === "by_payment") return <ByPaymentView rows={(data as { rows: unknown[] }).rows || []} />;
    if (tab === "by_order_type") return <ByOrderTypeView rows={(data as { rows: OrderTypeRow[] }).rows || []} />;
    if (tab === "shifts") return <ShiftsView rows={(data as { rows: ShiftRow[] }).rows || []} />;
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center justify-between px-4 h-16 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin")}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <TrendingUp size={20} className="text-[#FF00C8]" />
              <h1 className="font-black text-lg uppercase italic">Reportes</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
            >
              <Download size={12} /> CSV
            </button>
            <button
              onClick={fetchReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 px-4 pb-3 max-w-6xl mx-auto overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold uppercase whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "bg-[#FF00C8] text-white"
                  : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Filtros */}
      <div className="sticky top-[108px] z-20 bg-[#0A0A0A]/90 backdrop-blur border-b border-white/5 px-4 py-2.5 max-w-6xl mx-auto">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Sucursal */}
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF00C8]"
          >
            <option value="">Todos los locales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Año */}
          {showYearFilter && (
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF00C8]"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}

          {/* Mes */}
          {showMonthFilter && (
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF00C8]"
            >
              {MONTHS_FULL.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          )}

          {/* Selector de período (solo Resumen) */}
          {tab === "summary" && (
            <>
              <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5">
                {SUMMARY_PERIODS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSummaryPeriod(p.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                      summaryPeriod === p.id ? "bg-[#FF00C8] text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {summaryPeriod === "anual" && (
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF00C8]"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}

              {summaryPeriod === "mensual" && (
                <>
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF00C8]"
                  >
                    {MONTHS_FULL.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF00C8]"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </>
              )}

              {summaryPeriod === "diario" && (
                <input
                  type="date"
                  value={summaryDay}
                  max={todayISO()}
                  onChange={(e) => setSummaryDay(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF00C8]"
                />
              )}

              {summaryPeriod === "semanal" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={summaryWeekAnchor}
                    max={todayISO()}
                    onChange={(e) => setSummaryWeekAnchor(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF00C8]"
                  />
                  <span className="text-xs text-gray-500">
                    {(() => {
                      const { from, to } = weekRangeOf(summaryWeekAnchor);
                      return `${formatDate(from + "T12:00:00")} – ${formatDate(to + "T12:00:00")}`;
                    })()}
                  </span>
                </div>
              )}

              {summaryPeriod === "rango" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    max={todayISO()}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF00C8]"
                  />
                  <span className="text-xs text-gray-500">a</span>
                  <input
                    type="date"
                    value={customTo}
                    max={todayISO()}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF00C8]"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Contenido */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {renderContent()}
      </main>
    </div>
  );
}

/* ============================================================================
   Vista: Resumen
   ============================================================================ */
function SummaryView({ data }: { data: SummaryData }) {
  const { totals, byBranch, byPayment, byOrderType, topProducts } = data;
  const maxRevBranch = Math.max(...byBranch.map((b) => Number(b.revenue)), 1);
  const maxRevProduct = Math.max(...topProducts.map((p) => Number(p.revenue)), 1);

  const branchChartData = byBranch.map((b, i) => ({
    label: b.branch_name || "Sin local",
    value: Number(b.revenue),
    color: CHART_PALETTE[i % CHART_PALETTE.length],
  }));

  const ORDER_TYPE_COLORS: Record<string, string> = { delivery: "#FF00C8", retiro: "#FFEA00", mostrador: "#00D9FF" };
  const orderTypeChartData = byOrderType.map((o, i) => ({
    label: ORDER_TYPE_LABELS[o.order_type] || o.order_type,
    value: Number(o.revenue),
    color: ORDER_TYPE_COLORS[o.order_type] || CHART_PALETTE[i % CHART_PALETTE.length],
  }));

  const PAYMENT_COLORS: Record<string, string> = { efectivo: "#22C55E", tarjeta: "#3B82F6", transferencia: "#A855F7", desconocido: "#9CA3AF" };
  const paymentChartData = byPayment.map((p, i) => ({
    label: PAYMENT_LABELS[p.payment_method] || p.payment_method,
    value: Number(p.revenue),
    color: PAYMENT_COLORS[p.payment_method] || CHART_PALETTE[i % CHART_PALETTE.length],
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Ventas Totales" value={fmtCLP(totals.total_revenue)} />
        <StatCard label="Pedidos Pagados" value={fmt(totals.order_count)} />
        <StatCard label="Ticket Promedio" value={fmtCLP(Math.round(Number(totals.avg_ticket)))} />
      </div>

      {/* Por sucursal */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-black uppercase text-[#FF00C8] mb-3 flex items-center gap-2">
          <Store size={14} /> Ventas por Local
        </h3>
        <DonutChart data={branchChartData} />
        <div className="space-y-3 mt-4">
          {byBranch.map((b) => (
            <div key={b.branch_id || "sin-local"}>
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold">{b.branch_name || "Sin local asignado"}</span>
                <div className="text-right">
                  <span className="font-black text-[#FFEA00]">{fmtCLP(b.revenue)}</span>
                  <span className="text-gray-500 text-xs ml-2">{fmt(b.order_count)} pedidos</span>
                </div>
              </div>
              <BarInline value={Number(b.revenue)} max={maxRevBranch} />
            </div>
          ))}
        </div>
      </div>

      {/* Por modalidad (delivery / retiro en local / mostrador) */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-black uppercase text-[#FF00C8] mb-3 flex items-center gap-2">
          <ShoppingBag size={14} /> Ventas por Modalidad
        </h3>
        <DonutChart data={orderTypeChartData} />
        <div className="space-y-2 mt-4">
          {byOrderType.map((o) => (
            <div key={o.order_type} className="flex items-center justify-between text-sm">
              <span className="font-semibold">{ORDER_TYPE_LABELS[o.order_type] || o.order_type}</span>
              <div className="text-right">
                <span className="font-black text-[#FFEA00]">{fmtCLP(o.revenue)}</span>
                <span className="text-gray-500 text-xs ml-2">{fmt(o.order_count)} pedidos ({pct(o.revenue, totals.total_revenue)})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Por medio de pago */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-black uppercase text-[#FF00C8] mb-3 flex items-center gap-2">
          <CreditCard size={14} /> Medios de Pago
        </h3>
        <DonutChart data={paymentChartData} />
        <div className="space-y-2 mt-4">
          {byPayment.map((p) => (
            <div key={p.payment_method} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <PaymentBadge method={p.payment_method} />
              </div>
              <div className="text-right">
                <span className="font-black">{fmtCLP(p.revenue)}</span>
                <span className="text-gray-500 text-xs ml-2">{pct(p.revenue, totals.total_revenue)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top productos */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-black uppercase text-[#FF00C8] mb-3 flex items-center gap-2">
          <Package size={14} /> Top 10 Productos
        </h3>
        <div className="space-y-3">
          {topProducts.map((p, i) => (
            <div key={p.product_name}>
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-500 w-5 flex-shrink-0">#{i + 1}</span>
                  <span className="font-semibold truncate">{p.product_name}</span>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="font-black text-[#FFEA00]">{fmtCLP(p.revenue)}</span>
                  <span className="text-gray-500 text-xs ml-2">{fmt(p.units_sold)} ud.</span>
                </div>
              </div>
              <BarInline value={Number(p.revenue)} max={maxRevProduct} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Vista: Diario
   ============================================================================ */
function DailyView({ rows }: { rows: DailyRow[] }) {
  if (!rows.length) return <EmptyState />;
  const total = rows.reduce((s, r) => s + Number(r.revenue), 0);
  const max = Math.max(...rows.map((r) => Number(r.revenue)), 1);
  const chartData = [...rows].reverse().map((r) => ({
    label: formatDate(r.day + "T12:00:00").slice(0, 5),
    value: Number(r.revenue),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total del período" value={fmtCLP(total)} />
        <StatCard label="Días con ventas" value={String(rows.length)} />
      </div>

      <TrendBarChart data={chartData} />

      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <TableHeader cols={["Fecha", "Pedidos", "Efectivo", "Tarjeta", "Transfer.", "Total"]} />
          <tbody>
            {rows.map((r) => (
              <tr key={r.day} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-2.5 px-3 text-gray-300">{formatDate(r.day + "T12:00:00")}</td>
                <td className="py-2.5 px-3 text-center text-gray-400">{r.order_count}</td>
                <td className="py-2.5 px-3 text-green-400">{Number(r.cash) ? fmtCLP(r.cash) : "—"}</td>
                <td className="py-2.5 px-3 text-blue-400">{Number(r.card) ? fmtCLP(r.card) : "—"}</td>
                <td className="py-2.5 px-3 text-purple-400">{Number(r.transfer) ? fmtCLP(r.transfer) : "—"}</td>
                <td className="py-2.5 px-3 font-black text-[#FFEA00]">
                  {fmtCLP(r.revenue)}
                  <BarInline value={Number(r.revenue)} max={max} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================================
   Vista: Mensual
   ============================================================================ */
function MonthlyView({ rows }: { rows: MonthlyRow[] }) {
  if (!rows.length) return <EmptyState />;
  const total = rows.reduce((s, r) => s + Number(r.revenue), 0);
  const max = Math.max(...rows.map((r) => Number(r.revenue)), 1);
  const bestMonth = rows.reduce((a, b) => Number(a.revenue) > Number(b.revenue) ? a : b, rows[0]);
  const chartData = [...rows].reverse().map((r) => ({
    label: MONTHS[r.month - 1],
    value: Number(r.revenue),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total del año" value={fmtCLP(total)} />
        <StatCard label="Meses con ventas" value={String(rows.length)} />
        <StatCard label="Mejor mes" value={MONTHS[bestMonth.month - 1]} sub={fmtCLP(bestMonth.revenue)} />
      </div>

      <TrendBarChart data={chartData} />

      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <TableHeader cols={["Mes", "Pedidos", "Efectivo", "Tarjeta", "Transfer.", "Total"]} />
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.year}-${r.month}`} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-2.5 px-3 font-semibold">{MONTHS_FULL[r.month - 1]} {r.year}</td>
                <td className="py-2.5 px-3 text-center text-gray-400">{r.order_count}</td>
                <td className="py-2.5 px-3 text-green-400">{Number(r.cash) ? fmtCLP(r.cash) : "—"}</td>
                <td className="py-2.5 px-3 text-blue-400">{Number(r.card) ? fmtCLP(r.card) : "—"}</td>
                <td className="py-2.5 px-3 text-purple-400">{Number(r.transfer) ? fmtCLP(r.transfer) : "—"}</td>
                <td className="py-2.5 px-3">
                  <span className="font-black text-[#FFEA00]">{fmtCLP(r.revenue)}</span>
                  <BarInline value={Number(r.revenue)} max={max} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================================
   Vista: Anual
   ============================================================================ */
function AnnualView({ rows }: { rows: AnnualRow[] }) {
  if (!rows.length) return <EmptyState />;
  const chartData = [...rows].reverse().map((r) => ({ label: String(r.year), value: Number(r.revenue) }));

  return (
    <div className="space-y-4">
      <TrendBarChart data={chartData} />

      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <TableHeader cols={["Año", "Pedidos", "Efectivo", "Tarjeta", "Transfer.", "Total"]} />
          <tbody>
            {rows.map((r) => (
              <tr key={r.year} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-3 px-3 font-black text-lg text-[#FFEA00]">{r.year}</td>
                <td className="py-3 px-3 text-center text-gray-400">{r.order_count}</td>
                <td className="py-3 px-3 text-green-400">{Number(r.cash) ? fmtCLP(r.cash) : "—"}</td>
                <td className="py-3 px-3 text-blue-400">{Number(r.card) ? fmtCLP(r.card) : "—"}</td>
                <td className="py-3 px-3 text-purple-400">{Number(r.transfer) ? fmtCLP(r.transfer) : "—"}</td>
                <td className="py-3 px-3 font-black text-xl">{fmtCLP(r.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================================
   Vista: Por Local
   ============================================================================ */
function ByBranchView({ rows }: { rows: BranchRow[] }) {
  if (!rows.length) return <EmptyState />;

  // Agrupar por sucursal
  const grouped: Record<string, { name: string; rows: BranchRow[]; total: number }> = {};
  rows.forEach((r) => {
    const key = r.branch_id || "sin-local";
    if (!grouped[key]) grouped[key] = { name: r.branch_name || "Sin local", rows: [], total: 0 };
    grouped[key].rows.push(r);
    grouped[key].total += Number(r.revenue);
  });

  const chartData = Object.values(grouped).map((b, i) => ({
    label: b.name,
    value: b.total,
    color: CHART_PALETTE[i % CHART_PALETTE.length],
  }));

  return (
    <div className="space-y-5">
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-black uppercase text-[#FF00C8] mb-3 flex items-center gap-2">
          <Store size={14} /> Composición por Local
        </h3>
        <DonutChart data={chartData} />
      </div>

      {Object.entries(grouped).map(([key, branch]) => (
        <div key={key} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center">
            <h3 className="font-black text-[#FF00C8] flex items-center gap-2">
              <Store size={14} /> {branch.name}
            </h3>
            <span className="font-black text-[#FFEA00]">{fmtCLP(branch.total)}</span>
          </div>
          <table className="w-full text-sm">
            <TableHeader cols={["Mes", "Pedidos", "Ingresos"]} />
            <tbody>
              {branch.rows.map((r) => (
                <tr key={`${r.year}-${r.month}`} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 px-3">{MONTHS_FULL[r.month - 1]} {r.year}</td>
                  <td className="py-2 px-3 text-center text-gray-400">{r.order_count}</td>
                  <td className="py-2 px-3 font-bold text-[#FFEA00]">{fmtCLP(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   Vista: Por Producto
   ============================================================================ */
function ByProductView({
  rows, sortField, sortDir, onSort,
}: {
  rows: ProductRow[];
  sortField: string;
  sortDir: "asc" | "desc";
  onSort: (f: string) => void;
}) {
  if (!rows.length) return <EmptyState />;

  const sorted = [...rows].sort((a, b) => {
    const av = Number((a as Record<string, string>)[sortField] ?? a.revenue);
    const bv = Number((b as Record<string, string>)[sortField] ?? b.revenue);
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const maxRev = Math.max(...sorted.map((r) => Number(r.revenue)), 1);
  const totalRev = sorted.reduce((s, r) => s + Number(r.revenue), 0);
  const totalUnits = sorted.reduce((s, r) => s + Number(r.units_sold), 0);
  const top10ByRevenue = [...rows].sort((a, b) => Number(b.revenue) - Number(a.revenue)).slice(0, 10);
  const maxTop10 = Math.max(...top10ByRevenue.map((r) => Number(r.revenue)), 1);

  function SortIcon({ field }: { field: string }) {
    if (sortField !== field) return <ArrowUpDown size={10} className="text-gray-600" />;
    return sortDir === "asc" ? <ChevronUp size={10} className="text-[#FF00C8]" /> : <ChevronDown size={10} className="text-[#FF00C8]" />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Productos distintos" value={String(sorted.length)} />
        <StatCard label="Unidades vendidas" value={fmt(totalUnits)} />
        <StatCard label="Ingresos por productos" value={fmtCLP(totalRev)} />
      </div>

      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-black uppercase text-[#FF00C8] mb-3 flex items-center gap-2">
          <Package size={14} /> Top 10 por Ingresos
        </h3>
        <div className="space-y-2.5">
          {top10ByRevenue.map((r) => (
            <div key={r.product_name} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-32 flex-shrink-0 truncate">{r.product_name}</span>
              <div className="flex-1 bg-white/5 rounded h-4 relative overflow-hidden">
                <div
                  className="h-full rounded bg-gradient-to-r from-[#FF00C8] to-[#FFEA00]"
                  style={{ width: `${Math.max((Number(r.revenue) / maxTop10) * 100, 2)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-[#FFEA00] w-20 flex-shrink-0 text-right">{fmtCLP(r.revenue)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 px-3 text-xs text-gray-400 uppercase tracking-wider font-bold">Producto</th>
              <th className="text-left py-2 px-3 text-xs text-gray-400 uppercase tracking-wider font-bold cursor-pointer hover:text-white" onClick={() => onSort("units_sold")}>
                <span className="flex items-center gap-1">Unidades <SortIcon field="units_sold" /></span>
              </th>
              <th className="text-left py-2 px-3 text-xs text-gray-400 uppercase tracking-wider font-bold cursor-pointer hover:text-white" onClick={() => onSort("order_count")}>
                <span className="flex items-center gap-1">Pedidos <SortIcon field="order_count" /></span>
              </th>
              <th className="text-left py-2 px-3 text-xs text-gray-400 uppercase tracking-wider font-bold cursor-pointer hover:text-white" onClick={() => onSort("revenue")}>
                <span className="flex items-center gap-1">Ingresos <SortIcon field="revenue" /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.product_name} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-5">{i + 1}</span>
                    <div>
                      <p className="font-semibold leading-tight">{r.product_name}</p>
                      <BarInline value={Number(r.revenue)} max={maxRev} />
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-center">{fmt(r.units_sold)}</td>
                <td className="py-2.5 px-3 text-center text-gray-400">{r.order_count}</td>
                <td className="py-2.5 px-3">
                  <span className="font-black text-[#FFEA00]">{fmtCLP(r.revenue)}</span>
                  <span className="text-gray-500 text-xs ml-1">({pct(r.revenue, totalRev)})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================================================================
   Vista: Por Método de Pago
   ============================================================================ */
function ByPaymentView({ rows }: { rows: unknown[] }) {
  if (!rows.length) return <EmptyState />;

  // Agrupar por método
  const methods: Record<string, { days: { day: string; count: string; revenue: string }[]; total: number }> = {};
  (rows as { day: string; payment_method: string; order_count: string; revenue: string }[]).forEach((r) => {
    if (!methods[r.payment_method]) methods[r.payment_method] = { days: [], total: 0 };
    methods[r.payment_method].days.push({ day: r.day, count: r.order_count, revenue: r.revenue });
    methods[r.payment_method].total += Number(r.revenue);
  });

  const colors: Record<string, string> = {
    efectivo: "text-green-400",
    tarjeta: "text-blue-400",
    transferencia: "text-purple-400",
    desconocido: "text-gray-400",
  };

  const PAYMENT_HEX: Record<string, string> = { efectivo: "#22C55E", tarjeta: "#3B82F6", transferencia: "#A855F7", desconocido: "#9CA3AF" };
  const chartData = Object.entries(methods).map(([method, m]) => ({
    label: PAYMENT_LABELS[method] || method,
    value: m.total,
    color: PAYMENT_HEX[method] || "#9CA3AF",
  }));

  return (
    <div className="space-y-5">
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-black uppercase text-[#FF00C8] mb-3 flex items-center gap-2">
          <CreditCard size={14} /> Composición del Período
        </h3>
        <DonutChart data={chartData} />
      </div>

      {Object.entries(methods).map(([method, data]) => (
        <div key={method} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center">
            <PaymentBadge method={method} />
            <span className={`font-black text-lg ${colors[method] || "text-white"}`}>{fmtCLP(data.total)}</span>
          </div>
          <table className="w-full text-sm">
            <TableHeader cols={["Fecha", "Pedidos", "Total"]} />
            <tbody>
              {data.days.map((d) => (
                <tr key={d.day} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 px-3 text-gray-300">{formatDate(d.day + "T12:00:00")}</td>
                  <td className="py-2 px-3 text-center text-gray-400">{d.count}</td>
                  <td className={`py-2 px-3 font-bold ${colors[method] || ""}`}>{fmtCLP(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   Vista: Por Modalidad de Pedido
   ============================================================================ */
function ByOrderTypeView({ rows }: { rows: OrderTypeRow[] }) {
  if (!rows.length) return <EmptyState />;
  const total = rows.reduce((s, r) => s + Number(r.revenue), 0);
  const ORDER_TYPE_HEX: Record<string, string> = { delivery: "#FF00C8", retiro: "#FFEA00", mostrador: "#00D9FF" };
  const chartData = rows.map((r, i) => ({
    label: ORDER_TYPE_LABELS[r.order_type] || r.order_type,
    value: Number(r.revenue),
    color: ORDER_TYPE_HEX[r.order_type] || CHART_PALETTE[i % CHART_PALETTE.length],
  }));

  return (
    <div className="space-y-4">
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-black uppercase text-[#FF00C8] mb-3 flex items-center gap-2">
          <ShoppingBag size={14} /> Composición del Período
        </h3>
        <DonutChart data={chartData} />
      </div>

      <div className="grid grid-cols-1 gap-3">
        {rows.map((r) => (
          <div key={r.order_type} className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-black text-lg">{ORDER_TYPE_LABELS[r.order_type] || r.order_type}</p>
                <p className="text-xs text-gray-400">{r.order_count} pedidos · Ticket prom. {fmtCLP(Math.round(Number(r.avg_ticket)))}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-xl text-[#FFEA00]">{fmtCLP(r.revenue)}</p>
                <p className="text-xs text-gray-400">{pct(r.revenue, total)} del total</p>
              </div>
            </div>
            <BarInline value={Number(r.revenue)} max={Number(rows[0].revenue)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
   Vista: Turnos de Caja
   ============================================================================ */
function ShiftsView({ rows }: { rows: ShiftRow[] }) {
  if (!rows.length) return <EmptyState />;
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {rows.map((s) => {
        const diff = s.total_counted - s.total_expected;
        const isOpen = open === s.id;
        return (
          <div key={s.id} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
              onClick={() => setOpen(isOpen ? null : s.id)}
            >
              <div className="flex items-center gap-3 text-left">
                <div>
                  <p className="font-bold text-sm">{s.branch_name}</p>
                  <p className="text-xs text-gray-400">{formatDateTime(s.opened_at)} → {s.closed_at ? formatDateTime(s.closed_at) : "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-black text-[#FFEA00]">{fmtCLP(s.total_counted)}</p>
                  <p className={`text-xs font-bold ${diff >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {diff >= 0 ? "+" : ""}{fmtCLP(diff)}
                  </p>
                </div>
                {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-white/10 px-4 py-3 space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-black/20 rounded-lg p-2">
                    <p className="text-xs text-gray-500">Efectivo</p>
                    <p className="font-bold text-green-400">{fmtCLP(s.counted_cash ?? 0)}</p>
                    <p className="text-xs text-gray-600">Esp. {fmtCLP(s.expected_cash ?? 0)}</p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-2">
                    <p className="text-xs text-gray-500">Tarjeta</p>
                    <p className="font-bold text-blue-400">{fmtCLP(s.counted_card ?? 0)}</p>
                    <p className="text-xs text-gray-600">Esp. {fmtCLP(s.expected_card ?? 0)}</p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-2">
                    <p className="text-xs text-gray-500">Transfer.</p>
                    <p className="font-bold text-purple-400">{fmtCLP(s.counted_transfer ?? 0)}</p>
                    <p className="text-xs text-gray-600">Esp. {fmtCLP(s.expected_transfer ?? 0)}</p>
                  </div>
                </div>
                {s.notes && <p className="text-xs text-gray-400 italic">"{s.notes}"</p>}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Apertura: {fmtCLP(s.opening_cash)}</span>
                  <span>Tipo cierre: {s.closing_type || "—"}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================================
   Estado vacío
   ============================================================================ */
function EmptyState() {
  return (
    <div className="text-center py-20 text-gray-500">
      <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
      <p className="font-bold">Sin datos para el período seleccionado</p>
      <p className="text-sm mt-1">Prueba cambiar el año, mes o local.</p>
    </div>
  );
}
