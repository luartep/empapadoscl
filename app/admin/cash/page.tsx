"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { printDailySummary } from "@/lib/printing";
import {
  LogOut,
  ArrowLeft,
  Wallet,
  Plus,
  Minus,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  CheckCircle2,
  Printer,
} from "lucide-react";

/* ============================================================================
   Tipos
   ============================================================================ */

type Branch = { id: string; name: string };

type Shift = {
  id: number;
  branch_id: string;
  opening_cash: number;
  opened_at: string;
  status: "abierto" | "cerrado";
  closing_type: "normal" | "ciego" | null;
  counted_cash: number | null;
  counted_card: number | null;
  counted_transfer: number | null;
  expected_cash: number | null;
  expected_card: number | null;
  expected_transfer: number | null;
  notes: string | null;
  closed_at: string | null;
};

type CashMovement = {
  id: number;
  shift_id: number;
  type: "ingreso" | "egreso";
  amount: number;
  payment_method: string;
  description: string;
  created_at: string;
};

type ManualSale = {
  id: number;
  shift_id: number;
  amount: number;
  payment_method: string;
  description: string | null;
  created_at: string;
};

const formatCLP = (value: number) =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value);

const PAYMENT_METHODS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "tarjeta", label: "Tarjeta" },
  { id: "transferencia", label: "Transferencia" },
];

/* ============================================================================
   Componente principal
   ============================================================================ */

export default function CashManagementPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [shift, setShift] = useState<Shift | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [sales, setSales] = useState<ManualSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [lastClosedShift, setLastClosedShift] = useState<{
    expected: { cash: number; card: number; transfer: number };
    difference: { cash: number; card: number; transfer: number };
  } | null>(null);

  const loadBranches = useCallback(async () => {
    try {
      const res = await fetch("/api/branches");
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error ||
            "No se pudieron cargar las sucursales. Verifica que la base de datos esté conectada y que hayas corrido la migración schema_v2.sql."
        );
        setLoading(false);
        return;
      }
      setBranches(data.branches);
      if (data.branches.length === 0) {
        setError(
          "No hay sucursales configuradas todavía. Corre db/schema_v2.sql en tu base de datos para crearlas."
        );
        setLoading(false);
        return;
      }
      if (!selectedBranch) {
        setSelectedBranch(data.branches[0].id);
      }
    } catch {
      setError("Error de conexión al cargar las sucursales.");
      setLoading(false);
    }
  }, [selectedBranch]);

  const loadShiftData = useCallback(async (branchId: string) => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/cash-shifts?branchId=${branchId}&status=abierto`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo cargar el turno.");
        setLoading(false);
        return;
      }
      const openShift = data.shifts?.[0] ?? null;
      setShift(openShift);

      if (openShift) {
        const [movRes, salesRes] = await Promise.all([
          fetch(`/api/cash-movements?shiftId=${openShift.id}`),
          fetch(`/api/manual-sales?shiftId=${openShift.id}`),
        ]);
        const movData = await movRes.json();
        const salesData = await salesRes.json();
        setMovements(movData.movements || []);
        setSales(salesData.sales || []);
      } else {
        setMovements([]);
        setSales([]);
      }
    } catch {
      setError("Error de conexión.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    if (selectedBranch) {
      loadShiftData(selectedBranch);
      setLastClosedShift(null);
    }
  }, [selectedBranch, loadShiftData]);

  /* --------------------------- Totales en vivo --------------------------- */

  const salesTotal = sales.reduce((sum, s) => sum + s.amount, 0);
  const salesByMethod = (method: string) =>
    sales
      .filter((s) => s.payment_method === method)
      .reduce((sum, s) => sum + s.amount, 0);
  const movementsNet = (method: string) =>
    movements
      .filter((m) => m.payment_method === method)
      .reduce((sum, m) => sum + (m.type === "ingreso" ? m.amount : -m.amount), 0);

  const liveExpectedCash =
    (shift?.opening_cash ?? 0) + salesByMethod("efectivo") + movementsNet("efectivo");
  const liveExpectedCard = salesByMethod("tarjeta") + movementsNet("tarjeta");
  const liveExpectedTransfer =
    salesByMethod("transferencia") + movementsNet("transferencia");

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center justify-between px-4 h-16 max-w-3xl mx-auto">
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Panel
          </button>
          <h1 className="font-black text-base uppercase italic flex items-center gap-2">
            <Wallet size={18} className="text-[#FF00C8]" /> Caja
          </h1>
          <button
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              router.push("/admin/login");
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* --- Selector de sucursal --- */}
        <div className="flex gap-2 mb-6">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBranch(b.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition-colors ${
                selectedBranch === b.id
                  ? "bg-[#FF00C8] text-white"
                  : "bg-white/5 text-gray-400"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-[#FF8A00]/10 border border-[#FF8A00]/30 rounded-xl p-4 text-sm text-[#FF8A00]">
            {error}
          </div>
        ) : !shift ? (
          <OpenShiftCard
            branchId={selectedBranch}
            onOpened={() => loadShiftData(selectedBranch)}
          />
        ) : (
          <>
            {lastClosedShift && (
              <ClosedShiftSummary
                summary={lastClosedShift}
                onDismiss={() => setLastClosedShift(null)}
              />
            )}

            <ShiftSummaryCard
              shift={shift}
              branchName={
                branches.find((b) => b.id === selectedBranch)?.name ?? ""
              }
              sales={sales}
              movements={movements}
              liveExpectedCash={liveExpectedCash}
              liveExpectedCard={liveExpectedCard}
              liveExpectedTransfer={liveExpectedTransfer}
              salesTotal={salesTotal}
              onRequestClose={() => setCloseModalOpen(true)}
            />

            <ManualSaleForm
              shiftId={shift.id}
              branchId={selectedBranch}
              onAdded={(sale) => setSales((prev) => [sale, ...prev])}
            />

            <CashMovementForm
              shiftId={shift.id}
              branchId={selectedBranch}
              onAdded={(mov) => setMovements((prev) => [mov, ...prev])}
            />

            <RecentActivity
              sales={sales}
              movements={movements}
              onDeleteSale={async (id) => {
                setSales((prev) => prev.filter((s) => s.id !== id));
                await fetch(`/api/manual-sales?id=${id}`, { method: "DELETE" });
              }}
              onDeleteMovement={async (id) => {
                setMovements((prev) => prev.filter((m) => m.id !== id));
                await fetch(`/api/cash-movements?id=${id}`, { method: "DELETE" });
              }}
            />
          </>
        )}
      </main>

      {closeModalOpen && shift && (
        <CloseShiftModal
          shift={shift}
          liveExpectedCash={liveExpectedCash}
          liveExpectedCard={liveExpectedCard}
          liveExpectedTransfer={liveExpectedTransfer}
          onClose={() => setCloseModalOpen(false)}
          onClosed={(summary) => {
            setCloseModalOpen(false);
            setLastClosedShift(summary);
            loadShiftData(selectedBranch);
          }}
        />
      )}
    </div>
  );
}

/* ============================================================================
   Abrir turno
   ============================================================================ */

function OpenShiftCard({
  branchId,
  onOpened,
}: {
  branchId: string;
  onOpened: () => void;
}) {
  const [openingCash, setOpeningCash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    if (openingCash === "" || Number(openingCash) < 0) {
      setError("Ingresa el monto inicial de efectivo (puede ser 0).");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/cash-shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId, openingCash: Number(openingCash) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo abrir el turno.");
      setSubmitting(false);
      return;
    }
    onOpened();
  };

  return (
    <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 text-center">
      <Wallet size={28} className="text-gray-600 mx-auto mb-3" />
      <h2 className="font-black text-base uppercase italic mb-1">
        No hay turno abierto
      </h2>
      <p className="text-xs text-gray-500 mb-5">
        Abre un turno indicando el efectivo inicial en caja para empezar a
        registrar ventas y movimientos.
      </p>

      <div className="max-w-xs mx-auto">
        <label className="text-xs font-bold uppercase text-gray-400 mb-1.5 block text-left">
          Efectivo inicial en caja
        </label>
        <input
          type="number"
          value={openingCash}
          onChange={(e) => setOpeningCash(e.target.value)}
          placeholder="0"
          className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white text-center focus:outline-none focus:border-[#FF00C8] mb-3"
        />
        {error && <p className="text-[#FF8A00] text-xs mb-3">{error}</p>}
        <button
          onClick={handleOpen}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase text-sm bg-[#FF00C8] text-white shadow-[0_0_20px_rgba(255,0,200,0.5)] disabled:opacity-50"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
          Abrir Turno
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   Resumen del turno abierto
   ============================================================================ */

function ShiftSummaryCard({
  shift,
  branchName,
  sales,
  movements,
  liveExpectedCash,
  liveExpectedCard,
  liveExpectedTransfer,
  salesTotal,
  onRequestClose,
}: {
  shift: Shift;
  branchName: string;
  sales: ManualSale[];
  movements: CashMovement[];
  liveExpectedCash: number;
  liveExpectedCard: number;
  liveExpectedTransfer: number;
  salesTotal: number;
  onRequestClose: () => void;
}) {
  const handlePrintSummary = () => {
    const salesByMethod = PAYMENT_METHODS.map((m) => {
      const matching = sales.filter((s) => s.payment_method === m.id);
      return {
        method: m.label,
        total: matching.reduce((sum, s) => sum + s.amount, 0),
        count: matching.length,
      };
    }).filter((m) => m.count > 0);

    const movementsIn = movements
      .filter((m) => m.type === "ingreso")
      .reduce((sum, m) => sum + m.amount, 0);
    const movementsOut = movements
      .filter((m) => m.type === "egreso")
      .reduce((sum, m) => sum + m.amount, 0);

    printDailySummary({
      branchName,
      dateLabel: new Date(shift.opened_at).toLocaleDateString("es-CL"),
      totalSales: salesTotal,
      salesByMethod,
      movementsIn,
      movementsOut,
      openingCash: shift.opening_cash,
      expectedCash: liveExpectedCash,
      ordersCount: sales.length,
    });
  };

  return (
    <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase text-[#2ECC71] bg-[#2ECC71]/10 px-2.5 py-1 rounded-full mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2ECC71]" /> Turno
            abierto
          </span>
          <p className="text-xs text-gray-500">
            Desde {new Date(shift.opened_at).toLocaleString("es-CL")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintSummary}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 text-gray-300 text-xs font-bold uppercase"
            title="Imprimir resumen de ventas"
          >
            <Printer size={13} />
          </button>
          <button
            onClick={onRequestClose}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF8A00]/15 text-[#FF8A00] text-xs font-bold uppercase"
          >
            <Lock size={13} /> Cerrar Turno
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#1A1A1A] rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
            Efectivo
          </p>
          <p className="font-black text-[#FFEA00] text-sm">
            ${formatCLP(liveExpectedCash)}
          </p>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
            Tarjeta
          </p>
          <p className="font-black text-[#FFEA00] text-sm">
            ${formatCLP(liveExpectedCard)}
          </p>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
            Transferencia
          </p>
          <p className="font-black text-[#FFEA00] text-sm">
            ${formatCLP(liveExpectedTransfer)}
          </p>
        </div>
      </div>
      <p className="text-center text-[11px] text-gray-500 mt-3">
        Ventas registradas en este turno: ${formatCLP(salesTotal)}
      </p>
    </div>
  );
}

/* ============================================================================
   Registrar venta de mostrador
   ============================================================================ */

function ManualSaleForm({
  shiftId,
  branchId,
  onAdded,
}: {
  shiftId: number;
  branchId: string;
  onAdded: (sale: ManualSale) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("efectivo");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setSubmitting(true);
    const res = await fetch("/api/manual-sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shiftId,
        branchId,
        amount: Number(amount),
        paymentMethod: method,
        description: description.trim() || null,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      onAdded(data.sale);
      setAmount("");
      setDescription("");
    }
    setSubmitting(false);
  };

  return (
    <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 mb-4">
      <h3 className="font-black text-xs uppercase italic text-gray-300 mb-3">
        Registrar Venta
      </h3>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Monto"
          className="bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
        />
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción (opcional, ej: 2 Box Duo)"
        className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm mb-2 focus:outline-none focus:border-[#FF00C8]"
      />
      <button
        onClick={handleSubmit}
        disabled={submitting || !amount}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#FF00C8] text-white text-xs font-bold uppercase disabled:opacity-40"
      >
        <Plus size={14} /> Registrar Venta
      </button>
    </div>
  );
}

/* ============================================================================
   Movimiento de caja manual (ingreso/egreso)
   ============================================================================ */

function CashMovementForm({
  shiftId,
  branchId,
  onAdded,
}: {
  shiftId: number;
  branchId: string;
  onAdded: (mov: CashMovement) => void;
}) {
  const [type, setType] = useState<"ingreso" | "egreso">("egreso");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("efectivo");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0 || !description.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/cash-movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shiftId,
        branchId,
        type,
        amount: Number(amount),
        paymentMethod: method,
        description: description.trim(),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      onAdded(data.movement);
      setAmount("");
      setDescription("");
    }
    setSubmitting(false);
  };

  return (
    <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 mb-4">
      <h3 className="font-black text-xs uppercase italic text-gray-300 mb-3">
        Movimiento de Caja (no es venta)
      </h3>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          onClick={() => setType("ingreso")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold uppercase transition-colors ${
            type === "ingreso"
              ? "bg-[#2ECC71]/15 text-[#2ECC71] border border-[#2ECC71]/40"
              : "bg-[#1A1A1A] text-gray-400 border border-white/10"
          }`}
        >
          <Plus size={13} /> Ingreso
        </button>
        <button
          onClick={() => setType("egreso")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold uppercase transition-colors ${
            type === "egreso"
              ? "bg-[#FF8A00]/15 text-[#FF8A00] border border-[#FF8A00]/40"
              : "bg-[#1A1A1A] text-gray-400 border border-white/10"
          }`}
        >
          <Minus size={13} /> Egreso
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Monto"
          className="bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
        />
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Motivo (ej: compra de hielo)"
        className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm mb-2 focus:outline-none focus:border-[#FF00C8]"
      />
      <button
        onClick={handleSubmit}
        disabled={submitting || !amount || !description.trim()}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/10 text-white text-xs font-bold uppercase disabled:opacity-40"
      >
        Registrar Movimiento
      </button>
    </div>
  );
}

/* ============================================================================
   Actividad reciente del turno (ventas + movimientos, con opción de borrar)
   ============================================================================ */

function RecentActivity({
  sales,
  movements,
  onDeleteSale,
  onDeleteMovement,
}: {
  sales: ManualSale[];
  movements: CashMovement[];
  onDeleteSale: (id: number) => void;
  onDeleteMovement: (id: number) => void;
}) {
  type Entry = {
    id: string;
    time: string;
    label: string;
    amount: number;
    isMovement: boolean;
    rawId: number;
  };

  const entries: Entry[] = [
    ...sales.map((s) => ({
      id: `sale-${s.id}`,
      time: s.created_at,
      label: `Venta (${s.payment_method})${s.description ? " — " + s.description : ""}`,
      amount: s.amount,
      isMovement: false,
      rawId: s.id,
    })),
    ...movements.map((m) => ({
      id: `mov-${m.id}`,
      time: m.created_at,
      label: `${m.type === "ingreso" ? "Ingreso" : "Egreso"} (${m.payment_method}) — ${m.description}`,
      amount: m.type === "ingreso" ? m.amount : -m.amount,
      isMovement: true,
      rawId: m.id,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  if (entries.length === 0) {
    return (
      <p className="text-xs text-gray-600 italic text-center py-6">
        Sin actividad registrada en este turno todavía.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <h3 className="font-black text-xs uppercase italic text-gray-300 mb-2">
        Actividad del turno
      </h3>
      {entries.map((e) => (
        <div
          key={e.id}
          className="flex items-center justify-between gap-2 bg-[#161616] border border-white/5 rounded-xl px-3.5 py-2.5"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-300 truncate">{e.label}</p>
            <p className="text-[10px] text-gray-600">
              {new Date(e.time).toLocaleTimeString("es-CL")}
            </p>
          </div>
          <span
            className={`text-xs font-bold flex-shrink-0 ${
              e.amount >= 0 ? "text-[#2ECC71]" : "text-[#FF8A00]"
            }`}
          >
            {e.amount >= 0 ? "+" : ""}${formatCLP(e.amount)}
          </span>
          <button
            onClick={() =>
              e.isMovement ? onDeleteMovement(e.rawId) : onDeleteSale(e.rawId)
            }
            className="p-1 rounded-full text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
            aria-label="Eliminar"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   Cierre de turno (arqueo normal o ciego)
   ============================================================================ */

function CloseShiftModal({
  shift,
  liveExpectedCash,
  liveExpectedCard,
  liveExpectedTransfer,
  onClose,
  onClosed,
}: {
  shift: Shift;
  liveExpectedCash: number;
  liveExpectedCard: number;
  liveExpectedTransfer: number;
  onClose: () => void;
  onClosed: (summary: {
    expected: { cash: number; card: number; transfer: number };
    difference: { cash: number; card: number; transfer: number };
  }) => void;
}) {
  const [closingType, setClosingType] = useState<"normal" | "ciego">("normal");
  const [countedCash, setCountedCash] = useState("");
  const [countedCard, setCountedCard] = useState("");
  const [countedTransfer, setCountedTransfer] = useState("");
  const [notes, setNotes] = useState("");
  const [revealStep, setRevealStep] = useState(false); // para arqueo ciego: paso de confirmación
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allCounted =
    countedCash !== "" && countedCard !== "" && countedTransfer !== "";

  const handleConfirmCount = () => {
    if (!allCounted) {
      setError("Ingresa los 3 montos contados (puede ser 0).");
      return;
    }
    setError(null);
    if (closingType === "ciego") {
      // En arqueo ciego, mostramos la diferencia recién después de confirmar el conteo.
      setRevealStep(true);
    } else {
      handleFinalSubmit();
    }
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/cash-shifts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: shift.id,
        closingType,
        countedCash: Number(countedCash),
        countedCard: Number(countedCard),
        countedTransfer: Number(countedTransfer),
        notes: notes.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "No se pudo cerrar el turno.");
      setSubmitting(false);
      return;
    }
    onClosed({ expected: data.expected, difference: data.difference });
  };

  const diffCash = allCounted ? Number(countedCash) - liveExpectedCash : 0;
  const diffCard = allCounted ? Number(countedCard) - liveExpectedCard : 0;
  const diffTransfer = allCounted
    ? Number(countedTransfer) - liveExpectedTransfer
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-[#121212] rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 max-h-[92vh] flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-white/5">
          <h2 className="font-black text-base uppercase italic">
            Cerrar Turno — Arqueo
          </h2>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {!revealStep ? (
            <>
              <div>
                <p className="text-xs font-bold uppercase text-gray-400 mb-2">
                  Tipo de arqueo
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setClosingType("normal")}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold uppercase transition-colors ${
                      closingType === "normal"
                        ? "bg-[#FF00C8]/15 text-white border border-[#FF00C8]"
                        : "bg-[#1A1A1A] text-gray-400 border border-white/10"
                    }`}
                  >
                    <Eye size={13} /> Normal
                  </button>
                  <button
                    onClick={() => setClosingType("ciego")}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold uppercase transition-colors ${
                      closingType === "ciego"
                        ? "bg-[#FF00C8]/15 text-white border border-[#FF00C8]"
                        : "bg-[#1A1A1A] text-gray-400 border border-white/10"
                    }`}
                  >
                    <EyeOff size={13} /> Ciego
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  {closingType === "normal"
                    ? "Verás el monto esperado mientras cuentas."
                    : "Cuenta primero sin ver el esperado. La diferencia se revela después de confirmar."}
                </p>
              </div>

              {(["cash", "card", "transfer"] as const).map((key) => {
                const labels = {
                  cash: "Efectivo contado",
                  card: "Tarjeta contada",
                  transfer: "Transferencia contada",
                };
                const expected = {
                  cash: liveExpectedCash,
                  card: liveExpectedCard,
                  transfer: liveExpectedTransfer,
                }[key];
                const value = { cash: countedCash, card: countedCard, transfer: countedTransfer }[key];
                const setValue = {
                  cash: setCountedCash,
                  card: setCountedCard,
                  transfer: setCountedTransfer,
                }[key];
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold uppercase text-gray-400">
                        {labels[key]}
                      </label>
                      {closingType === "normal" && (
                        <span className="text-[11px] text-gray-500">
                          Esperado: ${formatCLP(expected)}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
                    />
                  </div>
                );
              })}

              <div>
                <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">
                  Notas (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8] resize-none"
                />
              </div>

              {error && (
                <p className="text-[#FF8A00] text-xs bg-[#FF8A00]/10 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 text-center mb-2">
                Resultado del arqueo ciego — diferencia entre lo contado y lo
                esperado por el sistema:
              </p>
              {[
                { label: "Efectivo", diff: diffCash },
                { label: "Tarjeta", diff: diffCard },
                { label: "Transferencia", diff: diffTransfer },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between bg-[#1A1A1A] rounded-xl px-4 py-3"
                >
                  <span className="text-sm font-bold text-gray-300">
                    {row.label}
                  </span>
                  <span
                    className={`font-black text-sm ${
                      row.diff === 0
                        ? "text-[#2ECC71]"
                        : row.diff > 0
                        ? "text-[#FFEA00]"
                        : "text-[#FF8A00]"
                    }`}
                  >
                    {row.diff === 0
                      ? "Exacto"
                      : `${row.diff > 0 ? "+" : ""}$${formatCLP(row.diff)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-white/5">
          {!revealStep ? (
            <button
              onClick={handleConfirmCount}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black uppercase text-sm bg-[#FF00C8] text-white shadow-[0_0_20px_rgba(255,0,200,0.5)]"
            >
              {closingType === "ciego" ? "Confirmar Conteo" : "Cerrar Turno"}
            </button>
          ) : (
            <button
              onClick={handleFinalSubmit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black uppercase text-sm bg-[#FF00C8] text-white shadow-[0_0_20px_rgba(255,0,200,0.5)] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Confirmar Cierre
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Resumen tras cerrar un turno
   ============================================================================ */

function ClosedShiftSummary({
  summary,
  onDismiss,
}: {
  summary: {
    expected: { cash: number; card: number; transfer: number };
    difference: { cash: number; card: number; transfer: number };
  };
  onDismiss: () => void;
}) {
  return (
    <div className="bg-[#2ECC71]/10 border border-[#2ECC71]/30 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="font-black text-sm uppercase italic text-[#2ECC71] flex items-center gap-2">
          <CheckCircle2 size={16} /> Turno cerrado
        </p>
        <button
          onClick={onDismiss}
          className="text-xs text-gray-400 hover:text-white"
        >
          Cerrar
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Efectivo", diff: summary.difference.cash },
          { label: "Tarjeta", diff: summary.difference.card },
          { label: "Transferencia", diff: summary.difference.transfer },
        ].map((row) => (
          <div key={row.label} className="bg-[#1A1A1A] rounded-xl p-3">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">
              {row.label}
            </p>
            <p
              className={`font-black text-sm ${
                row.diff === 0
                  ? "text-[#2ECC71]"
                  : row.diff > 0
                  ? "text-[#FFEA00]"
                  : "text-[#FF8A00]"
              }`}
            >
              {row.diff === 0 ? "✓" : `${row.diff > 0 ? "+" : ""}$${formatCLP(row.diff)}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
