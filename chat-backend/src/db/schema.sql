-- ==========================================
-- SCRIPT DE CREACIÓN DE TABLAS - AUTOTECH
-- Ejecutar en el Editor SQL de Supabase
-- ==========================================

-- 1. Tabla de Talleres (Para enrutamiento y búsqueda geoespacial base)
CREATE TABLE IF NOT EXISTS talleres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    latitud DOUBLE PRECISION NOT NULL,
    longitud DOUBLE PRECISION NOT NULL,
    horario_apertura VARCHAR(5) NOT NULL, -- ej. "08:00"
    horario_cierre VARCHAR(5) NOT NULL,   -- ej. "18:00"
    activo BOOLEAN DEFAULT true,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Historial de Mantenimiento
CREATE TABLE IF NOT EXISTS mantenimiento_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL, -- Asume que usuarios se manejan con Auth de Supabase o tu propio sistema
    id_vehiculo UUID NOT NULL, 
    tipo_mantenimiento VARCHAR(100) NOT NULL, -- ej. "Cambio de aceite", "Frenos"
    kilometraje INTEGER NOT NULL,
    notas TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Configuración de Intervalos de Mantenimiento
CREATE TABLE IF NOT EXISTS mantenimiento_configuracion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL,
    id_vehiculo UUID NOT NULL,
    tipo_mantenimiento VARCHAR(100) NOT NULL,
    meses_intervalo INTEGER DEFAULT 6,
    km_intervalo INTEGER DEFAULT 5000,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_vehiculo, tipo_mantenimiento)
);

-- 4. Tabla de Notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario UUID NOT NULL,
    id_vehiculo UUID,
    tipo_alerta VARCHAR(100) NOT NULL, -- ej. "MANTENIMIENTO_VENCIDO"
    mensaje TEXT NOT NULL,
    leido BOOLEAN DEFAULT false,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- DATOS DE PRUEBA (OPCIONAL)
-- ==========================================

-- Insertar un par de talleres de prueba en la CDMX para poder probar la búsqueda
-- Reemplaza las coordenadas con talleres cercanos a tu ubicación de prueba si lo deseas.
INSERT INTO talleres (nombre, latitud, longitud, horario_apertura, horario_cierre)
VALUES 
('Taller AutoTech Norte', 19.432608, -99.133209, '08:00', '18:00'),
('Taller Mecánico Sur', 19.300000, -99.150000, '09:00', '17:00')
ON CONFLICT DO NOTHING;
