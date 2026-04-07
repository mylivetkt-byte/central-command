-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'driver', 'system')),
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_delivery ON chat_messages(delivery_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);

-- RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Drivers can only see messages for their deliveries
CREATE POLICY "drivers_read_own_messages" ON chat_messages
  FOR SELECT TO authenticated
  USING (
    delivery_id IN (
      SELECT deliveries.id FROM deliveries
      WHERE deliveries.driver_id = auth.uid()
    )
  );

-- Drivers can only send messages on their own deliveries
CREATE POLICY "drivers_insert_messages" ON chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    delivery_id IN (
      SELECT deliveries.id FROM deliveries
      WHERE deliveries.driver_id = auth.uid()
    )
    AND delivery_id IS NOT NULL
  );

-- Admins can read/write all messages
CREATE POLICY "admin_access_all" ON chat_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
