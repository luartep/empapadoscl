"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  ArrowLeft,
  Boxes,
  Plus,
  Minus,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  History,
  AlertTriangle,
  SlidersHorizontal,
} from "lucide-react";

/* ============================================================================
   Tipos
   ============================================================================ */

type Branch = { id: string; name: string };

type InventoryItem = {
  id: number;
  branch_id: string;
  name: string;
  unit: string;
  quantity: string; // numeric llega como string desde Postgres
  min_threshold: string;
  notes: string | null;
  active: boolean;
  updated_at: string;
};

type InventoryMovement = {
  id: number;
  item_id: number;
  type: "entrada" | "salida" | "ajuste";
  quantity: string;
  resulting_quantity: string;
  note: string | null;
  created_at: string;
};

const UNITS = ["unidad", "kg", "g", "l", "ml", "paquete", "caja"];

const formatQty = (value: string | number) => {
  const n = Number(value);
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
};

/* ============================================================================
   Componente principal
   ============================================================================ */

export default function InventoryPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<InventoryItem | "new" | null>(null);
  const [movingItem, setMovingItem] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/branches");
        const data = await res.json();
        if (res.ok) {
          setBranches(data.branches);
          if (data.branches.length > 0) setSelectedBranch(data.branches[0].id);
        } else {
          setError(data.error || "No se pudieron cargar las sucursales.");
        }
      } catch {
        setError("Error de conexión al cargar sucursales.");
      }
    })();
  }, []);

  const load = useCallback(async (branchId: string) => {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/inventory?branchId=${encodeURIComponent(branchId)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo cargar el inventario.");
        setLoading(false);
        return;
      }
      setItems(data.items);
      setError(null);
    } catch {
      setError("Error de conexión al cargar el inventario.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedBranch) load(selectedBranch);
  }, [selectedBranch, load]);

  const handleDelete = async (item: InventoryItem) => {
    if (
      !confirm(
        `¿Eliminar "${item.name}" de este local? Se pierde también su historial de movimientos.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/inventory?id=${item.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      load(selectedBranch);
    } else {
      const data = await res.json();
      alert(data.error || "No se pudo eliminar.");
    }
  };

  const lowStockCount = items.filter(
    (i) => Number(i.quantity) <= Number(i.min_threshold)
  ).length;

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
            <Boxes size={18} className="text-[#FF00C8]" /> Inventario
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
        <div className="flex gap-2 mb-5">
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

        <div className="flex items-center justify-between mb-5 gap-3">
          <p className="text-sm text-gray-400">
            {items.length} insumo{items.length !== 1 ? "s" : ""}
            {lowStockCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-[#FF8A00] font-bold">
                <AlertTriangle size={12} />
                {lowStockCount} con stock bajo
              </span>
            )}
          </p>
          <button
            onClick={() => setEditing("new")}
            disabled={!selectedBranch}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF00C8] text-white text-xs font-bold uppercase shadow-[0_0_14px_rgba(255,0,200,0.4)] disabled:opacity-40"
          >
            <Plus size={14} /> Nuevo Insumo
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-[#FF8A00]/10 border border-[#FF8A00]/30 rounded-xl p-4 text-sm text-[#FF8A00]">
            {error}
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-gray-600 italic">
            Sin insumos cargados todavía para esta sucursal.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const qty = Number(item.quantity);
              const min = Number(item.min_threshold);
              const lowStock = qty <= min;
              return (
                <div
                  key={item.id}
                  className={`bg-[#161616] border rounded-xl px-4 py-3 ${
                    lowStock ? "border-[#FF8A00]/40" : "border-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate flex items-center gap-1.5">
                        {item.name}
                        {lowStock && (
                          <AlertTriangle
                            size={12}
                            className="text-[#FF8A00] flex-shrink-0"
                          />
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        Mínimo: {formatQty(item.min_threshold)} {item.unit}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`font-black text-lg ${
                          lowStock ? "text-[#FF8A00]" : "text-[#FFEA00]"
                        }`}
                      >
                        {formatQty(item.quantity)}
                      </p>
                      <p className="text-[10px] text-gray-500 uppercase">
                        {item.unit}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    <button
                      onClick={() => setMovingItem(item)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2ECC71]/10 text-[#2ECC71] text-xs font-bold hover:bg-[#2ECC71]/20 transition-colors"
                    >
                      <Plus size={12} /> Entrada
                    </button>
                    <button
                      onClick={() => setMovingItem(item)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors"
                    >
                      <Minus size={12} /> Salida
                    </button>
                    <button
                      onClick={() => setHistoryItem(item)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs font-bold hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <History size={12} /> Historial
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => setEditing(item)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      aria-label={`Editar ${item.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                      aria-label={`Eliminar ${item.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {editing && (
        <ItemEditorModal
          item={editing === "new" ? null : editing}
          branchId={selectedBranch}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load(selectedBranch);
          }}
        />
      )}

      {movingItem && (
        <MovementModal
          item={movingItem}
          onClose={() => setMovingItem(null)}
          onSaved={() => {
            setMovingItem(null);
            load(selectedBranch);
          }}
        />
      )}

      {historyItem && (
        <HistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />
      )}
    </div>
  );
}

/* ============================================================================
   Modal: crear / editar insumo
   ============================================================================ */

function ItemEditorModal({
  item,
  branchId,
  onClose,
  onSaved,
}: {
  item: InventoryItem | null;
  branchId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = item === null;
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "unidad");
  const [quantity, setQuantity] = useState(item?.quantity ?? "0");
  const [minThreshold, setMinThreshold] = useState(item?.min_threshold ?? "0");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Ingresa un nombre para el insumo.");
      return;
    }
    setSaving(true);

    try {
      const res = await fetch("/api/inventory", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNew
            ? {
                branchId,
                name: name.trim(),
                unit,
                quantity: Number(quantity) || 0,
                minThreshold: Number(minThreshold) || 0,
                notes: notes.trim() || null,
              }
            : {
                id: item!.id,
                name: name.trim(),
                unit,
                minThreshold: Number(minThreshold) || 0,
                notes: notes.trim() || null,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo guardar.");
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError("Error de conexión.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full sm:max-w-md bg-[#121212] rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
          <h2 className="font-black text-base uppercase italic">
            {isNew ? "Nuevo Insumo" : "Editar Insumo"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">
              Nombre
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Pan de Completo"
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">
                Unidad
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">
                Stock mínimo
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
              />
            </div>
          </div>

          {isNew && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">
                Stock inicial
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Después de creado, usa los botones de Entrada/Salida para
                ajustar el stock (queda registrado en el historial).
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ej. proveedor, tamaño del paquete, etc."
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8] resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-white/5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black uppercase text-sm bg-[#FF00C8] text-white shadow-[0_0_20px_rgba(255,0,200,0.5)] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Modal: registrar movimiento de stock (entrada / salida / ajuste)
   ============================================================================ */

function MovementModal({
  item,
  onClose,
  onSaved,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"entrada" | "salida" | "ajuste">("entrada");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    const qty = Number(quantity);
    if (!quantity || Number.isNaN(qty) || qty < 0) {
      setError("Ingresa una cantidad válida.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/inventory-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          type,
          quantity: qty,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo registrar el movimiento.");
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError("Error de conexión.");
      setSaving(false);
    }
  };

  const currentQty = Number(item.quantity);
  const previewQty =
    quantity && !Number.isNaN(Number(quantity))
      ? type === "entrada"
        ? currentQty + Number(quantity)
        : type === "salida"
        ? currentQty - Number(quantity)
        : Number(quantity)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full sm:max-w-sm bg-[#121212] rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
          <h2 className="font-black text-base uppercase italic truncate pr-2">
            {item.name}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-gray-500">
            Stock actual:{" "}
            <span className="font-bold text-white">
              {formatQty(item.quantity)} {item.unit}
            </span>
          </p>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setType("entrada")}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-bold uppercase transition-colors ${
                type === "entrada"
                  ? "bg-[#2ECC71]/20 text-[#2ECC71] border border-[#2ECC71]/40"
                  : "bg-white/5 text-gray-400 border border-transparent"
              }`}
            >
              <Plus size={14} /> Entrada
            </button>
            <button
              onClick={() => setType("salida")}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-bold uppercase transition-colors ${
                type === "salida"
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : "bg-white/5 text-gray-400 border border-transparent"
              }`}
            >
              <Minus size={14} /> Salida
            </button>
            <button
              onClick={() => setType("ajuste")}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-bold uppercase transition-colors ${
                type === "ajuste"
                  ? "bg-[#3B9DFF]/20 text-[#3B9DFF] border border-[#3B9DFF]/40"
                  : "bg-white/5 text-gray-400 border border-transparent"
              }`}
            >
              <SlidersHorizontal size={14} /> Ajuste
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">
              {type === "ajuste"
                ? `Nuevo stock (${item.unit})`
                : `Cantidad (${item.unit})`}
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              autoFocus
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
            />
            {previewQty !== null && (
              <p
                className={`text-xs mt-1.5 ${
                  previewQty < 0 ? "text-red-400" : "text-gray-500"
                }`}
              >
                Stock resultante: <span className="font-bold">{formatQty(previewQty)} {item.unit}</span>
                {previewQty < 0 && " — quedaría en negativo"}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">
              Nota (opcional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. compra proveedor, merma, conteo semanal"
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black uppercase text-sm bg-[#FF00C8] text-white shadow-[0_0_20px_rgba(255,0,200,0.5)] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Modal: historial de movimientos de un insumo
   ============================================================================ */

function HistoryModal({
  item,
  onClose,
}: {
  item: InventoryItem;
  onClose: () => void;
}) {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/inventory-movements?itemId=${item.id}`);
        const data = await res.json();
        if (res.ok) setMovements(data.movements);
      } catch {
        // silencioso — no es crítico si falla el historial
      }
      setLoading(false);
    })();
  }, [item.id]);

  const typeLabel = { entrada: "Entrada", salida: "Salida", ajuste: "Ajuste" };
  const typeColor = {
    entrada: "text-[#2ECC71]",
    salida: "text-red-400",
    ajuste: "text-[#3B9DFF]",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full sm:max-w-sm bg-[#121212] rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
          <h2 className="font-black text-base uppercase italic truncate pr-2">
            Historial — {item.name}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : movements.length === 0 ? (
            <p className="text-xs text-gray-600 italic">
              Sin movimientos registrados todavía.
            </p>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="bg-[#161616] border border-white/5 rounded-xl px-4 py-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold uppercase ${typeColor[m.type]}`}
                    >
                      {typeLabel[m.type]}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(m.created_at).toLocaleString("es-CL", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm mt-0.5">
                    {m.type === "ajuste" ? (
                      <>
                        Ajustado a{" "}
                        <span className="font-bold">
                          {formatQty(m.quantity)} {item.unit}
                        </span>
                      </>
                    ) : (
                      <>
                        {m.type === "entrada" ? "+" : "-"}
                        <span className="font-bold">
                          {formatQty(m.quantity)} {item.unit}
                        </span>{" "}
                        → queda en {formatQty(m.resulting_quantity)} {item.unit}
                      </>
                    )}
                  </p>
                  {m.note && (
                    <p className="text-xs text-gray-500 mt-0.5 italic">
                      {m.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
