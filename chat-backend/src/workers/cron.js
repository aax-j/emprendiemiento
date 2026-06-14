const cron = require('node-cron');
const supabase = require('../db/supabase');

// Verificador de Notificaciones (Cron Job)
// Se ejecuta todos los días a las 00:00 (medianoche)
const initCronJobs = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log("[CRON] Ejecutando tarea diaria de verificación de mantenimiento...");

    try {
      // 1. Obtener todas las configuraciones de mantenimiento
      const { data: configuraciones, error: configError } = await supabase
        .from('mantenimiento_configuracion')
        .select('*');

      if (configError) throw configError;

      // 2. Para cada configuración, buscar el último registro en el historial
      for (const config of configuraciones) {
        const { data: historial, error: histError } = await supabase
          .from('mantenimiento_historial')
          .select('*')
          .eq('id_vehiculo', config.id_vehiculo)
          .eq('tipo_mantenimiento', config.tipo_mantenimiento)
          .order('fecha', { ascending: false })
          .limit(1);

        if (histError) {
          console.error(`[CRON] Error al obtener historial para vehículo ${config.id_vehiculo}:`, histError.message);
          continue;
        }

        if (historial && historial.length > 0) {
          const ultimoMantenimiento = historial[0];
          const fechaUltimo = new Date(ultimoMantenimiento.fecha);
          const fechaActual = new Date();
          
          // Calcular la diferencia en meses
          const mesesTranscurridos = (fechaActual.getFullYear() - fechaUltimo.getFullYear()) * 12 + 
                                     (fechaActual.getMonth() - fechaUltimo.getMonth());

          // Si el tiempo transcurrido supera o iguala el intervalo configurado
          if (mesesTranscurridos >= config.meses_intervalo) {
            console.log(`[CRON] ⚠️ Alerta Crítica: Vencimiento por tiempo detectado para Vehículo ${config.id_vehiculo} (${config.tipo_mantenimiento}).`);
            
            // Insertar notificación en la tabla de notificaciones
            await supabase.from('notificaciones').insert([
              {
                id_usuario: config.id_usuario,
                id_vehiculo: config.id_vehiculo,
                tipo_alerta: 'MANTENIMIENTO_VENCIDO',
                mensaje: `Tu vehículo requiere ${config.tipo_mantenimiento}. Han pasado ${mesesTranscurridos} meses desde el último registro.`,
                leido: false,
                fecha_creacion: new Date()
              }
            ]);
          }
        }
      }
      console.log("[CRON] Tarea diaria completada con éxito.");
    } catch (error) {
      console.error("[CRON] Error general en la tarea diaria:", error.message);
    }
  });
  
  console.log("✅ Cron Jobs inicializados (Ejecución diaria programada).");
};

module.exports = { initCronJobs };
