-- Notifications PWA pour l'agenda / habits
ALTER TABLE agenda_settings
  ADD COLUMN IF NOT EXISTS pwa_notifications_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS morning_brief_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS morning_brief_time TIME DEFAULT '08:30',
  ADD COLUMN IF NOT EXISTS recap_reminder_enabled BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS agenda_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda_notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('morning_brief', 'recap_reminder')),
  delivery_date DATE NOT NULL,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notification_type, delivery_date)
);

ALTER TABLE agenda_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own agenda_push_subscriptions" ON agenda_push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users read their own agenda_notification_deliveries" ON agenda_notification_deliveries
  FOR SELECT USING (auth.uid() = user_id);
