import { supabase } from '../supabase';

export interface WorkshopPublicProfile {
  id: string;
  workshop_id: string;
  name?: string; // Joined field from workshops
  description: string | null;
  logo_url: string | null;
  address: string | null;
  location?: { lat: number; lng: number } | null;
  services_catalogue: Array<{ name: string; price: number; description?: string }>;
  promotions: Array<{ title: string; description: string; discount?: string }>;
  average_rating: number;
  ratings_count: number;
  created_at: string;
}

export interface WorkshopReview {
  id: string;
  workshop_id: string;
  client_id: string;
  repair_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  client?: {
    full_name: string;
  };
}

// 1. Obtener escaparate público de un taller
export const getWorkshopPublicProfile = async (workshopId: string): Promise<WorkshopPublicProfile | null> => {
  const { data, error } = await supabase
    .from('workshop_public_profiles')
    .select('*, workshop:workshop_id(name)')
    .eq('workshop_id', workshopId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // PostgREST/PostGIS devuelve location como objeto GeoJSON {type: "Point", coordinates: [lng, lat]}
  let locationData = null;
  if (data.location && data.location.coordinates) {
    locationData = {
      lng: data.location.coordinates[0],
      lat: data.location.coordinates[1]
    };
  }

  return {
    ...data,
    name: data.workshop?.name,
    location: locationData
  } as any;
};

// 2. Crear o actualizar (Upsert) el escaparate público (B2B)
export const upsertWorkshopPublicProfile = async (
  workshopId: string,
  profile: Partial<Omit<WorkshopPublicProfile, 'id' | 'workshop_id' | 'created_at' | 'average_rating' | 'ratings_count'>> & { location?: { lat: number; lng: number } | null }
): Promise<WorkshopPublicProfile> => {
  const payload: any = {
    ...profile,
    workshop_id: workshopId
  };

  if (profile.location) {
    payload.location = `POINT(${profile.location.lng} ${profile.location.lat})`;
  } else if (profile.location === null) {
    payload.location = null;
  } else {
    delete payload.location;
  }

  const { data, error } = await supabase
    .from('workshop_public_profiles')
    .upsert([payload], { onConflict: 'workshop_id' })
    .select()
    .single();

  if (error) throw error;
  return data as WorkshopPublicProfile;
};

export const getNearbyWorkshops = async (
  lat: number,
  lng: number,
  radiusInKm: number = 20
): Promise<Array<any>> => {
  const radiusInMeters = radiusInKm * 1000;
  
  const { data, error } = await supabase.rpc('get_nearby_workshops', {
    client_lat: lat,
    client_lng: lng,
    radius_meters: radiusInMeters
  });

  if (!error && data) {
    return data;
  }

  // Fallback si la función RPC no existe o falla
  console.warn("RPC get_nearby_workshops falló o no existe. Calculando distancia localmente...", error);
  const { data: allWorkshops, error: fetchErr } = await supabase
    .from('workshop_public_profiles')
    .select('*, workshop:workshop_id(name)');
    
  if (fetchErr) throw fetchErr;
  
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metros
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2) * Math.sin(dp/2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const results = [];
  for (const w of (allWorkshops || [])) {
    if (w.location && w.location.coordinates) {
      const wLng = w.location.coordinates[0];
      const wLat = w.location.coordinates[1];
      const distance = getDistance(lat, lng, wLat, wLng);
      if (distance <= radiusInMeters) {
        results.push({
          ...w,
          name: w.workshop?.name,
          distance_meters: distance
        });
      }
    }
  }
  
  return results.sort((a, b) => a.distance_meters - b.distance_meters);
};

// 3.5 Obtener talleres globalmente por nombre (sin límite de radio)
export const searchWorkshopsByName = async (query: string): Promise<Array<any>> => {
  // Join con workshops para buscar en el nombre
  const { data, error } = await supabase
    .from('workshop_public_profiles')
    .select('*, workshop:workshop_id(name)')
    // Usamos el filtro json para buscar en la relación.
    // Como Supabase no soporta ilike en relaciones muy fácilmente en un solo string,
    // podríamos buscar localmente en JS o usar una vista. 
    // Para no crear una vista SQL, descargamos los perfiles y filtramos por nombre:
    // (En producción ideal sería una vista o rpc)
    .order('average_rating', { ascending: false });

  if (error) throw error;
  
  // Filtro en cliente para evitar crear una función SQL nueva:
  const normalizedQuery = query.toLowerCase().trim();
  const filtered = (data || []).filter(w => 
    w.workshop?.name?.toLowerCase().includes(normalizedQuery) ||
    w.address?.toLowerCase().includes(normalizedQuery) ||
    w.description?.toLowerCase().includes(normalizedQuery)
  );
  
  // Mapeamos para que coincida con el formato del RPC
  return filtered.map(w => ({
    ...w,
    name: w.workshop?.name,
    distance_meters: undefined // no hay distancia calculada globalmente
  }));
};

// 4. Registrar una calificación/reseña (B2C)
export const submitReview = async (
  review: Omit<WorkshopReview, 'id' | 'created_at'>
): Promise<WorkshopReview> => {
  // Si es una reseña libre (sin repair_id), generamos un UUID aleatorio para cumplir con el constraint NOT NULL
  const finalReview = { ...review };
  if (!finalReview.repair_id) {
    finalReview.repair_id = crypto.randomUUID();
  }

  const { data, error } = await supabase
    .from('workshop_reviews')
    .insert([finalReview])
    .select()
    .single();

  if (error) throw error;

  // Recalcular promedio de estrellas y número de calificaciones del taller de forma reactiva
  await recalculateWorkshopRating(review.workshop_id);

  return data as WorkshopReview;
};

// 5. Recalcular promedio de estrellas de un taller
const recalculateWorkshopRating = async (workshopId: string): Promise<void> => {
  const { data: reviews, error } = await supabase
    .from('workshop_reviews')
    .select('rating')
    .eq('workshop_id', workshopId);

  if (error || !reviews) return;

  const count = reviews.length;
  const avg = count > 0 
    ? reviews.reduce((acc, curr) => acc + curr.rating, 0) / count
    : 0.00;

  await supabase
    .from('workshop_public_profiles')
    .update({
      average_rating: parseFloat(avg.toFixed(2)),
      ratings_count: count
    })
    .eq('workshop_id', workshopId);
};

// 6. Obtener las reseñas de un taller
export const getWorkshopReviews = async (workshopId: string): Promise<WorkshopReview[]> => {
  const { data, error } = await supabase
    .from('workshop_reviews')
    .select('*, client:client_id(full_name)')
    .eq('workshop_id', workshopId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as WorkshopReview[];
};
