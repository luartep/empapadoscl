/**
 * Utilidades de impresión para impresora térmica POS-80C (80mm).
 *
 * Estrategia: iframe oculto que llama window.print() apuntando a la
 * impresora predeterminada del sistema (POS-80C configurada como default).
 * Fuente 2× (24px base), todo bold, espacios mínimos para ahorrar papel.
 */

const RECEIPT_CSS = `
  @page { size: 80mm auto; margin: 0mm 1mm; }
  * { box-sizing: border-box; font-weight: bold !important; margin: 0; padding: 0; }
  body {
    width: 80mm;
    margin: 0;
    padding: 2mm 3mm;
    font-family: 'Courier New', monospace;
    font-size: 24px;
    font-weight: bold;
    line-height: 1.2;
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: bold; }
  .line   { border-top: 1px dashed #000; margin: 3px 0; }
  .row    { display: flex; justify-content: space-between; gap: 4px; }
  .title  { font-size: 28px; font-weight: bold; line-height: 1.1; }
  .small  { font-size: 20px; font-weight: bold; line-height: 1.2; }
  .item-name   { font-weight: bold; }
  .item-detail { font-size: 20px; padding-left: 6px; color: #000; font-weight: bold; line-height: 1.2; }
  .mb1  { margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; }
  td    { padding: 1px 0; vertical-align: top; font-weight: bold; }
`;

function openPrintWindow(bodyHtml: string, title: string) {
  // Eliminar iframe anterior si existe
  const existing = document.getElementById("__print_frame__");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__print_frame__";
  // Oculto fuera de la pantalla — sin ventana emergente
  iframe.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;visibility:hidden;";
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
  <body>${bodyHtml}</body>
</html>`);
  doc.close();

  const printAndClean = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Fallback ventana nueva (Safari / Firefox restrictivo)
      const win = window.open("", "_blank", "width=1,height=1,left=-9999,top=-9999");
      if (win) {
        win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>${title}</title><style>${RECEIPT_CSS}</style></head><body>${bodyHtml}<script>window.onload=function(){window.print();setTimeout(function(){window.close();},600);};<\/script></body></html>`);
        win.document.close();
      }
    }
    // Limpiar iframe tras 3 s (tiempo suficiente para que el spooler lo reciba)
    setTimeout(() => {
      try { iframe.remove(); } catch { /* ignorar */ }
    }, 3000);
  };

  // doc.close() en Chrome sincroniza readyState a "complete" de inmediato
  if (
    (iframe.contentDocument?.readyState ?? "complete") === "complete"
  ) {
    // Pequeño delay para que el layout del iframe termine de renderizarse
    setTimeout(printAndClean, 80);
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
      ? `DELIVERY: ${order.address ?? ""}`
      : order.order_type === "mostrador"
      ? `MOSTRADOR`
      : `RETIRO: ${
          order.pickup_location === "salvador-allende"
            ? "SALVADOR ALLENDE"
            : "LAGUNILLAS"
        }`;

  // Hora corta: HH:MM dd/mm/aaaa
  const fecha = new Date(order.created_at);
  const horaCorta = `${fecha.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} ${fecha.toLocaleDateString("es-CL")}`;

  const itemsHtml = order.items
    .map((line) => {
      const selectionsHtml = (line.selections || [])
        .map((s) => `<div class="item-detail">+ ${s.optionName}</div>`)
        .join("");
      const noteHtml = line.note
        ? `<div class="item-detail">* ${line.note}</div>`
        : "";
      return `<div class="mb1">
  <div class="row item-name"><span>${line.qty}x ${line.item.name}</span></div>
  ${selectionsHtml}${noteHtml}
</div>`;
    })
    .join("");

  const html = `
<div class="center title">EMPAPADOS</div>
<div class="center small">${branchName}</div>
<div class="line"></div>
<div class="bold">#${order.id} — ${order.customer_name}</div>
<div class="small">${horaCorta}</div>
<div class="small bold">${modalidad}</div>
<div class="line"></div>
${itemsHtml}
<div class="line"></div>
<div class="row bold"><span>TOTAL</span><span>$${formatCLP(order.total)}</span></div>`;

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
      (m) =>
        `<div class="row small"><span>${m.method} (${m.count})</span><span>$${formatCLP(m.total)}</span></div>`
    )
    .join("");

  const html = `
<div class="center title">EMPAPADOS</div>
<div class="center small">Resumen de Ventas</div>
<div class="center small">${data.branchName} — ${data.dateLabel}</div>
<div class="line"></div>
<div class="row bold"><span>Total Ventas</span><span>$${formatCLP(data.totalSales)}</span></div>
<div class="small">${data.ordersCount} pedido(s)</div>
<div class="line"></div>
<div class="small bold">POR MEDIO DE PAGO</div>
${methodsHtml}
<div class="line"></div>
<div class="small bold">CAJA</div>
<div class="row small"><span>Efectivo inicial</span><span>$${formatCLP(data.openingCash)}</span></div>
<div class="row small"><span>Ingresos manuales</span><span>+$${formatCLP(data.movementsIn)}</span></div>
<div class="row small"><span>Egresos manuales</span><span>-$${formatCLP(data.movementsOut)}</span></div>
<div class="row bold"><span>Efectivo esperado</span><span>$${formatCLP(data.expectedCash)}</span></div>
<div class="line"></div>
<div class="center small">${new Date().toLocaleString("es-CL")}</div>`;

  openPrintWindow(html, "Resumen de Ventas");
}
