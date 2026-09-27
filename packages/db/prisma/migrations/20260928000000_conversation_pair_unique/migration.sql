-- One conversation per customer/provider pair.
--
-- Without this, opening a thread required find-then-create, which races: two
-- simultaneous messages could create two threads for the same pair, and a
-- customer would see duplicated history. The unique constraint makes the
-- upsert in sendMessage atomic.
--
-- Safe on an empty table. If conversations ever exist, duplicates must be
-- merged before this runs.
CREATE UNIQUE INDEX "conversations_customerId_providerProfileId_key"
  ON "conversations"("customerId", "providerProfileId");
