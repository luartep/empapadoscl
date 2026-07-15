/**
 * Utilidades de impresión para impresora térmica tipo POS (58mm/80mm).
 *
 * Estrategia: abrimos una ventana nueva con HTML minimalista (ancho fijo
 * en mm, fuente monoespaciada, sin colores de fondo) y llamamos a
 * window.print(). El navegador usa la impresora que el sistema operativo
 * tenga configurada por defecto — si es una impresora térmica POS
 * conectada por USB/red y configurada como predeterminada (o seleccionada
 * en el diálogo de impresión), el resultado sale en el ancho de papel
 * correcto sin necesidad de drivers especiales del lado de la app.
 *
 * No requiere ninguna librería ni plugin: es HTML + CSS @media print.
 */

const RECEIPT_CSS = `
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; font-weight: bold !important; }
  body {
    width: 80mm;
    margin: 0;
    padding: 4mm;
    font-family: 'Courier New', monospace;
    font-size: 48px;
    font-weight: bold;
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .line { border-top: 2px dashed #000; margin: 12px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .title { font-size: 64px; font-weight: bold; }
  .small { font-size: 40px; font-weight: bold; }
  .item-name { font-weight: bold; }
  .item-detail { font-size: 40px; padding-left: 8px; color: #000; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 4px 0; vertical-align: top; font-weight: bold; }
`;

function openPrintWindow(bodyHtml: string, title: string) {
  // Eliminar iframe anterior si existe
  const existing = document.getElementById("__print_frame__");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__print_frame__";
  iframe.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    alert("No se pudo inicializar la impresión. Intenta de nuevo.");
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>${RECEIPT_CSS}</style>
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`);
  doc.close();

  // Esperar a que el iframe cargue antes de imprimir
  const printAndClean = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // fallback: ventana nueva si el iframe falla (ej. Safari estricto)
      const win = window.open("", "_blank", "width=400,height=600");
      if (win) {
        win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>${title}</title><style>${RECEIPT_CSS}</style></head><body>${bodyHtml}<script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);};<\/script></body></html>`);
        win.document.close();
      }
    }
    setTimeout(() => iframe.remove(), 2000);
  };

  if (iframe.contentDocument?.readyState === "complete") {
    printAndClean();
  } else {
    iframe.onload = printAndClean;
  }
}

const formatCLP = (value: number) =>
  new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value);

/* ============================================================================
   Comanda de un pedido (para cocina/preparación)
   ============================================================================ */

type OrderForPrint = {
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
    selections?: { optionName: string; price: number; groupLabel: string }[];
    note?: string;
  }[];
  total: number;
  created_at: string;
};

export function printComanda(
  order: OrderForPrint,
  branches: { id: string; name: string }[]
) {
  const branchName =
    branches.find((b) => b.id === order.branch_id)?.name ?? "Sin asignar";

  const modalidad =
    order.order_type === "delivery"
      ? `DELIVERY → ${order.address ?? ""}`
      : order.order_type === "mostrador"
      ? `MOSTRADOR`
      : `RETIRO EN ${
          order.pickup_location === "salvador-allende"
            ? "SALVADOR ALLENDE"
            : "LAGUNILLAS"
        }`;

  const itemsHtml = order.items
    .map((line) => {
      const selectionsHtml = (line.selections || [])
        .map((s) => `<div class="item-detail">• ${s.optionName}</div>`)
        .join("");
      const noteHtml = line.note
        ? `<div class="item-detail bold">📝 ${line.note}</div>`
        : "";
      return `
        <div style="margin-bottom: 6px;">
          <div class="row item-name">
            <span>${line.qty}x ${line.item.name}</span>
          </div>
          ${selectionsHtml}
          ${noteHtml}
        </div>
      `;
    })
    .join("");

  const html = `
    <div class="center title">EMPAPADOS</div>
    <div class="center small">${branchName}</div>
    <div class="line"></div>
    <div class="bold">Pedido #${order.id}</div>
    <div>${order.customer_name}</div>
    <div class="small">${new Date(order.created_at).toLocaleString("es-CL")}</div>
    <div class="bold small">${modalidad}</div>
    <div class="line"></div>
    ${itemsHtml}
    <div class="line"></div>
    <div class="row bold">
      <span>TOTAL</span>
      <span>$${formatCLP(order.total)}</span>
    </div>
    <div class="line"></div>
    <div class="center small">¡Empápate de sabor!</div>
  `;

  openPrintWindow(html, `Comanda #${order.id}`);
}

/* ============================================================================
   Resumen de ventas del día (cierre/informe)
   ============================================================================ */

type DailySummaryInput = {
  branchName: string;
  dateLabel: string;
  totalSales: number;
  salesByMethod: { method: string; total: number; count: number }[];
  movementsIn: number;
  movementsOut: number;
  openingCash: number;
  expectedCash: number;
  ordersCount: number;
};

export function printDailySummary(data: DailySummaryInput) {
  const methodsHtml = data.salesByMethod
    .map(
      (m) => `
      <div class="row">
        <span>${m.method} (${m.count})</span>
        <span>$${formatCLP(m.total)}</span>
      </div>
    `
    )
    .join("");

  const html = `
    <div class="center title">EMPAPADOS</div>
    <div class="center bold">Resumen de Ventas</div>
    <div class="center small">${data.branchName}</div>
    <div class="center small">${data.dateLabel}</div>
    <div class="line"></div>
    <div class="row bold">
      <span>Total Ventas</span>
      <span>$${formatCLP(data.totalSales)}</span>
    </div>
    <div class="small">${data.ordersCount} pedido(s)/venta(s)</div>
    <div class="line"></div>
    <div class="bold small">POR MEDIO DE PAGO</div>
    ${methodsHtml}
    <div class="line"></div>
    <div class="bold small">CAJA</div>
    <div class="row">
      <span>Efectivo inicial</span>
      <span>$${formatCLP(data.openingCash)}</span>
    </div>
    <div class="row">
      <span>Ingresos manuales</span>
      <span>+$${formatCLP(data.movementsIn)}</span>
    </div>
    <div class="row">
      <span>Egresos manuales</span>
      <span>-$${formatCLP(data.movementsOut)}</span>
    </div>
    <div class="row bold">
      <span>Efectivo esperado</span>
      <span>$${formatCLP(data.expectedCash)}</span>
    </div>
    <div class="line"></div>
    <div class="center small">${new Date().toLocaleString("es-CL")}</div>
  `;

  openPrintWindow(html, "Resumen de Ventas");
}
