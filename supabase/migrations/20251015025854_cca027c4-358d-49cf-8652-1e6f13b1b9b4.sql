-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create rooms table
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  is_private BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Create room_members table
CREATE TABLE public.room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (room_id, user_id)
);

ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

-- Add room_id and image_url to messages
ALTER TABLE public.messages ADD COLUMN room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN image_url TEXT;

-- Update profiles table
ALTER TABLE public.profiles ADD COLUMN bio TEXT;
ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;

-- Create muted_users table
CREATE TABLE public.muted_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  muted_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  muted_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.muted_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for rooms
CREATE POLICY "Users can view rooms they're in" ON public.rooms
  FOR SELECT USING (
    NOT is_private OR 
    EXISTS (
      SELECT 1 FROM public.room_members 
      WHERE room_id = rooms.id AND user_id = auth.uid()
    ) OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can create rooms" ON public.rooms
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can manage all rooms" ON public.rooms
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Room creators can update their rooms" ON public.rooms
  FOR UPDATE USING (auth.uid() = created_by);

-- RLS Policies for room_members
CREATE POLICY "Users can view room members" ON public.room_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_members.room_id AND rm.user_id = auth.uid()
    ) OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can join rooms" ON public.room_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms" ON public.room_members
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage room members" ON public.room_members
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Update messages policies for room support
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Messages are viewable by everyone" ON public.messages;

CREATE POLICY "Users can send messages in their rooms" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    (
      room_id IS NULL OR
      EXISTS (
        SELECT 1 FROM public.room_members
        WHERE room_id = messages.room_id AND user_id = auth.uid()
      )
    ) AND
    NOT EXISTS (
      SELECT 1 FROM public.muted_users
      WHERE user_id = auth.uid() AND (muted_until IS NULL OR muted_until > now())
    )
  );

CREATE POLICY "Users can view messages in their rooms" ON public.messages
  FOR SELECT USING (
    room_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.room_members
      WHERE room_id = messages.room_id AND user_id = auth.uid()
    ) OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete any message" ON public.messages
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own messages" ON public.messages
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for muted_users
CREATE POLICY "Admins can mute users" ON public.muted_users
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view if they're muted" ON public.muted_users
  FOR SELECT USING (auth.uid() = user_id);

-- Update profiles policies
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Insert Global Room
INSERT INTO public.rooms (id, name, is_private, code)
VALUES ('00000000-0000-0000-0000-000000000000', 'Global Room', false, null)
ON CONFLICT (id) DO NOTHING;