-- ==========================================
-- AutoTech Bilateral Schema Migration (B2B/B2C)
-- Ejecutar en el SQL Editor de Supabase
-- ==========================================

-- 1. Habilitar extensión PostGIS si no está habilitada
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Actualización de perfiles con soporte para Shadow Profiles y Tags de Alta Entropía
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role_type VARCHAR(20) DEFAULT 'mechanic' CHECK (role_type IN ('mechanic', 'client')),
ADD COLUMN IF NOT EXISTS client_tag VARCHAR(15) UNIQUE,
ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{"show_telemetry": true, "show_history": true}'::jsonb,
ADD COLUMN IF NOT EXISTS owner_workshop_id UUID REFERENCES public.workshops(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Crear trigger para autogenerar client_tag alfanumérico único de 6 caracteres para clientes B2C
CREATE OR REPLACE FUNCTION generate_unique_client_tag() 
RETURNS TRIGGER AS $$
DECLARE
  new_tag VARCHAR(15);
  tag_exists BOOLEAN;
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i INTEGER;
BEGIN
  IF NEW.role_type = 'client' AND NEW.owner_workshop_id IS NULL AND NEW.client_tag IS NULL THEN
    LOOP
      new_tag := 'AT-';
      FOR i IN 1..6 LOOP
        new_tag := new_tag || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
      END LOOP;
      
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE client_tag = new_tag) INTO tag_exists;
      EXIT WHEN NOT tag_exists;
    END LOOP;
    NEW.client_tag := new_tag;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_generate_client_tag ON public.profiles;
CREATE TRIGGER tr_generate_client_tag
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION generate_unique_client_tag();

-- 3. Crear tabla intermedia de relaciones (workshop_clients) - Doble Factor "Smart Sync"
CREATE TABLE IF NOT EXISTS public.workshop_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_client_approval' CHECK (status IN ('pending_client_approval', 'pending_workshop_approval', 'connected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(workshop_id, client_id)
);

-- 4. Tabla de escaparates comerciales públicos (workshop_public_profiles) con PostGIS
CREATE TABLE IF NOT EXISTS public.workshop_public_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID UNIQUE NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  description TEXT,
  logo_url TEXT,
  location GEOGRAPHY(POINT, 4326), -- PostGIS Point (WGS 84)
  address TEXT,
  services_catalogue JSONB DEFAULT '[]'::jsonb, -- Lista de servicios con precios sugeridos
  promotions JSONB DEFAULT '[]'::jsonb, -- Promociones activas
  average_rating NUMERIC(3,2) DEFAULT 0.00,
  ratings_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Crear índice espacial para búsquedas ultrarrápidas por proximidad
CREATE INDEX IF NOT EXISTS idx_workshop_location ON public.workshop_public_profiles USING GIST(location);

-- 5. Tabla de calificaciones y reseñas de clientes (workshop_reviews)
CREATE TABLE IF NOT EXISTS public.workshop_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  repair_id UUID UNIQUE NOT NULL REFERENCES public.repair_history(id) ON DELETE CASCADE, -- Reseña única por orden de trabajo
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5.5 Migrar datos de la tabla antigua "clients" a "profiles" (Shadow Profiles)
-- Eliminar la restricción que obliga a que el perfil exista en auth.users (para permitir shadow profiles locales)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Insertar los clientes existentes como shadow profiles
INSERT INTO public.profiles (id, workshop_id, full_name, phone, email, notes, role, role_type, owner_workshop_id, created_at)
SELECT id, workshop_id, full_name, phone, email, notes, 'mecanico', 'client', workshop_id, created_at
FROM public.clients
ON CONFLICT (id) DO NOTHING;

-- 6. Refactorización de unicidad y claves foráneas
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_plate_key;
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_client_plate_unique;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_client_plate_unique UNIQUE (client_id, plate);

-- Redirigir clave foránea de vehicles a public.profiles
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_client_id_fkey;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Redirigir clave foránea de bot_sessions a public.profiles
ALTER TABLE public.bot_sessions DROP CONSTRAINT IF EXISTS bot_sessions_client_id_fkey;
ALTER TABLE public.bot_sessions ADD CONSTRAINT bot_sessions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 7. Configuración de Políticas RLS (Row Level Security) para Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are readable by self, owners or connected workshops" ON public.profiles;
-- Lectura de perfiles
CREATE POLICY "Profiles are readable by self, owners or connected workshops"
ON public.profiles FOR SELECT USING (
  id = auth.uid()
  OR owner_workshop_id IN (SELECT workshop_id FROM public.profiles WHERE id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.workshop_clients wc 
    WHERE wc.client_id = public.profiles.id 
      AND wc.workshop_id IN (SELECT workshop_id FROM public.profiles WHERE id = auth.uid())
      AND wc.status = 'connected'
  )
  OR (role_type = 'client' AND owner_workshop_id IS NULL) -- Clientes globales visibles para vinculación
);

DROP POLICY IF EXISTS "Profiles are editable by owners or workshops that own them" ON public.profiles;
-- Modificación de perfiles (El taller no puede modificar perfiles globales)
CREATE POLICY "Profiles are editable by owners or workshops that own them"
ON public.profiles FOR UPDATE USING (
  id = auth.uid() -- Editar propio perfil maestro
  OR (
    owner_workshop_id IS NOT NULL 
    AND owner_workshop_id IN (SELECT workshop_id FROM public.profiles WHERE id = auth.uid()) -- Solo si es un shadow profile local
  )
);

-- ========================================================
-- RPC para geolocalización de talleres PostGIS
-- ========================================================
CREATE OR REPLACE FUNCTION public.get_nearby_workshops(
  client_lat DOUBLE PRECISION,
  client_lng DOUBLE PRECISION,
  radius_meters DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  workshop_id UUID,
  name VARCHAR,
  description TEXT,
  logo_url TEXT,
  address TEXT,
  average_rating NUMERIC,
  ratings_count INTEGER,
  services_catalogue JSONB,
  promotions JSONB,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wpp.id,
    wpp.workshop_id,
    w.name::VARCHAR,
    wpp.description,
    wpp.logo_url,
    wpp.address,
    wpp.average_rating,
    wpp.ratings_count,
    wpp.services_catalogue,
    wpp.promotions,
    ST_Distance(
      wpp.location, 
      ST_SetSRID(ST_MakePoint(client_lng, client_lat), 4326)::geography
    ) AS distance_meters
  FROM public.workshop_public_profiles wpp
  JOIN public.workshops w ON w.id = wpp.workshop_id
  WHERE ST_DWithin(
    wpp.location, 
    ST_SetSRID(ST_MakePoint(client_lng, client_lat), 4326)::geography, 
    radius_meters
  )
  ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;

