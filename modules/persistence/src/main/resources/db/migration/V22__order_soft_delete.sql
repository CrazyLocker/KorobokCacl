-- Orders get the same two step deletion as calculation versions.
--
-- Marking an order as deleted keeps it in the client tree struck through: the
-- deal existed, the manager can still open it while agreeing the history with
-- the client, and nothing about the numbers is lost. Erasing from the database
-- is a separate, explicit action of the cleanup block, and only marked orders
-- may be erased.

ALTER TABLE calculation_orders ADD COLUMN deleted_at TIMESTAMP;

CREATE INDEX idx_calculation_orders_deleted_at ON calculation_orders (deleted_at);
