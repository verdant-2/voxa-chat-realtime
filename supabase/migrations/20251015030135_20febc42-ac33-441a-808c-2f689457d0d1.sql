-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view room members" ON public.room_members;
DROP POLICY IF EXISTS "Users can view rooms they're in" ON public.rooms;
DROP POLICY IF EXISTS "Users can send messages in their rooms" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON public.messages;

-- Create security definer function to check room membership
CREATE OR REPLACE FUNCTION public.is_room_member(_user_id UUID, _room_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.room_members
    WHERE user_id = _user_id AND room_id = _room_id
  )
$$;

-- Create security definer function to check if user is muted
CREATE OR REPLACE FUNCTION public.is_user_muted(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.muted_users
    WHERE user_id = _user_id AND (muted_until IS NULL OR muted_until > now())
  )
$$;

-- Fixed RLS Policies for room_members (no self-reference)
CREATE POLICY "Users can view room members" ON public.room_members
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR
    user_id = auth.uid()
  );

-- Fixed RLS Policies for rooms
CREATE POLICY "Users can view rooms they're in" ON public.rooms
  FOR SELECT USING (
    NOT is_private OR 
    public.is_room_member(auth.uid(), id) OR
    public.has_role(auth.uid(), 'admin')
  );

-- Fixed messages policies
CREATE POLICY "Users can send messages in their rooms" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    NOT public.is_user_muted(auth.uid()) AND
    (room_id IS NULL OR public.is_room_member(auth.uid(), room_id))
  );

CREATE POLICY "Users can view messages in their rooms" ON public.messages
  FOR SELECT USING (
    room_id IS NULL OR
    public.is_room_member(auth.uid(), room_id) OR
    public.has_role(auth.uid(), 'admin')
  );

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat images
CREATE POLICY "Users can upload images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-images' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Images are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-images');

CREATE POLICY "Users can delete their own images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );