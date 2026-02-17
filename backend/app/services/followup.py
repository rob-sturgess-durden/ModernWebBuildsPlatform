"""Scheduled job: send follow-up messages 10 minutes after pickup time."""

import logging
from datetime import datetime, timedelta, timezone

from ..database import get_db
from .notification import notify_followup

log = logging.getLogger(__name__)


def check_followup_orders():
    """Find orders past pickup_time + 10 min that haven't had a followup sent yet."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()

    with get_db() as db:
        rows = db.execute(
            """SELECT o.*, r.name AS restaurant_name
               FROM orders o
               JOIN restaurants r ON r.id = o.restaurant_id
               WHERE o.followup_sent = 0
                 AND o.status IN ('confirmed', 'ready', 'collected')
                 AND o.pickup_time <= ?
               LIMIT 20""",
            (cutoff,),
        ).fetchall()

        for row in rows:
            order = dict(row)
            try:
                notify_followup(order, order["restaurant_name"], restaurant_id=order["restaurant_id"])
            except Exception:
                log.exception("Failed to send followup for order %s", order["order_number"])
            db.execute("UPDATE orders SET followup_sent = 1 WHERE id = ?", (order["id"],))
