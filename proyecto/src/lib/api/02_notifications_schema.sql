-- ==============================================================================
-- 02_notifications_schema.sql
-- Este script crea la tabla de notificaciones y sus políticas RLS.
-- Ejecutar en el editor SQL de Supabase.
-- ==============================================================================

-- 1. Crear tabla de notificaciones
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'invite', 'message', 'repair', 'alert', 'system'
  read BOOLEAN DEFAULT false NOT NULL,
  related_entity_id UUID, -- Opcional, para enlazar con un chat, reparación o conexión
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. Crear Políticas RLS

-- Los usuarios solo pueden ver sus propias notificaciones
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Los usuarios (o el sistema a través de la app cliente) pueden insertar notificaciones para sí mismos o para otros.
-- NOTA: Como cualquier usuario autenticado puede enviar un mensaje o solicitud a otro,
-- necesitamos permitir la inserción de notificaciones hacia otros usuarios.
CREATE POLICY "Users can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Los usuarios pueden marcar como leídas (actualizar) sus propias notificaciones
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Los usuarios pueden eliminar sus propias notificaciones
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
