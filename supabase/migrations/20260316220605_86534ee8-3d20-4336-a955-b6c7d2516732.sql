
-- Create a storage bucket for email images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('email-images', 'email-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Admins can upload email images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'email-images');

-- Allow public read access
CREATE POLICY "Public can read email images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'email-images');
