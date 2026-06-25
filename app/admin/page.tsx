"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Package,
  ClipboardList,
  Loader2,
} from "lucide-react";

/* ============================================================================
   Tipos (espejo de los usados en el menú público y en las API routes)
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
  order_type: "delivery" | "retiro";
  address: string | null;
  pickup_location: string | null;
  items: {
    item: { name: string };
    qty: number;
    unitPrice: number;
    selections: { optionName: string; price: number; groupLabel: string }[];
    note?: string;
  }[];
  total: number;
  status: "pendiente" | "completado";
  created_at: string;
};

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      modifierGroups: product?.modifierGroups ?? [],
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

          {!isNew && product?.modifierGroups?.length > 0 && (
            <p className="text-[11px] text-gray-500 bg-white/5 rounded-lg px-3 py-2">
              Este producto tiene {product.modifierGroups.length} grupo
              {product.modifierGroups.length !== 1 ? "s" : ""} de
              modificadores (proteínas, salsas, etc.) que se mantienen sin
              cambios al guardar.
            </p>
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
   Tab de Pedidos
   ============================================================================ */

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todos" | "pendiente" | "completado">(
    "pendiente"
  );

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
    // Refresca automáticamente cada 30 segundos para ver pedidos nuevos sin recargar.
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const toggleStatus = async (order: Order) => {
    const newStatus = order.status === "pendiente" ? "completado" : "pendiente";
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: newStatus } : o))
    );
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id, status: newStatus }),
    });
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

  const filtered = orders.filter((o) =>
    filter === "todos" ? true : o.status === filter
  );

  return (
    <div>
      <div className="flex gap-2 mb-5">
        {(["pendiente", "completado", "todos"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition-colors ${
              filter === f
                ? "bg-[#FF00C8] text-white"
                : "bg-white/5 text-gray-400"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">
          No hay pedidos {filter !== "todos" ? `en estado "${filter}"` : ""}.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <div
              key={order.id}
              className="bg-[#161616] border border-white/5 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-bold text-sm">{order.customer_name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(order.created_at).toLocaleString("es-CL")}
                  </p>
                </div>
                <button
                  onClick={() => toggleStatus(order)}
                  className={`text-[11px] font-bold uppercase px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                    order.status === "completado"
                      ? "bg-[#2ECC71]/15 text-[#2ECC71]"
                      : "bg-[#FFEA00]/15 text-[#FFEA00]"
                  }`}
                >
                  {order.status === "completado"
                    ? "✓ Completado"
                    : "Marcar completado"}
                </button>
              </div>

              <p className="text-xs text-gray-400 mb-2">
                {order.order_type === "delivery"
                  ? `Delivery → ${order.address}`
                  : `Retiro en ${
                      order.pickup_location === "salvador-allende"
                        ? "Salvador Allende"
                        : "Lagunillas"
                    }`}
              </p>

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
                <span className="font-black text-[#FFEA00]">
                  ${formatCLP(order.total)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
