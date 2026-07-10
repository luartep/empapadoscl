"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { printComanda } from "@/lib/printing";
import {
  LogOut,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Package,
  ClipboardList,
  Wallet,
  BarChart2,
  Loader2,
  Printer,
  CheckCircle2,
  ThumbsUp,
  Ban,
  AlertTriangle,
} from "lucide-react";

/* ============================================================================
   Tipos
   ============================================================================ */

type ModifierGroup = {
  id: string;
  label: string;
  required: number;
  options: { id: string; name: string; price: number }[];
  extraUnitPrice?: number;
};

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  allowsExtras: boolean;
  restrictedToSalvadorAllende: boolean;
  modifierGroups: ModifierGroup[];
  sortOrder: number;
  active: boolean;
};

type Category = { id: string; label: string };

type Order = {
  id: number;
  customer_name: string;
  order_type: "delivery" | "retiro" | "mostrador";
  address: string | null;
  pickup_location: string | null;
  branch_id: string | null;
  items: {
    item: { name: string };
    qty: number;
    unitPrice: number;
    selections: { optionName: string; price: number; groupLabel: string }[];
    note?: string;
  }[];
  total: number;
  status: "pendiente" | "completado" | "cancelado";
  prep_status: "en_preparacion" | "en_reparto" | "entregado";
  payment_status: "pendiente" | "pagado";
  payment_method: "efectivo" | "tarjeta" | "transferencia" | null;
  cash_sale_id: number | null;
  accepted: boolean;
  cancel_reason: string | null;
  created_at: string;
};

type Branch = { id: string; name: string };

const CANCEL_REASONS = [
  "Sin stock",
  "Cliente no contesta",
  "Dirección fuera de zona",
  "Pedido duplicado",
  "Cierre anticipado",
  "Otro motivo",
];

const PREP_STATUSES = [
  { id: "en_preparacion", label: "En Preparación", color: "#FFEA00" },
  { id: "en_reparto", label: "En Reparto", color: "#3B9DFF" },
  { id: "entregado", label: "Entregado", color: "#2ECC71" },
] as const;

const PAYMENT_METHODS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "tarjeta", label: "Tarjeta" },
  { id: "transferencia", label: "Transferencia" },
] as const;

const formatCLP = (value: number) =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value);

/* ============================================================================
   Componente principal
   ============================================================================ */

export default function AdminPanelPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"products" | "orders">("products");

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center justify-between px-4 h-16 max-w-5xl mx-auto">
          <h1 className="font-black text-lg uppercase italic">
            Panel Empapados
          </h1>
          <button
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              router.push("/admin/login");
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors"
          >
            <LogOut size={14} /> Salir
          </button>
        </div>
        <div className="flex gap-2 px-4 pb-3 max-w-5xl mx-auto">
          <button
            onClick={() => setTab("products")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase transition-colors ${
              tab === "products"
                ? "bg-[#FF00C8] text-white"
                : "bg-white/5 text-gray-400"
            }`}
          >
            <Package size={14} /> Productos
          </button>
          <button
            onClick={() => setTab("orders")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase transition-colors ${
              tab === "orders"
                ? "bg-[#FF00C8] text-white"
                : "bg-white/5 text-gray-400"
            }`}
          >
            <ClipboardList size={14} /> Pedidos
          </button>
          <button
            onClick={() => router.push("/admin/cash")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <Wallet size={14} /> Caja
          </button>
          <button
            onClick={() => router.push("/admin/reports")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <BarChart2 size={14} /> Reportes
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === "products" ? <ProductsTab /> : <OrdersTab />}
      </main>
    </div>
  );
}

/* ============================================================================
   Tab de Productos
   ============================================================================ */

function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo cargar el menú.");
        setLoading(false);
        return;
      }
      setProducts(data.menuData);
      setCategories(data.categories);
      setError(null);
    } catch {
      setError("Error de conexión al cargar productos.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) {
      return;
    }
    const res = await fetch(`/api/products?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      load();
    } else {
      const data = await res.json();
      alert(data.error || "No se pudo eliminar.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#FF8A00]/10 border border-[#FF8A00]/30 rounded-xl p-4 text-sm text-[#FF8A00]">
        {error}
      </div>
    );
  }

  const grouped: Record<string, Product[]> = {};
  categories.forEach((c) => (grouped[c.id] = []));
  products.forEach((p) => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-400">
          {products.length} producto{products.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF00C8] text-white text-xs font-bold uppercase shadow-[0_0_14px_rgba(255,0,200,0.4)]"
        >
          <Plus size={14} /> Nuevo Producto
        </button>
      </div>

      {categories.map((cat) => (
        <section key={cat.id} className="mb-8">
          <h2 className="font-black text-sm uppercase italic text-gray-300 mb-3">
            {cat.label}{" "}
            <span className="text-gray-500 font-normal">
              ({grouped[cat.id]?.length || 0})
            </span>
          </h2>
          <div className="space-y-2">
            {grouped[cat.id]?.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 bg-[#161616] border border-white/5 rounded-xl px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{p.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {p.description}
                  </p>
                </div>
                <span className="text-[#FFEA00] font-bold text-sm flex-shrink-0">
                  ${formatCLP(p.price)}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setEditing(p)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    aria-label={`Editar ${p.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                    aria-label={`Eliminar ${p.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {(!grouped[cat.id] || grouped[cat.id].length === 0) && (
              <p className="text-xs text-gray-600 italic">
                Sin productos en esta categoría todavía.
              </p>
            )}
          </div>
        </section>
      ))}

      {editing && (
        <ProductEditorModal
          product={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ============================================================================
   Modal de edición / creación de producto
   ============================================================================ */

function ProductEditorModal({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = product === null;
  const [id, setId] = useState(product?.id ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product?.price?.toString() ?? "");
  const [category, setCategory] = useState(
    product?.category ?? categories[0]?.id ?? ""
  );
  const [image, setImage] = useState(product?.image ?? "");
  const [allowsExtras, setAllowsExtras] = useState(
    product?.allowsExtras ?? false
  );
  const [restricted, setRestricted] = useState(
    product?.restrictedToSalvadorAllende ?? false
  );
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>(
    product?.modifierGroups ? JSON.parse(JSON.stringify(product.modifierGroups)) : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateGroup = (groupIndex: number, patch: Partial<ModifierGroup>) => {
    setModifierGroups((prev) =>
      prev.map((g, i) => (i === groupIndex ? { ...g, ...patch } : g))
    );
  };

  const updateOption = (
    groupIndex: number,
    optionIndex: number,
    patch: Partial<{ name: string; price: number }>
  ) => {
    setModifierGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex
          ? {
              ...g,
              options: g.options.map((o, j) =>
                j === optionIndex ? { ...o, ...patch } : o
              ),
            }
          : g
      )
    );
  };

  const addOption = (groupIndex: number) => {
    setModifierGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex
          ? {
              ...g,
              options: [
                ...g.options,
                {
                  id: `opt-${Date.now()}`,
                  name: "Nueva opción",
                  price: 0,
                },
              ],
            }
          : g
      )
    );
  };

  const removeOption = (groupIndex: number, optionIndex: number) => {
    setModifierGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex
          ? { ...g, options: g.options.filter((_, j) => j !== optionIndex) }
          : g
      )
    );
  };

  const handleSave = async () => {
    setError(null);
    if (!id.trim() || !name.trim() || !price || !category) {
      setError("Completa al menos ID, nombre, precio y categoría.");
      return;
    }
    setSaving(true);

    const payload = {
      id: id.trim(),
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      category,
      image: image.trim() || null,
      allowsExtras,
      restrictedToSalvadorAllende: restricted,
      modifierGroups,
    };

    try {
      const res = await fetch("/api/products", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-[#121212] rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
          <h2 className="font-black text-base uppercase italic">
            {isNew ? "Nuevo Producto" : "Editar Producto"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {!isNew ? (
            <div>
              <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">
                ID
              </label>
              <input
                value={id}
                disabled
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-500"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">
                ID único (sin espacios, ej: box-especial)
              </label>
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="box-especial"
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">
              Nombre
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">
                Precio (CLP)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-gray-400 mb-1 block">
              Ruta de imagen (ej: /images/box-grande.jpg)
            </label>
            <input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="/images/placeholder.svg"
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#FF00C8]"
            />
          </div>

          <label className="flex items-center gap-2.5 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={allowsExtras}
              onChange={(e) => setAllowsExtras(e.target.checked)}
              className="w-4 h-4 accent-[#FF00C8]"
            />
            <span className="text-sm text-gray-300">
              Permite adicionales con costo
            </span>
          </label>

          <label className="flex items-center gap-2.5 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={restricted}
              onChange={(e) => setRestricted(e.target.checked)}
              className="w-4 h-4 accent-[#FF00C8]"
            />
            <span className="text-sm text-gray-300">
              Solo retiro/entrega en Salvador Allende
            </span>
          </label>

          {modifierGroups.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-white/5">
              <p className="text-[11px] font-bold uppercase text-gray-400">
                Grupos de selección (proteínas, salsas, toques frescos,
                adicionales, etc.)
              </p>
              {modifierGroups.map((group, gIdx) => (
                <div
                  key={group.id}
                  className="bg-[#1A1A1A] border border-white/10 rounded-xl p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={group.label}
                      onChange={(e) =>
                        updateGroup(gIdx, { label: e.target.value })
                      }
                      className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-[#FF00C8]"
                    />
                    {group.required > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[10px] text-gray-500">
                          Incluye
                        </span>
                        <input
                          type="number"
                          value={group.required}
                          onChange={(e) =>
                            updateGroup(gIdx, {
                              required: Number(e.target.value) || 0,
                            })
                          }
                          className="w-12 bg-[#0A0A0A] border border-white/10 rounded-lg px-1.5 py-1.5 text-xs text-center focus:outline-none focus:border-[#FF00C8]"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {group.options.map((opt, oIdx) => (
                      <div key={opt.id} className="flex items-center gap-1.5">
                        <input
                          value={opt.name}
                          onChange={(e) =>
                            updateOption(gIdx, oIdx, { name: e.target.value })
                          }
                          className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#FF00C8]"
                        />
                        <input
                          type="number"
                          value={opt.price}
                          onChange={(e) =>
                            updateOption(gIdx, oIdx, {
                              price: Number(e.target.value) || 0,
                            })
                          }
                          placeholder="$0"
                          className="w-20 bg-[#0A0A0A] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:border-[#FF00C8]"
                        />
                        <button
                          onClick={() => removeOption(gIdx, oIdx)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
                          aria-label="Quitar opción"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => addOption(gIdx)}
                    className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#FF00C8] uppercase"
                  >
                    <Plus size={12} /> Agregar opción
                  </button>
                </div>
              ))}
              <p className="text-[10px] text-gray-500">
                El precio de cada opción es el recargo que se suma al
                producto (déjalo en $0 si la opción va incluida sin costo
                extra, como las proteínas y salsas base).
              </p>
            </div>
          )}

          {error && (
            <p className="text-[#FF8A00] text-xs bg-[#FF8A00]/10 rounded-lg px-3 py-2">
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
   Modal de cancelación
   ============================================================================ */

function CancelOrderModal({
  order,
  onConfirm,
  onClose,
}: {
  order: Order;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string>("");
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);

  const finalReason = selected === "Otro motivo" ? custom.trim() : selected;

  const handleConfirm = async () => {
    if (!finalReason) return;
    setSaving(true);
    await onConfirm(finalReason);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-sm bg-[#121212] rounded-t-3xl sm:rounded-2xl border-t sm:border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            <h2 className="font-black text-sm uppercase italic text-red-400">
              Cancelar Pedido #{order.id}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/5">
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-gray-400">
            ¿Por qué se cancela el pedido de{" "}
            <span className="font-bold text-white">{order.customer_name}</span>?
            El registro queda guardado como cancelado.
          </p>

          {/* Opciones rápidas */}
          <div className="grid grid-cols-2 gap-2">
            {CANCEL_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => {
                  setSelected(r);
                  if (r !== "Otro motivo") setCustom("");
                }}
                className={`text-[11px] font-bold uppercase px-3 py-2.5 rounded-xl text-left transition-colors ${
                  selected === r
                    ? "bg-red-500/20 border border-red-500/50 text-red-300"
                    : "bg-white/5 border border-transparent text-gray-400 hover:bg-white/10"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Cuadro de texto — siempre visible, obligatorio si "Otro motivo" */}
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">
              {selected === "Otro motivo"
                ? "Escribe el motivo *"
                : "Detalle adicional (opcional)"}
            </label>
            <textarea
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={
                selected === "Otro motivo"
                  ? "Ej: Cliente canceló por teléfono"
                  : "Ej: último de stock, no respondió llamado..."
              }
              rows={3}
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 resize-none"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
            >
              Volver
            </button>
            <button
              onClick={handleConfirm}
              disabled={!finalReason || saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 transition-colors disabled:opacity-40"
            >
              {saving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Ban size={13} />
              )}
              Confirmar cancelación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Tab de Pedidos
   ============================================================================ */

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "todos" | "en_preparacion" | "en_reparto" | "entregado" | "cancelado"
  >("en_preparacion");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState<string>("todas");
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudieron cargar los pedidos.");
        setLoading(false);
        return;
      }
      setOrders(data.orders);
      setError(null);
    } catch {
      setError("Error de conexión.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/branches")
      .then((res) => res.json())
      .then((data) => setBranches(data.branches || []))
      .catch(() => {});
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const setPrepStatus = async (order: Order, prepStatus: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id ? { ...o, prep_status: prepStatus as any } : o
      )
    );
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id, prepStatus }),
    });
  };

  const acceptOrder = async (order: Order) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, accepted: true } : o))
    );
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id, acceptOrder: true }),
    });
  };

  const cancelOrder = async (order: Order, reason: string) => {
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id, cancelOrder: { reason } }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "No se pudo cancelar el pedido.");
      return;
    }
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              status: "cancelado",
              cancel_reason: reason,
              payment_status: "pendiente",
              payment_method: null,
            }
          : o
      )
    );
    setCancellingOrder(null);
  };

  const markPaid = async (order: Order, paymentMethod: string) => {
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id, markPaid: { paymentMethod } }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "No se pudo marcar como pagado.");
      return;
    }
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              payment_status: "pagado",
              payment_method: paymentMethod as any,
            }
          : o
      )
    );
  };

  const unmarkPaid = async (order: Order) => {
    if (!confirm("¿Revertir el pago de este pedido? Se quitará la venta de la caja.")) {
      return;
    }
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? { ...o, payment_status: "pendiente", payment_method: null }
          : o
      )
    );
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id, unmarkPaid: true }),
    });
  };

  const assignBranch = async (order: Order, branchId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, branch_id: branchId } : o))
    );
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id, branchId }),
    });
  };

  const deleteOrder = async (order: Order) => {
    if (
      !confirm(
        `¿Eliminar permanentemente el pedido de ${order.customer_name}? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    const res = await fetch(`/api/orders?id=${order.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      alert("No se pudo eliminar el pedido. Intenta de nuevo.");
      load();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#FF8A00]/10 border border-[#FF8A00]/30 rounded-xl p-4 text-sm text-[#FF8A00]">
        {error}
      </div>
    );
  }

  const filtered = orders.filter((o) => {
    // Para el filtro de estado: "cancelado" muestra cancelados, el resto filtra por prep_status
    let statusOk: boolean;
    if (filter === "todos") {
      statusOk = true;
    } else if (filter === "cancelado") {
      statusOk = o.status === "cancelado";
    } else {
      statusOk = o.status !== "cancelado" && o.prep_status === filter;
    }

    const branchOk =
      branchFilter === "todas"
        ? true
        : branchFilter === "sin-asignar"
        ? !o.branch_id
        : o.branch_id === branchFilter;
    return statusOk && branchOk;
  });

  const cancelledCount = orders.filter((o) => o.status === "cancelado").length;

  return (
    <div>
      {/* Filtros de estado */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {(
          [
            { id: "en_preparacion", label: "En Preparación" },
            { id: "en_reparto", label: "En Reparto" },
            { id: "entregado", label: "Entregado" },
            { id: "todos", label: "Todos" },
            { id: "cancelado", label: `Cancelados${cancelledCount > 0 ? ` (${cancelledCount})` : ""}` },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition-colors ${
              filter === f.id
                ? f.id === "cancelado"
                  ? "bg-red-500/30 text-red-300 border border-red-500/40"
                  : "bg-[#FF00C8] text-white"
                : "bg-white/5 text-gray-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Filtros de sucursal */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setBranchFilter("todas")}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase transition-colors ${
            branchFilter === "todas"
              ? "bg-white/15 text-white"
              : "bg-white/5 text-gray-500"
          }`}
        >
          Todas las sucursales
        </button>
        {branches.map((b) => (
          <button
            key={b.id}
            onClick={() => setBranchFilter(b.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase transition-colors ${
              branchFilter === b.id
                ? "bg-white/15 text-white"
                : "bg-white/5 text-gray-500"
            }`}
          >
            {b.name}
          </button>
        ))}
        <button
          onClick={() => setBranchFilter("sin-asignar")}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase transition-colors ${
            branchFilter === "sin-asignar"
              ? "bg-[#FF8A00]/20 text-[#FF8A00]"
              : "bg-white/5 text-gray-500"
          }`}
        >
          Sin asignar
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">
          No hay pedidos{" "}
          {filter !== "todos"
            ? filter === "cancelado"
              ? "cancelados"
              : `en estado "${filter}"`
            : ""}
          .
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const isCancelled = order.status === "cancelado";
            return (
              <div
                key={order.id}
                className={`border rounded-xl p-4 transition-opacity ${
                  isCancelled
                    ? "bg-[#1A0A0A] border-red-900/40 opacity-75"
                    : "bg-[#161616] border-white/5"
                }`}
              >
                {/* Cabecera */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase text-[#FF00C8] tracking-wider">
                        Pedido #{order.id}
                      </span>
                      {/* Badge aceptado */}
                      {!isCancelled && order.accepted && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#2ECC71] bg-[#2ECC71]/10 px-2 py-0.5 rounded-full">
                          <ThumbsUp size={10} /> Aceptado
                        </span>
                      )}
                      {/* Badge cancelado */}
                      {isCancelled && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                          <Ban size={10} /> Cancelado
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-sm">{order.customer_name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(order.created_at).toLocaleString("es-CL")}
                    </p>
                    {/* Motivo cancelación */}
                    {isCancelled && order.cancel_reason && (
                      <p className="text-[11px] text-red-400/80 mt-0.5">
                        Motivo: {order.cancel_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!isCancelled && (
                      <button
                        onClick={() => printComanda(order, branches)}
                        aria-label="Imprimir comanda"
                        className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 transition-colors"
                        title="Imprimir comanda"
                      >
                        <Printer size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteOrder(order)}
                      aria-label="Eliminar pedido permanentemente"
                      className="p-1.5 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                      title="Eliminar permanentemente"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Botones Aceptar / Cancelar — solo si no está cancelado */}
                {!isCancelled && (
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => acceptOrder(order)}
                      disabled={order.accepted}
                      className={`flex items-center gap-1.5 flex-1 justify-center py-2 rounded-xl text-[11px] font-bold uppercase transition-colors ${
                        order.accepted
                          ? "bg-[#2ECC71]/10 text-[#2ECC71] border border-[#2ECC71]/30 cursor-default"
                          : "bg-white/5 text-gray-300 hover:bg-[#2ECC71]/15 hover:text-[#2ECC71] border border-transparent"
                      }`}
                    >
                      <ThumbsUp size={12} />
                      {order.accepted ? "Aceptado" : "Aceptar pedido"}
                    </button>
                    <button
                      onClick={() => setCancellingOrder(order)}
                      className="flex items-center gap-1.5 flex-1 justify-center py-2 rounded-xl text-[11px] font-bold uppercase bg-white/5 text-gray-400 hover:bg-red-500/15 hover:text-red-400 border border-transparent transition-colors"
                    >
                      <Ban size={12} />
                      Cancelar pedido
                    </button>
                  </div>
                )}

                {/* Estado de preparación — solo si no está cancelado */}
                {!isCancelled && (
                  <div className="flex gap-1.5 mb-3 flex-wrap">
                    {PREP_STATUSES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setPrepStatus(order, s.id)}
                        className="text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-full whitespace-nowrap transition-colors"
                        style={
                          order.prep_status === s.id
                            ? {
                                backgroundColor: `${s.color}26`,
                                color: s.color,
                                border: `1px solid ${s.color}66`,
                              }
                            : {
                                backgroundColor: "rgba(255,255,255,0.04)",
                                color: "#666",
                                border: "1px solid transparent",
                              }
                        }
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-400 mb-2">
                  {order.order_type === "delivery"
                    ? `🛵 Delivery → ${order.address}`
                    : order.order_type === "mostrador"
                    ? `🏪 Mostrador`
                    : `📍 Retiro en ${
                        order.pickup_location === "salvador-allende"
                          ? "Salvador Allende"
                          : "Lagunillas"
                      }`}
                </p>

                {/* Sucursal */}
                {!isCancelled && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase text-gray-500">
                      Sucursal asignada:
                    </span>
                    <select
                      value={order.branch_id ?? ""}
                      onChange={(e) => assignBranch(order, e.target.value)}
                      className={`text-[11px] font-bold rounded-full px-2.5 py-1 border focus:outline-none ${
                        order.branch_id
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-[#FF8A00]/10 border-[#FF8A00]/30 text-[#FF8A00]"
                      }`}
                    >
                      <option value="">Sin asignar</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Detalle de items */}
                <div className="border-t border-white/5 pt-2 space-y-1.5">
                  {order.items.map((line, idx) => (
                    <div key={idx} className="text-xs text-gray-300">
                      <span className="font-bold">
                        {line.qty}x {line.item.name}
                      </span>{" "}
                      <span className="text-[#FFEA00]">
                        ${formatCLP(line.qty * line.unitPrice)}
                      </span>
                      {line.selections?.length > 0 && (
                        <p className="text-[11px] text-gray-500 ml-3">
                          {line.selections.map((s) => s.optionName).join(", ")}
                        </p>
                      )}
                      {line.note && (
                        <p className="text-[11px] text-[#FFEA00] ml-3">
                          📝 {line.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                  <span className="text-xs font-bold text-gray-400">Total</span>
                  <span className={`font-black ${isCancelled ? "text-gray-500 line-through" : "text-[#FFEA00]"}`}>
                    ${formatCLP(order.total)}
                  </span>
                </div>

                {/* Pago — solo si no está cancelado */}
                {!isCancelled && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    {order.payment_status === "pagado" ? (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase text-[#2ECC71] flex items-center gap-1.5">
                          <CheckCircle2 size={13} /> Pagado (
                          {order.payment_method})
                        </span>
                        <button
                          onClick={() => unmarkPaid(order)}
                          className="text-[10px] text-gray-500 hover:text-[#FF8A00] underline"
                        >
                          Revertir
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-gray-500 mb-1.5">
                          Marcar pagado y pasar a caja:
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {PAYMENT_METHODS.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => markPaid(order, m.id)}
                              className="text-[11px] font-bold uppercase py-2 rounded-lg bg-white/5 hover:bg-[#FF00C8]/20 hover:text-[#FF00C8] transition-colors"
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de cancelación */}
      {cancellingOrder && (
        <CancelOrderModal
          order={cancellingOrder}
          onConfirm={(reason) => cancelOrder(cancellingOrder, reason)}
          onClose={() => setCancellingOrder(null)}
        />
      )}
    </div>
  );
}
