import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

// GET /api/reports — protegido. Retorna estadísticas de ventas según parámetros.
// Parámetros:
//   type: "daily" | "monthly" | "annual" | "by_branch" | "by_product" | "by_payment" | "summary"
//   from: fecha inicio ISO (opcional, para daily/monthly)
//   to:   fecha fin ISO (opcional)
//   year: año (para annual/monthly)
//   month: mes 1-12 (para monthly/daily)
//   branchId: filtrar por sucursal (opcional)

export async function GET(request: NextRequest) {
  if (!(await getSessionFromCookies())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const p = request.nextUrl.searchParams;
  const type = p.get("type") || "summary";
  const branchId = p.get("branchId") || null;
  const year = p.get("year") ? parseInt(p.get("year")!) : new Date().getFullYear();
  const month = p.get("month") ? parseInt(p.get("month")!) : null;
  const from = p.get("from") || null;
  const to = p.get("to") || null;

  try {
    const db = sql();

    // Rango de fechas dinámico
    let dateFilter = "";
    const params: (string | number | null)[] = [];

    if (from && to) {
      params.push(from, to);
      dateFilter = `AND o.paid_at >= $1::timestamptz AND o.paid_at < $2::timestamptz + interval '1 day'`;
    } else if (year && month) {
      params.push(year, month);
      dateFilter = `AND EXTRACT(YEAR FROM o.paid_at AT TIME ZONE 'America/Santiago') = $1
                    AND EXTRACT(MONTH FROM o.paid_at AT TIME ZONE 'America/Santiago') = $2`;
    } else if (year && !month) {
      params.push(year);
      dateFilter = `AND EXTRACT(YEAR FROM o.paid_at AT TIME ZONE 'America/Santiago') = $1`;
    }

    let branchFilter = "";
    if (branchId) {
      params.push(branchId);
      branchFilter = `AND o.branch_id = $${params.length}`;
    }

    const baseWhere = `WHERE o.payment_status = 'pagado' AND o.status != 'cancelado' ${dateFilter} ${branchFilter}`;

    if (type === "summary") {
      // ── Resumen general: total, cantidad, ticket promedio ─────────────────
      const [totals, byBranch, byPayment, topProducts] = await Promise.all([
        // Totales globales del período
        db.query(`
          SELECT
            COUNT(*) AS order_count,
            COALESCE(SUM(o.total), 0) AS total_revenue,
            COALESCE(AVG(o.total), 0) AS avg_ticket
          FROM orders o
          ${baseWhere}
        `, params),

        // Ventas por sucursal
        db.query(`
          SELECT
            b.name AS branch_name,
            o.branch_id,
            COUNT(*) AS order_count,
            COALESCE(SUM(o.total), 0) AS revenue
          FROM orders o
          LEFT JOIN branches b ON b.id = o.branch_id
          ${baseWhere}
          GROUP BY o.branch_id, b.name
          ORDER BY revenue DESC
        `, params),

        // Ventas por medio de pago
        db.query(`
          SELECT
            COALESCE(o.payment_method, 'desconocido') AS payment_method,
            COUNT(*) AS order_count,
            COALESCE(SUM(o.total), 0) AS revenue
          FROM orders o
          ${baseWhere}
          GROUP BY o.payment_method
          ORDER BY revenue DESC
        `, params),

        // Top 10 productos por ingreso
        db.query(`
          SELECT
            item_data->>'name' AS product_name,
            SUM((item_data->>'qty')::int) AS units_sold,
            SUM((item_data->>'unitPrice')::int * (item_data->>'qty')::int) AS revenue
          FROM orders o,
               jsonb_array_elements(o.items) AS item_data
          ${baseWhere}
          GROUP BY item_data->>'name'
          ORDER BY revenue DESC
          LIMIT 10
        `, params),
      ]);

      return NextResponse.json({
        type: "summary",
        totals: totals[0],
        byBranch,
        byPayment,
        topProducts,
      });
    }

    if (type === "daily") {
      // ── Ventas día a día dentro del rango ─────────────────────────────────
      const rows = await db.query(`
        SELECT
          (o.paid_at AT TIME ZONE 'America/Santiago')::date AS day,
          COUNT(*) AS order_count,
          COALESCE(SUM(o.total), 0) AS revenue,
          COALESCE(SUM(CASE WHEN o.payment_method = 'efectivo' THEN o.total ELSE 0 END), 0) AS cash,
          COALESCE(SUM(CASE WHEN o.payment_method = 'tarjeta' THEN o.total ELSE 0 END), 0) AS card,
          COALESCE(SUM(CASE WHEN o.payment_method = 'transferencia' THEN o.total ELSE 0 END), 0) AS transfer
        FROM orders o
        ${baseWhere}
        GROUP BY day
        ORDER BY day DESC
      `, params);
      return NextResponse.json({ type: "daily", rows });
    }

    if (type === "monthly") {
      // ── Ventas mes a mes dentro del año ───────────────────────────────────
      const rows = await db.query(`
        SELECT
          EXTRACT(YEAR FROM o.paid_at AT TIME ZONE 'America/Santiago')::int AS year,
          EXTRACT(MONTH FROM o.paid_at AT TIME ZONE 'America/Santiago')::int AS month,
          COUNT(*) AS order_count,
          COALESCE(SUM(o.total), 0) AS revenue,
          COALESCE(SUM(CASE WHEN o.payment_method = 'efectivo' THEN o.total ELSE 0 END), 0) AS cash,
          COALESCE(SUM(CASE WHEN o.payment_method = 'tarjeta' THEN o.total ELSE 0 END), 0) AS card,
          COALESCE(SUM(CASE WHEN o.payment_method = 'transferencia' THEN o.total ELSE 0 END), 0) AS transfer
        FROM orders o
        ${baseWhere}
        GROUP BY year, month
        ORDER BY year DESC, month DESC
      `, params);
      return NextResponse.json({ type: "monthly", rows });
    }

    if (type === "annual") {
      // ── Ventas año a año ───────────────────────────────────────────────────
      const rows = await db.query(`
        SELECT
          EXTRACT(YEAR FROM o.paid_at AT TIME ZONE 'America/Santiago')::int AS year,
          COUNT(*) AS order_count,
          COALESCE(SUM(o.total), 0) AS revenue,
          COALESCE(SUM(CASE WHEN o.payment_method = 'efectivo' THEN o.total ELSE 0 END), 0) AS cash,
          COALESCE(SUM(CASE WHEN o.payment_method = 'tarjeta' THEN o.total ELSE 0 END), 0) AS card,
          COALESCE(SUM(CASE WHEN o.payment_method = 'transferencia' THEN o.total ELSE 0 END), 0) AS transfer
        FROM orders o
        WHERE o.payment_status = 'pagado' AND o.status != 'cancelado' ${branchFilter}
        GROUP BY year
        ORDER BY year DESC
      `, branchId ? [branchId] : []);
      return NextResponse.json({ type: "annual", rows });
    }

    if (type === "by_branch") {
      // ── Detalle por sucursal con desglose mensual ──────────────────────────
      const rows = await db.query(`
        SELECT
          b.name AS branch_name,
          o.branch_id,
          EXTRACT(YEAR FROM o.paid_at AT TIME ZONE 'America/Santiago')::int AS year,
          EXTRACT(MONTH FROM o.paid_at AT TIME ZONE 'America/Santiago')::int AS month,
          COUNT(*) AS order_count,
          COALESCE(SUM(o.total), 0) AS revenue
        FROM orders o
        LEFT JOIN branches b ON b.id = o.branch_id
        ${baseWhere}
        GROUP BY o.branch_id, b.name, year, month
        ORDER BY o.branch_id, year DESC, month DESC
      `, params);
      return NextResponse.json({ type: "by_branch", rows });
    }

    if (type === "by_product") {
      // ── Ranking de productos ───────────────────────────────────────────────
      const rows = await db.query(`
        SELECT
          item_data->>'name' AS product_name,
          SUM((item_data->>'qty')::int) AS units_sold,
          SUM((item_data->>'unitPrice')::int * (item_data->>'qty')::int) AS revenue,
          COUNT(DISTINCT o.id) AS order_count
        FROM orders o,
             jsonb_array_elements(o.items) AS item_data
        ${baseWhere}
        GROUP BY item_data->>'name'
        ORDER BY revenue DESC
      `, params);
      return NextResponse.json({ type: "by_product", rows });
    }

    if (type === "by_payment") {
      // ── Ventas por medio de pago con detalle diario ───────────────────────
      const rows = await db.query(`
        SELECT
          (o.paid_at AT TIME ZONE 'America/Santiago')::date AS day,
          COALESCE(o.payment_method, 'desconocido') AS payment_method,
          COUNT(*) AS order_count,
          COALESCE(SUM(o.total), 0) AS revenue
        FROM orders o
        ${baseWhere}
        GROUP BY day, o.payment_method
        ORDER BY day DESC, revenue DESC
      `, params);
      return NextResponse.json({ type: "by_payment", rows });
    }

    if (type === "by_order_type") {
      // ── Ventas por modalidad (delivery / retiro / mostrador) ──────────────
      const rows = await db.query(`
        SELECT
          o.order_type,
          COUNT(*) AS order_count,
          COALESCE(SUM(o.total), 0) AS revenue,
          COALESCE(AVG(o.total), 0) AS avg_ticket
        FROM orders o
        ${baseWhere}
        GROUP BY o.order_type
        ORDER BY revenue DESC
      `, params);
      return NextResponse.json({ type: "by_order_type", rows });
    }

    if (type === "shifts") {
      // ── Historial de turnos de caja cerrados ──────────────────────────────
      let shiftParams: (string | number | null)[] = [];
      let shiftWhere = "WHERE cs.status = 'cerrado'";
      if (year) {
        shiftParams.push(year);
        shiftWhere += ` AND EXTRACT(YEAR FROM cs.opened_at AT TIME ZONE 'America/Santiago') = $${shiftParams.length}`;
      }
      if (branchId) {
        shiftParams.push(branchId);
        shiftWhere += ` AND cs.branch_id = $${shiftParams.length}`;
      }

      const rows = await db.query(`
        SELECT
          cs.id,
          cs.branch_id,
          b.name AS branch_name,
          cs.opening_cash,
          cs.opened_at,
          cs.closed_at,
          cs.closing_type,
          cs.counted_cash,
          cs.counted_card,
          cs.counted_transfer,
          cs.expected_cash,
          cs.expected_card,
          cs.expected_transfer,
          cs.notes,
          COALESCE(cs.counted_cash,0) + COALESCE(cs.counted_card,0) + COALESCE(cs.counted_transfer,0) AS total_counted,
          COALESCE(cs.expected_cash,0) + COALESCE(cs.expected_card,0) + COALESCE(cs.expected_transfer,0) AS total_expected
        FROM cash_shifts cs
        LEFT JOIN branches b ON b.id = cs.branch_id
        ${shiftWhere}
        ORDER BY cs.opened_at DESC
        LIMIT 100
      `, shiftParams);
      return NextResponse.json({ type: "shifts", rows });
    }

    return NextResponse.json({ error: "Tipo de reporte no válido." }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error al generar el reporte." }, { status: 500 });
  }
}
