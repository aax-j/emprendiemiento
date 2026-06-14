/**
 * search.js
 * Servicio de Búsqueda Web Estructurada con White-listing
 *
 * Este módulo orquesta búsquedas en tiempo real usando Tavily API,
 * restringidas estrictamente a dominios oficiales y técnicos autorizados.
 */

// ============================================================================
// LISTA BLANCA DE DOMINIOS OFICIALES AUTORIZADOS
// Fuentes técnicas verificadas: fabricantes, portales especializados y entidades de homologación.
// ============================================================================
const DOMINIOS_AUTORIZADOS = [
  // Fabricantes oficiales (región Ecuador / Latinoamérica)
  'chevrolet.com.ec',
  'kia.co',
  'kia.com',
  'hyundai.com.ec',
  'hyundai.com',
  'toyota.com.ec',
  'toyota.com',
  'nissanusa.com',
  'mazda.com',
  'ford.com',
  'hondaecuador.com',
  'honda.com',
  'mitsubishi-motors.com',

  // Portales técnicos globales
  'autozone.com',
  'carcare.org',
  'rockauto.com',
  'alldata.com',
  'mitchellrepairinfo.com',
  'motor.com',

  // Entidades de seguridad y homologación
  'nhtsa.gov',
  'aeade.net',        // Asociación de Empresas Automotrices del Ecuador
  'repuestosnacionales.com',
];

/**
 * Construye la cadena de búsqueda con operadores de filtrado por dominios.
 *
 * @param {string} vehiculo - El vehículo activo (Ej. "Kia Soluto 2022")
 * @param {string} consulta - La pregunta técnica del usuario
 * @returns {string} Query optimizado para búsqueda
 */
function construirQueryBusqueda(vehiculo, consulta) {
  // Extraer la marca del vehículo para priorizar su dominio oficial
  const marcaVehiculo = vehiculo ? vehiculo.split(' ')[0].toLowerCase() : '';

  // Priorizar dominios relevantes para esta marca específica
  const dominiosPrioritarios = DOMINIOS_AUTORIZADOS.filter(d =>
    d.includes(marcaVehiculo) || d.includes('autozone') || d.includes('nhtsa') || d.includes('carcare')
  );

  const filtroSitios = dominiosPrioritarios.map(d => `site:${d}`).join(' OR ');
  
  const query = vehiculo
    ? `(${filtroSitios}) "${vehiculo}" ${consulta}`
    : `(${filtroSitios}) ${consulta}`;

  return query;
}

/**
 * Busca información técnica verificada usando Tavily API con filtros de white-listing.
 *
 * @param {string} vehiculo - Vehículo activo de la sesión (Ej. "Kia Soluto 2022 1.4L")
 * @param {string} consulta - La pregunta técnica del usuario
 * @returns {Promise<{ contenido: string, fuentes: Array<{url: string, titulo: string}> }>}
 */
async function buscarInfoTecnica(vehiculo, consulta) {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    console.warn('[Search] TAVILY_API_KEY no configurada. Saltando búsqueda web.');
    return { contenido: null, fuentes: [] };
  }

  try {
    const queryOptimizado = construirQueryBusqueda(vehiculo, consulta);
    console.log(`[Search] Query generado: ${queryOptimizado}`);

    // Llamada a Tavily API usando fetch nativo
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query: queryOptimizado,
        search_depth: 'advanced',    // Extracción profunda de contenido
        include_raw_content: false,
        max_results: 4,              // Máximo 4 resultados para controlar tokens
        include_domains: DOMINIOS_AUTORIZADOS, // Whitelist nativa de Tavily
        include_answer: false
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Search] Error de Tavily API: ${response.status} - ${errorBody}`);
      return { contenido: null, fuentes: [] };
    }

    const data = await response.json();
    const resultados = data.results || [];

    if (resultados.length === 0) {
      console.warn('[Search] No se encontraron resultados en los dominios autorizados.');
      return { contenido: null, fuentes: [] };
    }

    // Extraer y limpiar el contenido de los resultados
    const fragmentos = resultados
      .filter(r => r.content && r.content.trim().length > 50)
      .slice(0, 3)  // Máximo 3 fragmentos
      .map((r, idx) => `[Fuente ${idx + 1} - ${r.title}]:\n${r.content.trim()}`);

    const fuentes = resultados.slice(0, 3).map(r => ({
      url: r.url,
      titulo: r.title
    }));

    const contenidoUnido = fragmentos.join('\n\n---\n\n');

    console.log(`[Search] ${resultados.length} resultado(s) encontrado(s) en fuentes autorizadas.`);

    return { contenido: contenidoUnido, fuentes };

  } catch (error) {
    console.error('[Search] Error inesperado en búsqueda web:', error.message);
    return { contenido: null, fuentes: [] };
  }
}

module.exports = { buscarInfoTecnica, DOMINIOS_AUTORIZADOS };
