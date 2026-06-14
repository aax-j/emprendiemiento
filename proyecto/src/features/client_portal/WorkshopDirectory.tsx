import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNearbyWorkshops, searchWorkshopsByName } from '../../lib/api/workshop_profiles';
import { Icon } from '../../components/Icon/Icon';
import styles from './client_portal.module.css';

interface WorkshopEntry {
  workshop_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  address: string | null;
  average_rating: number;
  ratings_count: number;
  services_catalogue: any[];
  promotions: any[];
  distance_meters: number;
}

export const WorkshopDirectory = () => {
  const navigate = useNavigate();
  const [workshops, setWorkshops] = useState<WorkshopEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const FIXED_RADIUS = 100; // km
  const [search, setSearch] = useState('');

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

  const applyDistances = (data: any[], lat?: number, lng?: number) => {
    const originLat = lat ?? userCoords?.lat;
    const originLng = lng ?? userCoords?.lng;
    if (originLat === undefined || originLng === undefined) return data;

    return data.map(w => {
      if (w.location) {
        let wLng, wLat;
        if (w.location.coordinates) {
          wLng = w.location.coordinates[0];
          wLat = w.location.coordinates[1];
        } else if (typeof w.location === 'string' && w.location.startsWith('POINT(')) {
          const match = w.location.match(/POINT\(([^ ]+)\s+([^)]+)\)/);
          if (match) {
            wLng = parseFloat(match[1]);
            wLat = parseFloat(match[2]);
          }
        } else if (w.location.lat !== undefined && w.location.lng !== undefined) {
          wLat = w.location.lat;
          wLng = w.location.lng;
        }
        if (wLng !== undefined && wLat !== undefined) {
          w.distance_meters = getDistance(originLat, originLng, wLat, wLng);
        }
      }
      return w;
    }).sort((a, b) => {
      if (a.distance_meters === undefined) return 1;
      if (b.distance_meters === undefined) return -1;
      return a.distance_meters - b.distance_meters;
    });
  };

  const loadWorkshops = async (lat: number, lng: number, r: number) => {
    setLoading(true);
    setLocationError(null);
    try {
      let data = await getNearbyWorkshops(lat, lng, r);
      
      // Si no encuentra nada cerca, mostramos todos para que el directorio no quede vacío
      if (data.length === 0) {
        setLocationError(`No se encontraron talleres a menos de ${r} km. A continuación se muestran todos los talleres registrados ordenados por distancia.`);
        data = await searchWorkshopsByName('');
        data = applyDistances(data, lat, lng);
      }

      setWorkshops(data);
    } catch (e) {
      console.error(e);
      setLocationError('Hubo un error al cargar los talleres.');
    } finally {
      setLoading(false);
    }
  };

  // Initial auto load without relying on map script init
  useEffect(() => {
    requestLocation();
  }, []);

  // Búsqueda global por texto (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = search.trim();
      if (q.length >= 2) {
        setLoading(true);
        try {
          let data = await searchWorkshopsByName(q);
          data = applyDistances(data); // Add distance to search results
          // Filter out anything beyond 100km if we have distance
          data = data.filter(w => w.distance_meters === undefined || w.distance_meters <= FIXED_RADIUS * 1000);
          setWorkshops(data);
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      } else if (q.length === 0 && userCoords) {
        loadWorkshops(userCoords.lat, userCoords.lng, FIXED_RADIUS);
      } else if (q.length === 0 && !userCoords) {
        // Just load all if no user coords yet
        searchWorkshopsByName('').then(data => setWorkshops(data));
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [search, userCoords]);

  const requestLocation = async () => {
    setLocationError(null);
    setLoading(true);

    const fallbackLocation = (errorMsg: string) => {
      const riobamba = { lat: -1.6635, lng: -78.6536 };
      setUserCoords(riobamba);
      setLocationError(`${errorMsg} Mostrando resultados en Riobamba.`);
      loadWorkshops(riobamba.lat, riobamba.lng, FIXED_RADIUS);
    };

    try {
      // First try IP-based location, which works more reliably on Tauri desktop apps
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        if (data.latitude && data.longitude) {
          const coords = { lat: data.latitude, lng: data.longitude };
          setUserCoords(coords);
          loadWorkshops(coords.lat, coords.lng, FIXED_RADIUS);
          return;
        }
      }
    } catch (e) {
      console.warn('IP location fetch failed, falling back to navigator.geolocation', e);
    }

    if (!navigator.geolocation) {
      fallbackLocation('Tu dispositivo no soporta geolocalización nativa.');
      return;
    }

    let timeoutRef: any;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (timeoutRef) clearTimeout(timeoutRef);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        loadWorkshops(coords.lat, coords.lng, FIXED_RADIUS);
      },
      () => {
        if (timeoutRef) clearTimeout(timeoutRef);
        fallbackLocation('No se pudo obtener tu ubicación por GPS.');
      },
      { timeout: 5000, maximumAge: 60000 }
    );

    timeoutRef = setTimeout(() => {
      fallbackLocation('Tiempo de espera agotado para obtener ubicación GPS.');
    }, 6000);
  };

  // El filtrado local ya no es necesario porque la búsqueda hace un fetch global debounced,
  // pero lo mantenemos ligero por si se usa en búsquedas cortas (< 2 chars)
  const filtered = search.trim().length >= 2 ? workshops : workshops.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.address ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Icon
        key={i}
        name={i < Math.round(rating) ? 'star' : 'star_border'}
        style={{ fontSize: '0.9rem', color: '#f59e0b' }}
      />
    ));
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Directorio de Talleres</h1>
          <p className={styles.pageSub}>Encuentra talleres de confianza cerca de ti en Chimborazo</p>
        </div>
        <button className={styles.primaryBtn} onClick={requestLocation} disabled={loading}>
          <Icon name="my_location" />
          {loading ? 'Buscando…' : 'Buscar cerca de mí'}
        </button>
      </div>

      {locationError && (
        <div className={styles.alertWarning}>
          <Icon name="warning" /> {locationError}
        </div>
      )}

      {/* Controles */}
      <div className={styles.controls}>
        <div className={styles.searchBox} style={{ flex: 1, maxWidth: '600px' }}>
          <Icon name="search" style={{ color: 'var(--color-outline)' }} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por nombre o dirección…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--color-on-surface)' }}>
          {search.trim().length >= 2 ? 'Resultados de búsqueda' : 'Talleres recomendados cerca de ti'}
        </h2>
      </div>

      {/* Lista de resultados */}
      <div className={styles.workshopGrid}>
        {filtered.length === 0 && !loading && (
          <div className={styles.emptyCard} style={{ gridColumn: '1 / -1' }}>
            <Icon name="search_off" style={{ fontSize: '3rem', opacity: 0.3 }} />
            <p>No se encontraron talleres que coincidan con tu búsqueda.</p>
          </div>
        )}
        {filtered.map(w => (
          <div key={w.workshop_id} className={styles.directoryCard} onClick={() => navigate(`/client/directory/${w.workshop_id}`)}>
            <div className={styles.directoryCardTop}>
              <div className={styles.workshopAvatarLg}>
                {w.logo_url
                  ? <img src={w.logo_url} alt={w.name} className={styles.workshopLogoImg} />
                  : <span>{w.name?.charAt(0)}</span>
                }
              </div>
              <div className={styles.directoryCardInfo}>
                <h3 className={styles.directoryCardName}>{w.name}</h3>
                <div className={styles.ratingRow}>
                  {renderStars(w.average_rating)}
                  <span className={styles.ratingCount}>({w.ratings_count})</span>
                </div>
                <p className={styles.directoryCardAddress}>
                  <Icon name="location_on" style={{ fontSize: '0.875rem' }} /> {w.address || 'Dirección no especificada'}
                </p>
              </div>
            </div>
            {w.distance_meters !== undefined ? (
              <div className={styles.distanceBadge}>
                <Icon name="near_me" /> {w.distance_meters < 1000
                  ? `${Math.round(w.distance_meters)} m`
                  : `${(w.distance_meters / 1000).toFixed(1)} km`}
              </div>
            ) : (
              <div className={styles.distanceBadge} style={{ opacity: 0.6, background: 'var(--color-surface-variant)', color: 'var(--color-on-surface-variant)' }}>
                <Icon name="location_off" /> Sin ubicación
              </div>
            )}
            {w.services_catalogue?.length > 0 && (
              <div className={styles.servicesRow}>
                {w.services_catalogue.slice(0, 3).map((s: any, i: number) => (
                  <span key={i} className={styles.serviceChip}>{s.name}</span>
                ))}
                {w.services_catalogue.length > 3 && <span className={styles.serviceChip}>+{w.services_catalogue.length - 3}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
