from fastapi import APIRouter, HTTPException, BackgroundTasks, Form
from fastapi.responses import HTMLResponse

from ..database import get_db
from ..services.order_service import advance_order_status
from ..services.notification import notify_customer_status, notify_customer_time_changed

router = APIRouter(prefix="/o", tags=["owner-portal"])


def _format_items(items: list[dict]) -> str:
    parts = []
    for it in items:
        parts.append(f"{it['quantity']}x {it['item_name']}")
    return ", ".join(parts)


def _get_order_by_token(token: str):
    tok = (token or "").strip()
    if not tok:
        raise HTTPException(status_code=404, detail="Invalid token")
    with get_db() as db:
        order = db.execute(
            "SELECT * FROM orders WHERE owner_action_token = ?",
            (tok,),
        ).fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        items = db.execute("SELECT * FROM order_items WHERE order_id = ?", (order["id"],)).fetchall()
        restaurant = db.execute("SELECT * FROM restaurants WHERE id = ?", (order["restaurant_id"],)).fetchone()
    return dict(order), [dict(i) for i in items], dict(restaurant) if restaurant else None


def _page(title: str, body: str) -> HTMLResponse:
    html = f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <style>
      body {{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 0; background: #0b1220; color: #e2e8f0; }}
      .wrap {{ max-width: 860px; margin: 0 auto; padding: 24px 16px 60px; }}
      .card {{ background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 18px; padding: 18px 18px; }}
      h1 {{ margin: 0 0 6px; font-size: 22px; }}
      .muted {{ color: rgba(226, 232, 240, 0.72); font-size: 14px; }}
      .row {{ display: grid; grid-template-columns: 140px 1fr; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(148, 163, 184, 0.12); }}
      .row:last-child {{ border-bottom: none; }}
      .label {{ color: rgba(226, 232, 240, 0.72); font-weight: 700; letter-spacing: 0.02em; }}
      .value {{ color: #e2e8f0; }}
      .btns {{ display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }}
      button {{ border: none; border-radius: 999px; padding: 10px 14px; font-weight: 800; cursor: pointer; }}
      .ok {{ background: #22c55e; color: #052e16; }}
      .no {{ background: #ef4444; color: #fff; }}
      .sec {{ background: transparent; color: #e2e8f0; border: 1px solid rgba(148,163,184,0.35); }}
      input, textarea {{ width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(148,163,184,0.2); background: rgba(2, 6, 23, 0.5); color: #e2e8f0; }}
      textarea {{ min-height: 100px; resize: vertical; }}
      .grid2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }}
      @media (max-width: 720px) {{ .row {{ grid-template-columns: 1fr; }} .grid2 {{ grid-template-columns: 1fr; }} }}
      .badge {{ display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; }}
      .pending {{ background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.25); }}
      .confirmed {{ background: rgba(59, 130, 246, 0.18); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.25); }}
      .ready {{ background: rgba(34, 197, 94, 0.18); color: #86efac; border: 1px solid rgba(34, 197, 94, 0.25); }}
      .cancelled {{ background: rgba(239, 68, 68, 0.18); color: #fecaca; border: 1px solid rgba(239, 68, 68, 0.25); }}
      a {{ color: #fbbf24; }}
    </style>
  </head>
  <body>
    <div class="wrap">
      {body}
    </div>
  </body>
</html>"""
    return HTMLResponse(html, status_code=200)


def _status_badge(status: str) -> str:
    s = (status or "").lower()
    cls = s if s in {"pending", "confirmed", "ready", "cancelled"} else "pending"
    return f'<span class="badge {cls}">{s.upper() if s else "PENDING"}</span>'


@router.get("/{token}", response_class=HTMLResponse)
def owner_portal(token: str):
    order, items, restaurant = _get_order_by_token(token)
    rname = (restaurant or {}).get("name") or "Restaurant"
    body = f"""
      <div class="card">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
          <div>
            <h1>Order {order["order_number"]}</h1>
            <div class="muted">{rname} · {_status_badge(order.get("status","pending"))}</div>
          </div>
          <div class="muted" style="text-align:right;">
            <div>Customer: <strong>{order.get("customer_name","")}</strong></div>
            <div>{order.get("customer_phone","")}</div>
            <div>{order.get("customer_email","") or ""}</div>
          </div>
        </div>

        <div class="row"><div class="label">Pickup time</div><div class="value">{order.get("pickup_time","")}</div></div>
        <div class="row"><div class="label">Items</div><div class="value">{_format_items(items)}</div></div>
        <div class="row"><div class="label">Subtotal</div><div class="value">£{float(order.get("subtotal") or 0):.2f}</div></div>
      </div>

      <div style="height:14px;"></div>

      <div class="card">
        <h1 style="font-size:18px;">Actions</h1>
        <p class="muted" style="margin-top:6px;">Accept or reject the order, change pickup time, and add a note for the customer.</p>

        <form method="post">
          <div class="btns">
            <button class="ok" type="submit" name="action" value="confirmed">Accept</button>
            <button class="no" type="submit" name="action" value="cancelled">Reject</button>
            <button class="sec" type="submit" name="action" value="update">Save changes</button>
          </div>

          <div style="height:14px;"></div>

          <div class="grid2">
            <div>
              <div class="label" style="margin-bottom:6px;">New pickup time (optional)</div>
              <input type="datetime-local" name="pickup_time" />
              <div class="muted" style="margin-top:6px;">Leave blank to keep existing time.</div>
            </div>
            <div>
              <div class="label" style="margin-bottom:6px;">Note to customer (optional)</div>
              <textarea name="note" placeholder="e.g. We’re running 10 mins late, thanks for waiting.">{(order.get("owner_note") or "")}</textarea>
            </div>
          </div>
        </form>

        <p class="muted" style="margin-top:12px;">Customer link: <a href="/order/{order["order_number"]}" target="_blank" rel="noreferrer">/order/{order["order_number"]}</a></p>
      </div>
    """
    return _page(f"Order {order['order_number']}", body)


@router.post("/{token}", response_class=HTMLResponse)
def owner_portal_action(
    token: str,
    background_tasks: BackgroundTasks,
    action: str = Form("update"),
    pickup_time: str | None = Form(None),
    note: str | None = Form(None),
):
    order, items, restaurant = _get_order_by_token(token)
    restaurant_name = (restaurant or {}).get("name") or ""

    action = (action or "update").strip().lower()
    pickup_time = (pickup_time or "").strip() or None
    note = (note or "").strip() or None

    # Disallow changes once fully closed out.
    if (order.get("status") or "").lower() in {"collected"}:
        return _page("Order closed", f"<div class='card'><h1>Order closed</h1><p class='muted'>This order is already collected.</p></div>")

    updated = None
    time_changed = False
    note_changed = False

    with get_db() as db:
        if pickup_time and pickup_time != (order.get("pickup_time") or ""):
            db.execute(
                "UPDATE orders SET pickup_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (pickup_time, order["id"]),
            )
            time_changed = True
        if note is not None and note != (order.get("owner_note") or ""):
            db.execute(
                "UPDATE orders SET owner_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (note, order["id"]),
            )
            note_changed = True

    if action in {"confirmed", "cancelled"}:
        try:
            updated = advance_order_status(order["id"], action, order["restaurant_id"])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        background_tasks.add_task(notify_customer_status, updated, restaurant_name)

    # Fetch fresh order row for time-change notifications.
    with get_db() as db:
        fresh = db.execute("SELECT * FROM orders WHERE id = ?", (order["id"],)).fetchone()
    fresh_order = dict(fresh) if fresh else order

    if time_changed or (note_changed and action == "update"):
        background_tasks.add_task(notify_customer_time_changed, fresh_order, restaurant_name, note)

    # Render again
    return owner_portal(token)

