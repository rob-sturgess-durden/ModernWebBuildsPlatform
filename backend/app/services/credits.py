"""Central credit management for restaurants."""

import logging
from ..database import get_db

log = logging.getLogger(__name__)


def get_credits(restaurant_id: int) -> float:
    """Return current credit balance for a restaurant."""
    with get_db() as db:
        row = db.execute(
            "SELECT credits FROM restaurants WHERE id = ?", (restaurant_id,)
        ).fetchone()
    return float(row["credits"] or 0) if row else 0.0


def has_credits(restaurant_id: int) -> bool:
    """Return True if restaurant has positive credits."""
    return get_credits(restaurant_id) > 0


def add_credits(restaurant_id: int, amount: float, reason: str) -> float:
    """Add credits and log the event. Returns new balance."""
    with get_db() as db:
        row = db.execute(
            "SELECT credits FROM restaurants WHERE id = ?", (restaurant_id,)
        ).fetchone()
        if not row:
            log.warning("Cannot add credits: restaurant %s not found", restaurant_id)
            return 0.0

        current = float(row["credits"] or 0)
        new_balance = round(current + amount, 2)

        db.execute(
            "UPDATE restaurants SET credits = ? WHERE id = ?",
            (new_balance, restaurant_id),
        )
        db.execute(
            "INSERT INTO credit_log (restaurant_id, amount, reason, balance_after) VALUES (?, ?, ?, ?)",
            (restaurant_id, amount, reason, new_balance),
        )
        log.info(
            "Credits added: restaurant=%s amount=%.2f reason=%s balance=%.2f",
            restaurant_id, amount, reason, new_balance,
        )
    return new_balance


def deduct_credits(restaurant_id: int, amount: float, reason: str) -> float:
    """Deduct credits and log the event. Returns new balance."""
    with get_db() as db:
        row = db.execute(
            "SELECT credits FROM restaurants WHERE id = ?", (restaurant_id,)
        ).fetchone()
        if not row:
            log.warning("Cannot deduct credits: restaurant %s not found", restaurant_id)
            return 0.0

        current = float(row["credits"] or 0)
        new_balance = round(current - amount, 2)

        db.execute(
            "UPDATE restaurants SET credits = ? WHERE id = ?",
            (new_balance, restaurant_id),
        )
        db.execute(
            "INSERT INTO credit_log (restaurant_id, amount, reason, balance_after) VALUES (?, ?, ?, ?)",
            (restaurant_id, -amount, reason, new_balance),
        )
        log.info(
            "Credits deducted: restaurant=%s amount=%.2f reason=%s balance=%.2f",
            restaurant_id, amount, reason, new_balance,
        )
    return new_balance
