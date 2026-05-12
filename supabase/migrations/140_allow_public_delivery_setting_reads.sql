-- Allow customer-facing clients to read the delivery availability toggle.
DROP POLICY IF EXISTS "Public can view delivery setting" ON cashier_settings;
CREATE POLICY "Public can view delivery setting" ON cashier_settings
  FOR SELECT
  TO authenticated, anon
  USING (setting_key = 'delivery_enabled');
