SELECT cron.schedule(
  'send-renewal-reminders-daily',
  '0 12 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://daiyrwxcsqvbbntzjdzy.supabase.co/functions/v1/send-renewal-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhaXlyd3hjc3F2YmJudHpqZHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNDA5NzEsImV4cCI6MjA4NzgxNjk3MX0.vfEp5rvAV1piVITaOQLKPvySgeNg0x49b1meXy_gfec"}'::jsonb,
        body:='{"time": "scheduled"}'::jsonb
    ) AS request_id;
  $$
);