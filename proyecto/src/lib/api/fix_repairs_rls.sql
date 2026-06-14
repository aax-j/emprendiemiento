-- Actualizar las políticas de RLS para repair_history
ALTER TABLE public.repair_history ENABLE ROW LEVEL SECURITY;

-- Permitir que los dueños de los vehículos puedan ver el historial de reparaciones (incluso si están en el perfil local del taller)
DROP POLICY IF EXISTS "Repair history readable by vehicle owner" ON public.repair_history;
CREATE POLICY "Repair history readable by vehicle owner"
ON public.repair_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = repair_history.vehicle_id
    AND (
      v.client_id = auth.uid()
      OR EXISTS (
        -- Si el cliente tiene un vehículo registrado con la misma placa
        SELECT 1 FROM public.vehicles v_client
        WHERE v_client.client_id = auth.uid()
        AND v_client.plate = v.plate
      )
    )
  )
);

-- Permitir que los talleres puedan ver las reparaciones de sus propios talleres
DROP POLICY IF EXISTS "Repair history readable by workshop" ON public.repair_history;
CREATE POLICY "Repair history readable by workshop"
ON public.repair_history FOR SELECT USING (
  workshop_id IN (SELECT workshop_id FROM public.profiles WHERE id = auth.uid())
);
