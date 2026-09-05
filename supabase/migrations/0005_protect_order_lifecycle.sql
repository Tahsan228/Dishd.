-- ============================================================================
-- Dishd — protect the order lifecycle.
--
-- Run AFTER 0004.
--
-- 0004 closed a forgery hole on `logs`. This closes the same class of hole one
-- level upstream, on `orders`, where it is worse.
--
--   The orders_update policy is `using (buyer_id = auth.uid() or
--   dishd_owns_kitchen(kitchen_id))` with no WITH CHECK and no transition
--   guard. The Supabase REST API is public, so a buyer holding nothing but
--   their own anon JWT could:
--
--     PATCH /rest/v1/orders?id=eq.<own order>  {"status":"completed"}
--
--   That fires dishd_autolog_on_complete(), which inserts a log with
--   is_verified = true, and dishd_recompute_kitchen(), which increments
--   orders_completed, distinct_customers, repeat_customers and revenue_cents.
--
--   So the single claim the product rests on — "every review is backed by a
--   real transaction, ratings cannot be farmed" — was defeated by one HTTP
--   request, without any food changing hands. The same request inflates the
--   revenue figure on the Business Record a cook hands to a bank or landlord,
--   which turns a product claim into a misrepresentation problem.
--
--   Two further variants of the same hole:
--     - status := 'declined' by the buyer increments the cook's
--       cook_cancellations, which is -15 credibility points each. Any buyer
--       could grief any cook's score at will.
--     - payment_status := 'paid' by the buyer. Nothing else in the system
--       writes that column, so an unpaid order could be collected as paid.
--
-- RLS cannot express any of this, for the same reason 0004 gave: a WITH CHECK
-- expression cannot see the OLD row, so it cannot reason about a *transition*.
-- A BEFORE UPDATE trigger can.
--
-- Buyers keep exactly one power over a live order: cancelling it before the
-- cook has started. Everything else about an order's lifecycle belongs to the
-- cook, and everything about money belongs to the payment processor.
-- ============================================================================

create or replace function dishd_guard_order_lifecycle()
returns trigger language plpgsql
set search_path = public as $$
declare
  actor       uuid := auth.uid();
  is_owner    boolean;
  is_buyer    boolean;
begin
  -- No end-user JWT means this is the service role, the SQL editor, or a
  -- migration: the seed and verification scripts legitimately move orders
  -- through the whole lifecycle. The exploit path always carries a user JWT,
  -- so guarding authenticated callers is what closes it.
  if actor is null then
    return new;
  end if;

  -- Identity, price and pickup code are set once at insert. An author may
  -- never re-point an order at a different buyer, kitchen or amount.
  new.id             := old.id;
  new.buyer_id       := old.buyer_id;
  new.kitchen_id     := old.kitchen_id;
  new.subtotal_cents := old.subtotal_cents;
  new.pickup_code    := old.pickup_code;
  new.payment_method := old.payment_method;
  new.created_at     := old.created_at;

  -- Money is written by the payment processor via the service role, never by
  -- either party to the order.
  new.payment_status    := old.payment_status;
  new.stripe_session_id := old.stripe_session_id;

  if new.status is distinct from old.status then
    is_owner := dishd_owns_kitchen(old.kitchen_id);
    is_buyer := old.buyer_id = actor;

    if not (is_owner or is_buyer) then
      raise exception 'not a party to this order'
        using errcode = 'check_violation';
    end if;

    -- Terminal states are final. Without this, a cancelled order could be
    -- walked back to completed and re-mint a verified log.
    if old.status in ('completed', 'cancelled', 'declined') then
      raise exception 'order is already %, and cannot change again', old.status
        using errcode = 'check_violation';
    end if;

    if is_owner then
      -- The cook runs the kitchen-side state machine, one step at a time.
      -- pending -> completed is rejected: a pickup that was never accepted or
      -- made ready did not happen.
      if not (
           (old.status = 'pending'  and new.status in ('accepted', 'declined'))
        or (old.status = 'accepted' and new.status in ('ready', 'cancelled'))
        or (old.status = 'ready'    and new.status in ('completed', 'cancelled'))
      ) then
        raise exception 'illegal order transition % -> %', old.status, new.status
          using errcode = 'check_violation';
      end if;
    else
      -- The buyer may only walk away, and only before the food is made ready.
      -- Notably they may not mark their own order completed, which is what
      -- kept the verified-review claim honest.
      if new.status <> 'cancelled' or old.status not in ('pending', 'accepted') then
        raise exception 'a buyer may only cancel an order that has not been made ready'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Name forces this to run before trg_orders_autolog: PostgreSQL fires
-- same-timing triggers in name order, and digits sort before letters. An
-- illegal 'completed' must never reach the autolog trigger.
drop trigger if exists trg_orders_00_guard_lifecycle on orders;
create trigger trg_orders_00_guard_lifecycle
  before update on orders
  for each row execute function dishd_guard_order_lifecycle();
