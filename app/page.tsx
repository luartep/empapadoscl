"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ShoppingCart,
  Plus,
  Minus,
  User,
  MapPin,
  X,
  Bike,
  Store,
  ChevronRight,
  Flame,
  Check,
} from "lucide-react";

/* ============================================================================
   EMPAPADOS — MENÚ DIGITAL
   Datos extraídos y codificados manualmente desde la carta física (imagen)
   provista por el cliente. 5 categorías de productos / 17 productos base,
   con grupos de modificadores (proteínas, salsas, toques frescos, sazón)
   incluidos sin costo según cantidad fija por producto, más adicionales y
   proteína premium con costo extra. Precios en CLP (enteros, sin decimales).
   ============================================================================ */

/* --------------------------- Tipos --------------------------- */

type ModifierOption = {
  id: string;
  name: string;
  /** Costo extra de esta opción. 0 si está incluida sin costo. */
  price: number;
};

type ModifierGroup = {
  id: string;
  /** Título mostrado en el modal, ej. "Elige tus Proteínas" */
  label: string;
  /** Cantidad incluida sin costo. Si el cliente elige menos, igual puede continuar (mínimo 1). Si elige más, cada unidad extra se cobra a extraUnitPrice. */
  required: number;
  options: ModifierOption[];
  /** Precio por cada unidad seleccionada por encima de `required`. Por defecto $1.000 si el grupo tiene required > 0. */
  extraUnitPrice?: number;
};

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  /** Grupos de selección incluidos sin costo (proteínas, salsas, etc.) */
  modifierGroups?: ModifierGroup[];
  /** Si true, el producto permite agregar adicionales con costo extra. */
  allowsExtras?: boolean;
  /** Ruta de la imagen del producto. Si no se especifica, se usa el placeholder. */
  image?: string;
  /** Si true, este producto solo puede retirarse/entregarse en la sucursal Salvador Allende. */
  restrictedToSalvadorAllende?: boolean;
};

type Category = {
  id: string;
  label: string;
};

/* --------------------------- Catálogos de opciones --------------------------- */
/* Compartidos entre productos para no repetir listas largas */

const PROTEINAS: ModifierOption[] = [
  { id: "carne-mechada", name: "Carne Mechada", price: 0 },
  { id: "pollo-mechado", name: "Pollo Mechado", price: 0 },
  { id: "salchicha", name: "Salchicha", price: 0 },
  { id: "carne-soya", name: "Carne de Soya", price: 0 },
];

const SALSAS: ModifierOption[] = [
  { id: "salsa-empapados", name: "Salsa Empapados", price: 0 },
  { id: "aceituna-salsa", name: "Aceituna", price: 0 },
  { id: "ajo", name: "Ajo", price: 0 },
  { id: "salsa-verde", name: "Salsa Verde", price: 0 },
  { id: "albahaca", name: "Albahaca", price: 0 },
  { id: "bbq", name: "BBQ", price: 0 },
  { id: "tartara", name: "Tártara", price: 0 },
  { id: "cheddar-salsa", name: "Cheddar", price: 0 },
  { id: "queso-salsa", name: "Queso", price: 0 },
  { id: "champinon-salsa", name: "Champiñón", price: 0 },
  { id: "chile-picante", name: "Chile Picante", price: 0 },
];

const TOQUES_FRESCOS: ModifierOption[] = [
  { id: "aceituna-toque", name: "Aceituna", price: 0 },
  { id: "choclo", name: "Choclo", price: 0 },
  { id: "champinon-toque", name: "Champiñón", price: 0 },
  { id: "morron", name: "Morrón", price: 0 },
  { id: "cebolla-caramelizada", name: "Cebolla Caramelizada", price: 0 },
  { id: "tomate-cherry", name: "Tomate Cherry", price: 0 },
  { id: "aji-verde", name: "Ají Verde", price: 0 },
  { id: "pepinillo", name: "Pepinillo", price: 0 },
];

const SAZON: ModifierOption[] = [
  { id: "cebollin", name: "Cebollín", price: 0 },
  { id: "merken", name: "Merkén", price: 0 },
  { id: "oregano", name: "Orégano", price: 0 },
  { id: "pimienta", name: "Pimienta", price: 0 },
];

const NUGGETS_O_SALCHICHA: ModifierOption[] = [
  { id: "nuggets-kids", name: "Nuggets", price: 0 },
  { id: "salchicha-kids", name: "Salchicha", price: 0 },
];

/** Adicionales con costo — disponibles para agregar en cualquier producto que lo permita */
const ADICIONALES: ModifierOption[] = [
  { id: "aros-cebolla", name: "Aros de Cebolla (3 un)", price: 990 },
  { id: "dedos-queso", name: "Dedos de Queso (3 un)", price: 1990 },
  { id: "nuggets-extra", name: "Nuggets (5 un)", price: 1990 },
  { id: "palta-extra", name: "Palta", price: 1000 },
  { id: "salsa-extra", name: "Salsa Extra", price: 1000 },
  { id: "toques-extra", name: "Toques Frescos Extra", price: 1000 },
  { id: "vegana-dia", name: "Vegana del Día", price: 1490 },
];

/** Proteína Premium — con costo extra */
const PROTEINA_PREMIUM: ModifierOption[] = [
  { id: "tocino-premium", name: "Tocino", price: 1990 },
  { id: "bocados-carne", name: "Bocados de Carne (1 un)", price: 690 },
  { id: "chorizo", name: "Chorizo (100 gr app)", price: 1990 },
];

/* Helper para armar grupos de modificadores repetidos sin reescribir */
const group = (
  id: string,
  label: string,
  required: number,
  options: ModifierOption[]
): ModifierGroup => ({ id, label, required, options });

const adicionalesGroup = (idSuffix: string): ModifierGroup =>
  group(`adicionales-${idSuffix}`, "Adicionales (costo extra)", 0, ADICIONALES);

const premiumGroup = (idSuffix: string): ModifierGroup =>
  group(`premium-${idSuffix}`, "Proteína Premium (costo extra)", 0, PROTEINA_PREMIUM);

/* --------------------------- Categorías --------------------------- */

/**
 * Datos de respaldo (fallback): se usan únicamente si la base de datos no
 * está configurada todavía o falla la conexión, para que el menú nunca se
 * quede en blanco. Cuando DATABASE_URL esté conectada en Vercel, el menú
 * real se carga desde /api/products (panel de administración).
 */
const fallbackCategories: Category[] = [
  { id: "escoge-tu-box", label: "Escoge tu Box" },
  { id: "box-cheddar", label: "Box Cheddar" },
  { id: "conos", label: "Conos" },
  { id: "box-burger", label: "Box Burger" },
  { id: "sandwich", label: "Sandwich" },
  { id: "completos", label: "Completos" },
  { id: "papas-solas", label: "Papas Solas" },
  { id: "bebestibles", label: "Bebestibles" },
];

/* --------------------------- Datos del menú --------------------------- */

const fallbackMenuData: MenuItem[] = [
  /* ---------- Escoge tu Box ---------- */
  {
    id: "box-duo",
    name: "Box Duo",
    description: "Papas + 2 proteínas + 2 salsas + 2 toques frescos + 1 sazón",
    price: 10990,
    category: "escoge-tu-box",
    allowsExtras: true,
    image: "/images/box-aros-cebolla.jpg",
    modifierGroups: [
      group("proteinas", "Elige 2 Proteínas", 2, PROTEINAS),
      group("salsas", "Elige 2 Salsas", 2, SALSAS),
      group("toques", "Elige 2 Toques Frescos", 2, TOQUES_FRESCOS),
      group("sazon", "Elige 1 Sazón", 1, SAZON),
      premiumGroup("box-duo"),
      adicionalesGroup("box-duo"),
    ],
  },
  {
    id: "box-family",
    name: "Box Family",
    description: "Papas + 2 proteínas + 3 salsas + 3 toques frescos + 2 sazón",
    price: 16490,
    category: "escoge-tu-box",
    allowsExtras: true,
    image: "/images/box-grande.jpg",
    modifierGroups: [
      group("proteinas", "Elige 2 Proteínas", 2, PROTEINAS),
      group("salsas", "Elige 3 Salsas", 3, SALSAS),
      group("toques", "Elige 3 Toques Frescos", 3, TOQUES_FRESCOS),
      group("sazon", "Elige 2 Sazón", 2, SAZON),
      premiumGroup("box-family"),
      adicionalesGroup("box-family"),
    ],
  },
  {
    id: "box-fiesta",
    name: "Box Fiesta",
    description: "Papas + 3 proteínas + 4 salsas + 4 toques frescos + 2 sazón",
    price: 19990,
    category: "escoge-tu-box",
    allowsExtras: true,
    image: "/images/box-grande-b.jpg",
    modifierGroups: [
      group("proteinas", "Elige 3 Proteínas", 3, PROTEINAS),
      group("salsas", "Elige 4 Salsas", 4, SALSAS),
      group("toques", "Elige 4 Toques Frescos", 4, TOQUES_FRESCOS),
      group("sazon", "Elige 2 Sazón", 2, SAZON),
      premiumGroup("box-fiesta"),
      adicionalesGroup("box-fiesta"),
    ],
  },
  {
    id: "box-ninos",
    name: "Box Niños",
    description: "Papas + Nuggets o Salchicha + 1 salsa",
    price: 7990,
    category: "escoge-tu-box",
    allowsExtras: true,
    image: "/images/box-aros-cebolla.jpg",
    modifierGroups: [
      group("nuggets-salchicha", "Elige 1: Nuggets o Salchicha", 1, NUGGETS_O_SALCHICHA),
      group("salsas", "Elige 1 Salsa", 1, SALSAS),
      adicionalesGroup("box-ninos"),
    ],
  },

  /* ---------- Box Cheddar ---------- */
  {
    id: "box-cheddar-duo",
    name: "Box Cheddar Duo",
    description: "Papas + salsa cheddar premium + tocino + 1 sazón",
    price: 9990,
    category: "box-cheddar",
    allowsExtras: true,
    image: "/images/box-cheddar-duo.jpg",
    modifierGroups: [
      group("sazon", "Elige 1 Sazón", 1, SAZON),
      adicionalesGroup("box-cheddar-duo"),
    ],
  },
  {
    id: "box-cheddar-family",
    name: "Box Cheddar Family",
    description: "Papas + salsa cheddar premium + tocino + 2 sazón",
    price: 14990,
    category: "box-cheddar",
    allowsExtras: true,
    image: "/images/box-cheddar-tocino.jpg",
    modifierGroups: [
      group("sazon", "Elige 2 Sazón", 2, SAZON),
      adicionalesGroup("box-cheddar-family"),
    ],
  },
  {
    id: "box-cheddar-fiesta",
    name: "Box Cheddar Fiesta",
    description: "Papas + salsa cheddar premium + tocino + 2 sazón",
    price: 17990,
    category: "box-cheddar",
    allowsExtras: true,
    image: "/images/box-cheddar-tocino.jpg",
    modifierGroups: [
      group("sazon", "Elige 2 Sazón", 2, SAZON),
      adicionalesGroup("box-cheddar-fiesta"),
    ],
  },

  /* ---------- Conos ---------- */
  {
    id: "cono-s",
    name: "Cono S",
    description: "Papas + 2 salsas + 1 sazón",
    price: 1990,
    category: "conos",
    allowsExtras: true,
    image: "/images/box-aros-cebolla.jpg",
    modifierGroups: [
      group("salsas", "Elige 2 Salsas", 2, SALSAS),
      group("sazon", "Elige 1 Sazón", 1, SAZON),
      adicionalesGroup("cono-s"),
    ],
  },
  {
    id: "cono-m",
    name: "Cono M",
    description: "Papas + 2 salsas + 1 proteína + 1 toque fresco + 1 sazón",
    price: 3990,
    category: "conos",
    allowsExtras: true,
    image: "/images/cono-palta.jpg",
    modifierGroups: [
      group("proteinas", "Elige 1 Proteína", 1, PROTEINAS),
      group("salsas", "Elige 2 Salsas", 2, SALSAS),
      group("toques", "Elige 1 Toque Fresco", 1, TOQUES_FRESCOS),
      group("sazon", "Elige 1 Sazón", 1, SAZON),
      premiumGroup("cono-m"),
      adicionalesGroup("cono-m"),
    ],
  },
  {
    id: "cono-xl",
    name: "Cono XL",
    description: "Papas + 2 salsas + 1 proteína + 2 toques frescos + 1 sazón",
    price: 6990,
    category: "conos",
    allowsExtras: true,
    image: "/images/cono-mixto.jpg",
    modifierGroups: [
      group("proteinas", "Elige 1 Proteína", 1, PROTEINAS),
      group("salsas", "Elige 2 Salsas", 2, SALSAS),
      group("toques", "Elige 2 Toques Frescos", 2, TOQUES_FRESCOS),
      group("sazon", "Elige 1 Sazón", 1, SAZON),
      premiumGroup("cono-xl"),
      adicionalesGroup("cono-xl"),
    ],
  },

  /* ---------- Box Burger ---------- */
  {
    id: "box-burger-duo",
    name: "Box Burger Duo",
    description: "2 cheese burger + papas + 1 salsa",
    price: 10990,
    category: "box-burger",
    allowsExtras: true,
    image: "/images/box-burger-duo-a.jpg",
    modifierGroups: [
      group("salsas", "Elige 1 Salsa", 1, SALSAS),
      adicionalesGroup("box-burger-duo"),
    ],
  },
  {
    id: "box-burger-family",
    name: "Box Burger Family",
    description: "4 cheese burger + papas + 1 salsa",
    price: 15990,
    category: "box-burger",
    allowsExtras: true,
    image: "/images/box-burger-duo-b.jpg",
    modifierGroups: [
      group("salsas", "Elige 1 Salsa", 1, SALSAS),
      adicionalesGroup("box-burger-family"),
    ],
  },
  {
    id: "box-burger-fiesta",
    name: "Box Burger Fiesta",
    description: "6 cheese burger + papas + 2 salsas",
    price: 22990,
    category: "box-burger",
    allowsExtras: true,
    image: "/images/box-burger-duo-b.jpg",
    modifierGroups: [
      group("salsas", "Elige 2 Salsas", 2, SALSAS),
      adicionalesGroup("box-burger-fiesta"),
    ],
  },

  /* ---------- Sandwich (solo retiro/entrega en Salvador Allende) ---------- */
  {
    id: "sandwich-italiano",
    name: "Sandwich Italiano",
    description: "Palta, tomate, mayo + 1 salsa",
    price: 7490,
    category: "sandwich",
    allowsExtras: true,
    restrictedToSalvadorAllende: true,
    image: "/images/sandwich-italiano.jpg",
    modifierGroups: [
      group("salsas", "Elige 1 Salsa", 1, SALSAS),
      adicionalesGroup("sandwich-italiano"),
    ],
  },
  {
    id: "sandwich-aleman",
    name: "Sandwich Alemán",
    description: "Tomate, chucrut, pepinillo, mayo + 1 salsa",
    price: 7490,
    category: "sandwich",
    allowsExtras: true,
    restrictedToSalvadorAllende: true,
    image: "/images/sandwich-aleman.jpg",
    modifierGroups: [
      group("salsas", "Elige 1 Salsa", 1, SALSAS),
      adicionalesGroup("sandwich-aleman"),
    ],
  },
  {
    id: "sandwich-americano",
    name: "Sandwich Americano a lo Pobre",
    description: "Cebolla caramelizada, queso, huevo, salsa bbq",
    price: 8490,
    category: "sandwich",
    allowsExtras: true,
    restrictedToSalvadorAllende: true,
    image: "/images/sandwich-luco.jpg",
    modifierGroups: [adicionalesGroup("sandwich-americano")],
  },
  {
    id: "sandwich-chacarero",
    name: "Sandwich Chacarero",
    description: "Poroto verde, ají verde, tomate, mayo + 1 salsa",
    price: 7490,
    category: "sandwich",
    allowsExtras: true,
    restrictedToSalvadorAllende: true,
    image: "/images/sandwich-chacarero.jpg",
    modifierGroups: [
      group("salsas", "Elige 1 Salsa", 1, SALSAS),
      adicionalesGroup("sandwich-chacarero"),
    ],
  },
  {
    id: "sandwich-empapado",
    name: "Sandwich Empapado",
    description: "Champiñón, palta, tocino, queso, mayo + 1 salsa",
    price: 8490,
    category: "sandwich",
    allowsExtras: true,
    restrictedToSalvadorAllende: true,
    image: "/images/sandwich-empapado.jpg",
    modifierGroups: [
      group("salsas", "Elige 1 Salsa", 1, SALSAS),
      adicionalesGroup("sandwich-empapado"),
    ],
  },
  {
    id: "sandwich-luco",
    name: "Sandwich Luco Especial",
    description: "Queso, palta + 1 salsa",
    price: 6990,
    category: "sandwich",
    allowsExtras: true,
    restrictedToSalvadorAllende: true,
    image: "/images/sandwich-luco.jpg",
    modifierGroups: [
      group("salsas", "Elige 1 Salsa", 1, SALSAS),
      adicionalesGroup("sandwich-luco"),
    ],
  },

  /* ---------- Completos (solo retiro/entrega en Salvador Allende) ---------- */
  {
    id: "completo-aleman",
    name: "Completo Alemán",
    description: "Tomate, chucrut, pepinillo, mayo + 1 salsa",
    price: 2990,
    category: "completos",
    allowsExtras: true,
    restrictedToSalvadorAllende: true,
    image: "/images/completo-americano.jpg",
    modifierGroups: [
      group("salsas", "Elige 1 Salsa", 1, SALSAS),
      adicionalesGroup("completo-aleman"),
    ],
  },
  {
    id: "completo-americano",
    name: "Completo Americano",
    description: "Cebolla caramelizada, queso, salsa bbq",
    price: 3490,
    category: "completos",
    allowsExtras: true,
    restrictedToSalvadorAllende: true,
    image: "/images/completo-americano.jpg",
    modifierGroups: [adicionalesGroup("completo-americano")],
  },
  {
    id: "completo-empapado",
    name: "Completo Empapado",
    description: "Champiñón, palta, tocino, queso, mayo + 1 salsa",
    price: 3490,
    category: "completos",
    allowsExtras: true,
    restrictedToSalvadorAllende: true,
    image: "/images/completo-americano.jpg",
    modifierGroups: [
      group("salsas", "Elige 1 Salsa", 1, SALSAS),
      adicionalesGroup("completo-empapado"),
    ],
  },
  {
    id: "completo-italiano",
    name: "Completo Italiano",
    description: "Palta, tomate, mayo + 1 salsa",
    price: 2990,
    category: "completos",
    allowsExtras: true,
    restrictedToSalvadorAllende: true,
    image: "/images/completo-americano.jpg",
    modifierGroups: [
      group("salsas", "Elige 1 Salsa", 1, SALSAS),
      adicionalesGroup("completo-italiano"),
    ],
  },
  {
    id: "completo-luco",
    name: "Completo Luco Especial",
    description: "Queso, palta + 1 salsa",
    price: 2990,
    category: "completos",
    allowsExtras: true,
    restrictedToSalvadorAllende: true,
    image: "/images/completo-americano.jpg",
    modifierGroups: [
      group("salsas", "Elige 1 Salsa", 1, SALSAS),
      adicionalesGroup("completo-luco"),
    ],
  },

  /* ---------- Papas Solas (sin modificadores: producto simple) ---------- */
  {
    id: "papas-solas-duo",
    name: "Papas Solas Duo",
    description: "Solo papas, formato duo",
    price: 6990,
    category: "papas-solas",
    image: "/images/box-grande.jpg",
  },
  {
    id: "papas-solas-family",
    name: "Papas Solas Family",
    description: "Solo papas, formato family",
    price: 10990,
    category: "papas-solas",
    image: "/images/box-grande-b.jpg",
  },
  {
    id: "papas-solas-cono2",
    name: "Papas Solas Cono 2",
    description: "Solo papas, cono pequeño",
    price: 1490,
    category: "papas-solas",
    image: "/images/cono-mixto.jpg",
  },
  {
    id: "papas-solas-conom",
    name: "Papas Solas Cono M",
    description: "Solo papas, cono mediano",
    price: 1990,
    category: "papas-solas",
    image: "/images/cono-palta.jpg",
  },
  {
    id: "papas-solas-conoxl",
    name: "Papas Solas Cono XL",
    description: "Solo papas, cono extra grande",
    price: 3990,
    category: "papas-solas",
    image: "/images/box-aros-cebolla.jpg",
  },

  /* ---------- Bebestibles (sin modificadores) ---------- */
  {
    id: "bebida-lata",
    name: "Bebida Lata 220cc",
    description: "Coca-Cola · Fanta · Sprite",
    price: 1500,
    category: "bebestibles",
  },
  {
    id: "bebida-1.5",
    name: "Bebida 1,5 Lt.",
    description: "Coca-Cola · Fanta · Sprite",
    price: 2500,
    category: "bebestibles",
  },
  {
    id: "jugo-1.5",
    name: "Jugo 1,5 Lt.",
    description: "Jugo natural",
    price: 2500,
    category: "bebestibles",
  },
];

/* --------------------------- Carrito --------------------------- */

/** Una línea del carrito: el producto base + las selecciones hechas en el modal */
type SelectedModifier = {
  groupId: string;
  groupLabel: string;
  optionId: string;
  optionName: string;
  price: number;
};

type CartLine = {
  /** Identificador único de la línea (producto + combinación de modificadores) */
  lineId: string;
  item: MenuItem;
  selections: SelectedModifier[];
  qty: number;
  /** Precio unitario ya incluyendo el extra de los modificadores con costo */
  unitPrice: number;
  /** Nota opcional del cliente para este producto (ej. "sin cebolla, por favor") */
  note?: string;
};

const WHATSAPP_NUMBER = "56948140092";

const formatCLP = (value: number) =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value);

/* ============================================================================
   COMPONENTE PRINCIPAL
   ============================================================================ */

export default function EmpapadosMenuPage() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  // Evita pedidos duplicados si el cliente toca el botón más de una vez
  // (ej. doble-tap en el celular mientras espera que abra WhatsApp).
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderType, setOrderType] = useState<"delivery" | "retiro">("retiro");
  const [pickupLocation, setPickupLocation] = useState<
    "lagunillas" | "salvador-allende"
  >("lagunillas");
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");

  // Menú dinámico: se carga desde /api/products (base de datos). Si la
  // base de datos no está conectada todavía o falla la carga, se usa el
  // menú de respaldo hardcodeado para que el sitio nunca quede vacío.
  const [categories, setCategories] = useState<Category[]>(fallbackCategories);
  const [menuData, setMenuData] = useState<MenuItem[]>(fallbackMenuData);
  const [menuLoaded, setMenuLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (data?.categories?.length && data?.menuData?.length) {
          setCategories(data.categories);
          setMenuData(data.menuData);
        }
      })
      .catch(() => {
        // Sin conexión a la base de datos todavía: se mantiene el fallback.
      })
      .finally(() => setMenuLoaded(true));
  }, []);

  const [activeCategory, setActiveCategory] = useState<string>(
    fallbackCategories[0].id
  );

  // Producto actualmente abierto en el modal de personalización (null = cerrado)
  const [activeProduct, setActiveProduct] = useState<MenuItem | null>(null);
  // Selecciones en progreso dentro del modal: groupId -> array de optionIds elegidos
  const [draftSelections, setDraftSelections] = useState<Record<string, string[]>>({});
  // Nota en progreso dentro del modal (ej. "sin cebolla, por favor")
  const [draftNote, setDraftNote] = useState("");

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const navRef = useRef<HTMLDivElement | null>(null);

  const totalItems = useMemo(
    () => cart.reduce((sum, l) => sum + l.qty, 0),
    [cart]
  );
  const totalPrice = useMemo(
    () => cart.reduce((sum, l) => sum + l.qty * l.unitPrice, 0),
    [cart]
  );

  /** true si el carrito contiene algún producto restringido (Sandwich o Completos) */
  const cartRequiresSalvadorAllende = useMemo(
    () => cart.some((l) => l.item.restrictedToSalvadorAllende),
    [cart]
  );

  // Si el carrito pasa a requerir Salvador Allende, forzamos esa sucursal automáticamente
  useEffect(() => {
    if (cartRequiresSalvadorAllende && pickupLocation !== "salvador-allende") {
      setPickupLocation("salvador-allende");
    }
  }, [cartRequiresSalvadorAllende, pickupLocation]);

  const itemsByCategory = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};
    categories.forEach((c) => (map[c.id] = []));
    menuData.forEach((item) => {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    });
    return map;
  }, [categories, menuData]);

  /* --------------------------- Helpers del modal --------------------------- */

  const openProductModal = (item: MenuItem) => {
    // Si no tiene grupos de modificadores, se agrega directo sin abrir modal
    if (!item.modifierGroups || item.modifierGroups.length === 0) {
      addSimpleToCart(item);
      return;
    }
    const initial: Record<string, string[]> = {};
    item.modifierGroups.forEach((g) => (initial[g.id] = []));
    setDraftSelections(initial);
    setDraftNote("");
    setActiveProduct(item);
  };

  const closeProductModal = () => {
    setActiveProduct(null);
    setDraftSelections({});
    setDraftNote("");
  };

  const toggleOption = (g: ModifierGroup, optionId: string) => {
    setDraftSelections((prev) => {
      const current = prev[g.id] || [];
      const isSelected = current.includes(optionId);

      if (isSelected) {
        return { ...prev, [g.id]: current.filter((id) => id !== optionId) };
      }

      // Ya no hay tope duro: el cliente puede elegir más de lo incluido.
      // Las unidades por encima de g.required se cobran aparte (ver draftExtraCost).
      return { ...prev, [g.id]: [...current, optionId] };
    });
  };

  /** Precio por unidad extra de un grupo (por encima de lo incluido). Default $1.000. */
  const EXTRA_UNIT_PRICE = 1000;

  const isGroupComplete = (g: ModifierGroup) => {
    if (g.required === 0) return true; // grupos de extras/adicionales no son obligatorios
    // Ya no exige el tope exacto: basta con haber elegido al menos 1.
    return (draftSelections[g.id]?.length || 0) >= 1;
  };

  const allRequiredGroupsComplete = useMemo(() => {
    if (!activeProduct?.modifierGroups) return true;
    return activeProduct.modifierGroups.every(isGroupComplete);
  }, [activeProduct, draftSelections]);

  const draftExtraCost = useMemo(() => {
    if (!activeProduct?.modifierGroups) return 0;
    let extra = 0;
    activeProduct.modifierGroups.forEach((g) => {
      const chosen = draftSelections[g.id] || [];
      chosen.forEach((optId) => {
        const opt = g.options.find((o) => o.id === optId);
        if (opt) extra += opt.price;
      });
      // Si el grupo tiene un tope incluido (required > 0) y el cliente eligió más
      // de esa cantidad, cada unidad por encima se cobra aparte.
      if (g.required > 0 && chosen.length > g.required) {
        const exceso = chosen.length - g.required;
        extra += exceso * (g.extraUnitPrice ?? EXTRA_UNIT_PRICE);
      }
    });
    return extra;
  }, [activeProduct, draftSelections]);

  /* --------------------------- Carrito: agregar / modificar --------------------------- */

  const addSimpleToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.lineId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.lineId === item.id ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [
        ...prev,
        { lineId: item.id, item, selections: [], qty: 1, unitPrice: item.price },
      ];
    });
  };

  const confirmAddFromModal = () => {
    if (!activeProduct || !allRequiredGroupsComplete) return;

    const selections: SelectedModifier[] = [];
    activeProduct.modifierGroups?.forEach((g) => {
      const chosen = draftSelections[g.id] || [];
      const extraPrice = g.extraUnitPrice ?? EXTRA_UNIT_PRICE;
      chosen.forEach((optId, index) => {
        const opt = g.options.find((o) => o.id === optId);
        if (opt) {
          const isExcessUnit = g.required > 0 && index >= g.required;
          selections.push({
            groupId: g.id,
            groupLabel: g.label,
            optionId: opt.id,
            optionName: opt.name,
            price: isExcessUnit ? extraPrice : opt.price,
          });
        }
      });
    });

    const unitPrice = activeProduct.price + draftExtraCost;
    // lineId único por combinación, para no mezclar pedidos distintos del mismo producto
    const lineId = `${activeProduct.id}__${selections
      .map((s) => s.optionId)
      .sort()
      .join("-")}`;

    setCart((prev) => {
      const existing = prev.find((l) => l.lineId === lineId);
      if (existing) {
        return prev.map((l) =>
          l.lineId === lineId
            ? { ...l, qty: l.qty + 1, note: draftNote.trim() || l.note }
            : l
        );
      }
      return [
        ...prev,
        {
          lineId,
          item: activeProduct,
          selections,
          qty: 1,
          unitPrice,
          note: draftNote.trim() || undefined,
        },
      ];
    });

    closeProductModal();
  };

  const incrementLine = (lineId: string) => {
    setCart((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, qty: l.qty + 1 } : l))
    );
  };

  const decrementLine = (lineId: string) => {
    setCart((prev) => {
      const line = prev.find((l) => l.lineId === lineId);
      if (!line) return prev;
      if (line.qty <= 1) {
        return prev.filter((l) => l.lineId !== lineId);
      }
      return prev.map((l) =>
        l.lineId === lineId ? { ...l, qty: l.qty - 1 } : l
      );
    });
  };

  const updateLineNote = (lineId: string, note: string) => {
    setCart((prev) =>
      prev.map((l) =>
        l.lineId === lineId ? { ...l, note: note || undefined } : l
      )
    );
  };

  /* --------------------------- Navegación --------------------------- */

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    const el = sectionRefs.current[catId];
    if (el) {
      const navHeight = (navRef.current?.offsetHeight ?? 0) + 64;
      const top = el.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  /* --------------------------- WhatsApp --------------------------- */

  const canSubmit =
    customerName.trim().length > 0 &&
    (orderType === "retiro" || address.trim().length > 0) &&
    totalItems > 0;

  const buildWhatsAppLink = () => {
    const lines: string[] = [];
    lines.push("¡Hola Empapados! 🍔 Quiero hacer un pedido:");
    lines.push(`👤 Nombre: ${customerName.trim()}`);
    lines.push(
      `📍 Modalidad: ${orderType === "delivery" ? "Delivery" : "Retiro en Local"}`
    );
    if (orderType === "delivery") {
      lines.push(`🏠 Dirección: ${address.trim()}`);
      if (cartRequiresSalvadorAllende) {
        lines.push(`🏪 Despacho desde: Salvador Allende`);
      }
    } else {
      const sucursal =
        pickupLocation === "salvador-allende"
          ? "Salvador Allende"
          : "Lagunillas";
      lines.push(`🏪 Sucursal de retiro: ${sucursal}`);
    }
    lines.push("--- PEDIDO ---");
    cart.forEach((line) => {
      const subtotal = line.qty * line.unitPrice;
      lines.push(`${line.qty}x ${line.item.name} - $${formatCLP(subtotal)}`);

      // Agrupar las selecciones por grupo (Proteínas, Salsas, Toques Frescos, etc.)
      // para que no se mezclen en una sola lista confusa.
      const groupOrder: string[] = [];
      const byGroup: Record<string, SelectedModifier[]> = {};
      line.selections.forEach((sel) => {
        if (!byGroup[sel.groupLabel]) {
          byGroup[sel.groupLabel] = [];
          groupOrder.push(sel.groupLabel);
        }
        byGroup[sel.groupLabel].push(sel);
      });

      groupOrder.forEach((label) => {
        lines.push(`   ${label}:`);
        byGroup[label].forEach((sel) => {
          const tag = sel.price > 0 ? ` (+$${formatCLP(sel.price)})` : "";
          lines.push(`     • ${sel.optionName}${tag}`);
        });
      });

      if (line.note) {
        lines.push(`   📝 Nota: ${line.note}`);
      }
    });
    lines.push("---");
    lines.push(`💰 TOTAL: $${formatCLP(totalPrice)}`);

    const message = lines.join("\n");
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  };

  const handleSendOrder = () => {
    if (!canSubmit || isSubmittingOrder) return;
    setIsSubmittingOrder(true);

    // CRÍTICO para que funcione en navegadores móviles (Safari/Chrome en
    // celular): window.open debe llamarse de forma SÍNCRONA, en la misma
    // tarea del click, o el navegador lo bloquea como "popup no solicitado"
    // porque ya no lo reconoce como gesto directo del usuario. Por eso
    // abrimos la pestaña primero, ANTES de cualquier await/fetch.
    const url = buildWhatsAppLink();
    window.open(url, "_blank");

    // El guardado en el panel se hace en paralelo, sin bloquear ni
    // retrasar la apertura de WhatsApp. Si falla (ej. base de datos no
    // conectada todavía), el cliente ya envió su pedido igual.
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: customerName.trim(),
        orderType,
        address: orderType === "delivery" ? address.trim() : null,
        pickupLocation: orderType === "retiro" ? pickupLocation : null,
        items: cart,
        total: totalPrice,
      }),
    }).catch(() => {
      // Silencioso a propósito.
    });

    // Reabilita el botón después de un momento, por si el cliente necesita
    // reabrir WhatsApp manualmente (ej. cerró la pestaña sin querer).
    setTimeout(() => setIsSubmittingOrder(false), 4000);
  };

  /* ============================================================================
     RENDER
     ============================================================================ */

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans pb-28">
      {/* ============================ NAVBAR ============================ */}
      <header className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5">
        <div className="relative flex items-center justify-center h-16 px-4">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2"
          >
            <img
              src="/images/logo.png"
              alt="Empapados"
              className="h-9 w-auto object-contain"
            />
          </button>
          <button
            onClick={() => setIsCartOpen(true)}
            aria-label="Ver carrito"
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/5 active:bg-white/10 transition-colors"
          >
            <ShoppingCart size={22} strokeWidth={2.25} />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#FF00C8] text-[11px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(255,0,200,0.7)]">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden px-6 pt-12 pb-10">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(255,0,200,0.25), transparent 45%), radial-gradient(circle at 85% 0%, rgba(255,234,0,0.15), transparent 40%)",
          }}
        />
        <div className="relative z-10 max-w-md mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#FFEA00] bg-[#FFEA00]/10 border border-[#FFEA00]/30 rounded-full px-3 py-1 mb-5">
            <Flame size={12} className="fill-[#FFEA00]" /> Coronel · Bío Bío
          </span>
          <h1 className="font-black text-[2.1rem] leading-[1.05] uppercase italic tracking-tight">
            El verdadero{" "}
            <span className="text-[#FF00C8] drop-shadow-[0_0_18px_rgba(255,0,200,0.55)]">
              sabor
            </span>{" "}
            que te{" "}
            <span className="text-[#FFEA00] drop-shadow-[0_0_18px_rgba(255,234,0,0.45)]">
              empapa.
            </span>
          </h1>
          <p className="mt-4 text-sm text-gray-400 leading-relaxed">
            Armás tu box como quieras: elige proteínas, salsas, toques
            frescos y sazón. Pide acá y te lo mandamos directo por WhatsApp.
          </p>
        </div>
      </section>

      {/* ===================== CATEGORY NAVIGATION ===================== */}
      <div
        ref={navRef}
        className="sticky top-16 z-30 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/5 py-3"
      >
        <div className="flex gap-2 overflow-x-auto px-4 scrollbar-hide [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => scrollToCategory(cat.id)}
                className={`flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-[13px] font-bold uppercase tracking-wide transition-all duration-200 border ${
                  isActive
                    ? "bg-[#FF00C8] text-white border-[#FF00C8] shadow-[0_0_14px_rgba(255,0,200,0.5)]"
                    : "bg-white/5 text-gray-300 border-white/10"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================ MENU GRID ============================ */}
      <main className="px-4 mt-6 max-w-2xl mx-auto">
        {categories.map((cat) => (
          <section
            key={cat.id}
            ref={(el) => {
              sectionRefs.current[cat.id] = el;
            }}
            className="mb-10 scroll-mt-32"
          >
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-black text-lg uppercase italic tracking-wide">
                {cat.label}
              </h2>
              <div className="flex-1 h-px bg-gradient-to-r from-[#FF00C8]/40 to-transparent" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {itemsByCategory[cat.id]?.map((item) => {
                const customizable =
                  item.modifierGroups && item.modifierGroups.length > 0;
                return (
                  <div
                    key={item.id}
                    className="relative bg-[#161616] border border-white/5 rounded-2xl overflow-hidden flex flex-col hover:border-[#FF00C8]/30 transition-colors"
                  >
                    <div className="relative w-full aspect-[16/10] bg-[#1F1F1F] overflow-hidden">
                      <img
                        src={item.image || "/images/placeholder.svg"}
                        alt={item.name}
                        className="w-full h-full object-cover opacity-90"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#161616] via-transparent to-transparent" />
                    </div>

                    <div className="flex flex-col flex-1 p-4">
                      <h3 className="font-extrabold text-[15px] text-white leading-snug uppercase">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-1.5 leading-relaxed flex-1">
                          {item.description}
                        </p>
                      )}
                      {item.restrictedToSalvadorAllende && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#FFEA00] bg-[#FFEA00]/10 border border-[#FFEA00]/25 rounded-full px-2 py-0.5 mt-2 w-fit">
                          <MapPin size={10} /> Solo Salvador Allende
                        </span>
                      )}

                      <div className="flex items-center justify-between mt-4">
                        <span className="font-black text-[#FFEA00] text-base">
                          ${formatCLP(item.price)}
                        </span>
                        <button
                          onClick={() => openProductModal(item)}
                          className="flex items-center gap-1 px-3 py-2 rounded-full bg-[#FF00C8] text-white text-xs font-bold uppercase tracking-wide active:scale-95 transition-all duration-150 shadow-[0_0_10px_rgba(255,0,200,0.35)]"
                        >
                          <Plus size={14} strokeWidth={3} />
                          {customizable ? "Armar" : "Añadir"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <footer className="text-center text-[11px] text-gray-500 pt-4 pb-2 leading-relaxed">
          Empapados · Oscar Lizama 2029, Coronel
          <br />
          Pedidos coordinados por WhatsApp
        </footer>
      </main>

      {/* =================== FLOATING "VER CARRITO" BUTTON =================== */}
      {totalItems > 0 && !isCartOpen && !activeProduct && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-5 left-4 right-4 z-40 max-w-2xl mx-auto bg-[#FF00C8] rounded-2xl px-5 py-4 flex items-center justify-between shadow-[0_4px_30px_rgba(255,0,200,0.55)] active:scale-[0.98] transition-transform"
        >
          <span className="flex items-center gap-2 font-bold text-sm">
            <span className="bg-white text-[#FF00C8] rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">
              {totalItems}
            </span>
            Ver Carrito
          </span>
          <span className="font-black text-base">${formatCLP(totalPrice)}</span>
        </button>
      )}

      {/* ================== PRODUCT CUSTOMIZATION MODAL ================== */}
      {activeProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeProductModal}
          />

          <div className="relative z-10 w-full max-w-2xl bg-[#121212] rounded-t-3xl border-t border-white/10 max-h-[92vh] flex flex-col animate-[slideUp_0.25s_ease-out]">
            <style>{`
              @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            `}</style>

            <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-white/5">
              <div>
                <h2 className="font-black text-lg uppercase italic">
                  {activeProduct.name}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  {activeProduct.description}
                </p>
              </div>
              <button
                onClick={closeProductModal}
                className="p-2 rounded-full bg-white/5 flex-shrink-0"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">
              {activeProduct.modifierGroups?.map((g) => {
                const chosen = draftSelections[g.id] || [];
                const isExtraGroup = g.required === 0;
                const complete = isGroupComplete(g);
                const exceeds = g.required > 0 && chosen.length > g.required;
                const extraPrice = g.extraUnitPrice ?? EXTRA_UNIT_PRICE;

                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-sm font-bold uppercase tracking-wide text-white">
                        {g.label}
                      </p>
                      {!isExtraGroup && (
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            exceeds
                              ? "bg-[#FF8A00]/15 text-[#FF8A00]"
                              : complete
                              ? "bg-[#2ECC71]/15 text-[#2ECC71]"
                              : "bg-[#FFEA00]/15 text-[#FFEA00]"
                          }`}
                        >
                          {chosen.length}/{g.required}
                          {exceeds ? " (+extra)" : ""}
                        </span>
                      )}
                    </div>
                    {!isExtraGroup && (
                      <p className="text-[11px] text-gray-500 mb-2">
                        Incluye {g.required}. Puedes elegir menos (mínimo 1)
                        o más — cada adicional sobre {g.required} cuesta +$
                        {formatCLP(extraPrice)}.
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      {g.options.map((opt) => {
                        const selectionIndex = chosen.indexOf(opt.id);
                        const isSelected = selectionIndex !== -1;
                        // Esta unidad específica cae en zona de costo extra si su posición
                        // de selección (orden en que se eligió) supera el tope incluido.
                        const isExcessUnit =
                          isSelected &&
                          g.required > 0 &&
                          selectionIndex >= g.required;
                        const displayPrice = isExcessUnit
                          ? extraPrice
                          : opt.price;

                        return (
                          <button
                            key={opt.id}
                            onClick={() => toggleOption(g, opt.id)}
                            className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left text-xs font-semibold transition-colors ${
                              isSelected
                                ? isExcessUnit
                                  ? "bg-[#FF8A00]/15 border-[#FF8A00] text-white"
                                  : "bg-[#FF00C8]/15 border-[#FF00C8] text-white"
                                : "bg-[#1A1A1A] border-white/10 text-gray-300"
                            }`}
                          >
                            <span className="flex-1">
                              {opt.name}
                              {displayPrice > 0 && (
                                <span
                                  className={`block text-[11px] font-bold mt-0.5 ${
                                    isExcessUnit
                                      ? "text-[#FF8A00]"
                                      : "text-[#FFEA00]"
                                  }`}
                                >
                                  +${formatCLP(displayPrice)}
                                </span>
                              )}
                            </span>
                            {isSelected && (
                              <Check
                                size={14}
                                strokeWidth={3}
                                className={
                                  isExcessUnit
                                    ? "text-[#FF8A00] flex-shrink-0"
                                    : "text-[#FF00C8] flex-shrink-0"
                                }
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* --- Nota para el local --- */}
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-white mb-2">
                  Nota (opcional)
                </p>
                <textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  placeholder="Ej: sin cebolla, salsa aparte, etc."
                  rows={2}
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#FF00C8] transition-colors resize-none"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-white/5 bg-[#121212] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-300">
                  Precio unitario
                </span>
                <span className="font-black text-lg text-[#FFEA00]">
                  ${formatCLP(activeProduct.price + draftExtraCost)}
                </span>
              </div>
              <button
                onClick={confirmAddFromModal}
                disabled={!allRequiredGroupsComplete}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase tracking-wide text-sm transition-all ${
                  allRequiredGroupsComplete
                    ? "bg-[#FF00C8] text-white shadow-[0_0_24px_rgba(255,0,200,0.6)] active:scale-[0.98]"
                    : "bg-white/10 text-gray-500 cursor-not-allowed"
                }`}
              >
                <Plus size={16} strokeWidth={3} />
                Añadir al Carrito
              </button>
              {!allRequiredGroupsComplete && (
                <p className="text-center text-[11px] text-gray-500">
                  Elige al menos 1 opción en cada grupo para continuar
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================ CART DRAWER ============================ */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsCartOpen(false)}
          />

          {/* drawer */}
          <div className="relative z-10 w-full max-w-2xl bg-[#121212] rounded-t-3xl border-t border-white/10 max-h-[92vh] flex flex-col animate-[slideUp_0.25s_ease-out]">
            <style>{`
              @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            `}</style>

            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/5">
              <h2 className="font-black text-lg uppercase italic">Tu Pedido</h2>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 rounded-full bg-white/5"
                aria-label="Cerrar carrito"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {/* --- Cart lines --- */}
              {cart.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-10">
                  Tu carrito está vacío. ¡Agrega algo rico! 🍟
                </p>
              ) : (
                <div className="space-y-3">
                  {cart.map((line) => (
                    <div
                      key={line.lineId}
                      className="bg-[#1A1A1A] rounded-xl p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm uppercase truncate">
                            {line.item.name}
                          </p>
                          <p className="text-[#FFEA00] text-xs font-bold mt-0.5">
                            ${formatCLP(line.unitPrice * line.qty)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 bg-[#0A0A0A] rounded-full px-2 py-1.5 border border-white/10 flex-shrink-0">
                          <button
                            onClick={() => decrementLine(line.lineId)}
                            className="text-[#FF00C8] active:scale-90 transition-transform"
                            aria-label={`Quitar ${line.item.name}`}
                          >
                            <Minus size={16} strokeWidth={3} />
                          </button>
                          <span className="font-bold text-sm w-4 text-center">
                            {line.qty}
                          </span>
                          <button
                            onClick={() => incrementLine(line.lineId)}
                            className="text-[#FF00C8] active:scale-90 transition-transform"
                            aria-label={`Agregar ${line.item.name}`}
                          >
                            <Plus size={16} strokeWidth={3} />
                          </button>
                        </div>
                      </div>

                      {line.selections.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/5 space-y-1.5">
                          {(() => {
                            const groupOrder: string[] = [];
                            const byGroup: Record<string, SelectedModifier[]> = {};
                            line.selections.forEach((sel) => {
                              if (!byGroup[sel.groupLabel]) {
                                byGroup[sel.groupLabel] = [];
                                groupOrder.push(sel.groupLabel);
                              }
                              byGroup[sel.groupLabel].push(sel);
                            });
                            return groupOrder.map((label) => (
                              <div key={label}>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                  {label}
                                </p>
                                <ul className="space-y-0.5">
                                  {byGroup[label].map((sel, idx) => (
                                    <li
                                      key={`${line.lineId}-${sel.optionId}-${idx}`}
                                      className="text-[11px] text-gray-400 flex items-center justify-between"
                                    >
                                      <span>• {sel.optionName}</span>
                                      {sel.price > 0 && (
                                        <span className="text-gray-500">
                                          +${formatCLP(sel.price)}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ));
                          })()}
                        </div>
                      )}

                      <div className="mt-2 pt-2 border-t border-white/5">
                        <input
                          type="text"
                          value={line.note ?? ""}
                          onChange={(e) =>
                            updateLineNote(line.lineId, e.target.value)
                          }
                          placeholder="Nota para este producto (ej: sin cebolla)"
                          className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-1.5 text-base text-white placeholder:text-gray-600 placeholder:text-[11px] focus:outline-none focus:border-[#FF00C8] transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <>
                  {/* --- Order type --- */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
                      Modalidad
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setOrderType("retiro")}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-colors ${
                          orderType === "retiro"
                            ? "bg-[#FF00C8]/15 border-[#FF00C8] text-white"
                            : "bg-[#1A1A1A] border-white/10 text-gray-400"
                        }`}
                      >
                        <Store size={16} />
                        Retiro en Local
                      </button>
                      <button
                        onClick={() => setOrderType("delivery")}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-colors ${
                          orderType === "delivery"
                            ? "bg-[#FF00C8]/15 border-[#FF00C8] text-white"
                            : "bg-[#1A1A1A] border-white/10 text-gray-400"
                        }`}
                      >
                        <Bike size={16} />
                        Delivery
                      </button>
                    </div>
                  </div>

                  {/* --- Pickup location (solo si Retiro en Local) --- */}
                  {orderType === "retiro" && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
                        Sucursal de Retiro
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() =>
                            !cartRequiresSalvadorAllende &&
                            setPickupLocation("lagunillas")
                          }
                          disabled={cartRequiresSalvadorAllende}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-colors ${
                            pickupLocation === "lagunillas"
                              ? "bg-[#FF00C8]/15 border-[#FF00C8] text-white"
                              : "bg-[#1A1A1A] border-white/10 text-gray-400"
                          } ${
                            cartRequiresSalvadorAllende
                              ? "opacity-40 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          <MapPin size={16} />
                          Lagunillas
                        </button>
                        <button
                          onClick={() => setPickupLocation("salvador-allende")}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-colors ${
                            pickupLocation === "salvador-allende"
                              ? "bg-[#FF00C8]/15 border-[#FF00C8] text-white"
                              : "bg-[#1A1A1A] border-white/10 text-gray-400"
                          }`}
                        >
                          <MapPin size={16} />
                          Salvador Allende
                        </button>
                      </div>
                      {cartRequiresSalvadorAllende && (
                        <p className="text-[11px] text-[#FFEA00] mt-2">
                          Tu pedido incluye Sandwich o Completos: solo
                          disponible para retiro en Salvador Allende.
                        </p>
                      )}
                    </div>
                  )}

                  {/* --- Customer info --- */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5 flex items-center gap-1.5">
                        <User size={13} /> Tu Nombre
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ej: Sebastián"
                        className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#FF00C8] transition-colors"
                      />
                    </div>

                    {orderType === "delivery" && (
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5 flex items-center gap-1.5">
                          <MapPin size={13} /> Dirección de envío
                        </label>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Calle, número, depto/casa, referencia"
                          className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#FF00C8] transition-colors"
                        />
                        {cartRequiresSalvadorAllende && (
                          <p className="text-[11px] text-[#FFEA00] mt-2">
                            Tu pedido incluye Sandwich o Completos: el
                            despacho para estos productos sale solo desde
                            Salvador Allende.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* --- Total --- */}
                  <div className="flex items-center justify-between bg-[#1A1A1A] rounded-xl px-4 py-3.5">
                    <span className="font-bold text-sm text-gray-300">
                      Total a pagar
                    </span>
                    <span className="font-black text-xl text-[#FFEA00]">
                      ${formatCLP(totalPrice)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* --- Footer / CTA --- */}
            {cart.length > 0 && (
              <div className="px-5 py-4 border-t border-white/5 bg-[#121212]">
                <button
                  onClick={handleSendOrder}
                  disabled={!canSubmit || isSubmittingOrder}
                  className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase tracking-wide text-sm transition-all ${
                    canSubmit && !isSubmittingOrder
                      ? "bg-[#FF00C8] text-white shadow-[0_0_30px_rgba(255,0,200,0.7)] active:scale-[0.98]"
                      : "bg-white/10 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {isSubmittingOrder ? "Enviando..." : "Enviar Pedido por WhatsApp"}
                  <ChevronRight size={18} strokeWidth={3} />
                </button>
                {!canSubmit && (
                  <p className="text-center text-[11px] text-gray-500 mt-2">
                    {customerName.trim().length === 0
                      ? "Ingresa tu nombre para continuar"
                      : "Ingresa tu dirección para continuar"}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
