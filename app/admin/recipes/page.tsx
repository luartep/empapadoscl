"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  BookOpen,
  Plus,
  Trash2,
  Loader2,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";

/* ============================================================================
   Tipos
   ============================================================================ */

type Product = {
  id: string;
  name: string;
  category: string;
  active: boolean;
};

type Category = { id: string; label: string };

type RecipeLine = {
  id: number;
  product_id: string;
  item_name: string;
  quantity: string;
};

type InventoryItem = {
  id: number;
  name: string;
  unit: string;
  branch_id: string;
};

/* ============================================================================
   Helpers
   ============================================================================ */

const formatQty = (v: string | number) => {
  const n = Number(v);
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
};

/* ============================================================================
   Componente principal
   ============================================================================ */

export default function RecipesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recipes, setRecipes] = useState<Record<string, RecipeLine[]>>({});
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Carga productos y categorías
  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      if (res.ok) {
        setProducts(
          (data.menuData as Product[]).sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
        setCategories(data.categories ?? []);
      }
    } catch {
      setError("Error al cargar productos.");
    }
  }, []);

  // Carga todos los insumos de inventario (de todas las sucursales para autocompletar)
  const loadInventory = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      if (res.ok) setInventoryItems(data.items ?? []);
    } catch {
      // silencioso
    }
  }, []);

  // Carga todas las recetas
  const loadRecipes = useCallback(async () => {
    try {
      const res = await fetch("/api/recipes");
      const data = await res.json();
      if (res.ok) {
        const map: Record<string, RecipeLine[]> = {};
        for (const r of data.recipes as RecipeLine[]) {
          if (!map[r.product_id]) map[r.product_id] = [];
          map[r.product_id].push(r);
        }
        setRecipes(map);
      }
    } catch {
      setError("Error al cargar recetas.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadProducts(), loadInventory(), loadRecipes()]);
      setLoading(false);
    })();
  }, [loadProducts, loadInventory, loadRecipes]);

  const handleDeleteLine = async (lineId: number, productId: string) => {
    const res = await fetch(`/api/recipes?id=${lineId}`, { method: "DELETE" });
    if (res.ok) {
      setRecipes((prev) => ({
        ...prev,
        [productId]: (prev[productId] ?? []).filter((r) => r.id !== lineId),
      }));
    }
  };

  // Nombres únicos de insumos para el datalist
  const uniqueItemNames = Array.from(
    new Set(inventoryItems.map((i) => i.name))
  ).sort();

  // Agrupar productos por categoría
  const categoryMap: Record<string, Product[]> = {};
  for (const p of products) {
    if (!categoryMap[p.category]) categoryMap[p.category] = [];
    categoryMap[p.category].push(p);
  }
  const categoryLabels: Record<string, string> = {};
  for (const c of categories) categoryLabels[c.id] = c.label;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="sticky top-0 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center justify-between px-6 h-16 max-w-4xl mx-auto">
          <h1 className="font-black text-base uppercase italic flex items-center gap-2">
            <BookOpen size={18} className="text-[#FF00C8]" /> Recetas
          </h1>
          <p className="text-xs text-gray-500">
            Define qué insumos consume cada producto al venderse
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-[#FF8A00]/10 border border-[#FF8A00]/30 rounded-xl p-4 text-sm text-[#FF8A00]">
            {error}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-[#161616] border border-white/5 rounded-xl px-5 py-4 text-sm text-gray-400">
              <p className="flex items-center gap-2">
                <Package size={14} className="text-[#FF00C8]" />
                Al confirmarse un pedido, el sistema buscará el insumo por{" "}
                <strong className="text-white">nombre</strong> en el inventario
                de la sucursal correspondiente y descontará la cantidad
                indicada.
              </p>
            </div>

            {Object.entries(categoryMap).map(([catId, prods]) => (
              <div key={catId}>
                <h2 className="text-xs font-black uppercase text-gray-500 tracking-widest mb-3">
                  {categoryLabels[catId] ?? catId}
                </h2>
                <div className="space-y-2">
                  {prods.map((product) => {
                    const lines = recipes[product.id] ?? [];
                    const isExpanded = expandedProduct === product.id;

                    return (
                      <div
                        key={product.id}
                        className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden"
                      >
                        {/* Header del producto */}
                        <button
                          onClick={() =>
                            setExpandedProduct(
                              isExpanded ? null : product.id
                            )
                          }
                          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-sm">
                              {product.name}
                            </span>
                            {lines.length > 0 && (
                              <span className="text-[10px] font-bold bg-[#FF00C8]/15 text-[#FF00C8] px-2 py-0.5 rounded-full">
                                {lines.length} insumo
                                {lines.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp size={16} className="text-gray-500" />
                          ) : (
                            <ChevronDown size={16} className="text-gray-500" />
                          )}
                        </button>

                        {/* Líneas de receta */}
                        {isExpanded && (
                          <div className="border-t border-white/5 px-5 py-4 space-y-3">
                            {lines.length === 0 ? (
                              <p className="text-xs text-gray-600 italic">
                                Sin receta configurada. Agrega insumos abajo.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {lines.map((line) => (
                                  <div
                                    key={line.id}
                                    className="flex items-center justify-between bg-[#1A1A1A] rounded-lg px-3 py-2"
                                  >
                                    <span className="text-sm">
                                      {line.item_name}
                                    </span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-bold text-[#FFEA00]">
                                        −{formatQty(line.quantity)}
                                      </span>
                                      <button
                                        onClick={() =>
                                          handleDeleteLine(
                                            line.id,
                                            product.id
                                          )
                                        }
                                        className="p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors text-gray-500"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <AddLineForm
                              productId={product.id}
                              itemNames={uniqueItemNames}
                              onAdded={(newLine) => {
                                setRecipes((prev) => ({
                                  ...prev,
                                  [product.id]: [
                                    ...(prev[product.id] ?? []).filter(
                                      (r) => r.id !== newLine.id
                                    ),
                                    newLine,
                                  ],
                                }));
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ============================================================================
   Formulario para agregar una línea de receta
   ============================================================================ */

function AddLineForm({
  productId,
  itemNames,
  onAdded,
}: {
  productId: string;
  itemNames: string[];
  onAdded: (line: RecipeLine) => void;
}) {
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    setError(null);
    if (!itemName.trim()) {
      setError("Escribe el nombre del insumo.");
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      setError("Cantidad inválida.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          itemName: itemName.trim(),
          quantity: Number(quantity),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar.");
      } else {
        onAdded(data.recipe as RecipeLine);
        setItemName("");
        setQuantity("1");
      }
    } catch {
      setError("Error de conexión.");
    }
    setSaving(false);
  };

  const datalistId = `items-${productId}`;

  return (
    <div className="space-y-2 pt-1">
      <datalist id={datalistId}>
        {itemNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="flex gap-2">
        <input
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          list={datalistId}
          placeholder="Nombre del insumo"
          className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF00C8]"
        />
        <input
          type="number"
          min={0.01}
          step={0.01}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-20 bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#FF00C8] text-center"
        />
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#FF00C8]/20 text-[#FF00C8] text-xs font-bold hover:bg-[#FF00C8]/30 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Agregar
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
          {error}
        </p>
      )}
    </div>
  );
}
