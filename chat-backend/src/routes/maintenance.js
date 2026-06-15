const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// POST /api/maintenance/history
// Guardar historial de mantenimiento (ej. cambio de aceite, revisión)
router.post('/history', async (req, res) => {
  const { id_usuario, id_vehiculo, tipo_mantenimiento, kilometraje, notas } = req.body;

  if (!id_usuario || !id_vehiculo || !tipo_mantenimiento || !kilometraje) {
    return res.status(400).json({ error: "Faltan parámetros obligatorios" });
  }

  try {
    const { data, error } = await supabase
      .from('mantenimiento_historial')
      .insert([
        {
          id_usuario,
          id_vehiculo,
          tipo_mantenimiento,
          kilometraje,
          fecha: new Date(),
          notas
        }
      ]);

    if (error) throw error;

    res.json({ message: "Historial de mantenimiento guardado exitosamente", data });
  } catch (error) {
    console.error("[ERROR en /maintenance/history]:", error.message);
    res.status(500).json({ error: "Error interno al guardar historial" });
  }
});

// POST /api/maintenance/config
// Configurar intervalos deseados para el próximo servicio
router.post('/config', async (req, res) => {
  const { id_usuario, id_vehiculo, tipo_mantenimiento, meses_intervalo, km_intervalo } = req.body;

  if (!id_usuario || !id_vehiculo || !tipo_mantenimiento) {
    return res.status(400).json({ error: "Faltan parámetros obligatorios" });
  }

  try {
    const { data, error } = await supabase
      .from('mantenimiento_configuracion')
      .upsert([
        {
          id_usuario,
          id_vehiculo,
          tipo_mantenimiento,
          meses_intervalo: meses_intervalo || 6,
          km_intervalo: km_intervalo || 5000,
          actualizado_en: new Date()
        }
      ], { onConflict: 'id_vehiculo, tipo_mantenimiento' });

    if (error) throw error;

    res.json({ message: "Configuración de mantenimiento guardada", data });
  } catch (error) {
    console.error("[ERROR en /maintenance/config]:", error.message);
    res.status(500).json({ error: "Error interno al configurar intervalos" });
  }
});

module.exports = router;
