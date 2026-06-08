-- loans: peer-to-peer debt between players within a single season (Fitur LOAN).
--
-- A loan is a DEBT, not a transfer: it has a lifecycle and is pulled back at
-- season end. Chips move lender→borrower on APPROVE and borrower→lender on
-- REPAY / auto-SETTLE. The pool total is unchanged by a loan (chips just move),
-- so phase transitions / max_pool stay correct.
--
-- Lifecycle (status, no CHECK constraint — validated in the app layer, matching
-- the project convention for enum-like columns future milestones may extend):
--   pending   — borrower requested, awaiting the lender's consent (no chips moved)
--   active    — lender approved, chips disbursed lender→borrower
--   repaid    — borrower repaid in full (chips returned borrower→lender)
--   settled   — auto-settled at season end (may be partial; remainder written off)
--   declined  — lender refused the pending request (terminal, no chips moved)
--   cancelled — borrower withdrew the pending request (terminal, no chips moved)
--
-- edit_log actions for loans (loan_out / loan_in / loan_repay / loan_settle /
-- loan_writeoff) are EXCLUDED from season stats: the endSeason stats query
-- whitelists only the non-loan contribution actions, so loan chip movements
-- never count as session wins/losses.
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  lender_id UUID NOT NULL REFERENCES players(id),
  borrower_id UUID NOT NULL REFERENCES players(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  -- a loan to yourself is meaningless
  CHECK (lender_id <> borrower_id)
);

CREATE INDEX IF NOT EXISTS idx_loans_season ON loans(season_id);
CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_lender ON loans(lender_id);

-- Backstop the "one open loan per borrower" rule at the DB level. The action
-- layer enforces the broader "one open loan per player (either role)" rule under
-- FOR UPDATE locks; this partial unique index hard-stops a double-borrow race.
CREATE UNIQUE INDEX IF NOT EXISTS one_open_loan_per_borrower
  ON loans (borrower_id) WHERE status IN ('pending', 'active');
