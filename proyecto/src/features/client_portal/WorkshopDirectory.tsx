import { useState, useEffect, useRef } from 'react';
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
  const [radius, setRadius] = useState(20); // km
  const [search, setSearch] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);

  const loadWorkshops = async (lat: number, lng: number, r: number) => {
    setLoading(true);
    try {
      const data = await getNearbyWorkshops(lat, lng, r);
      setWorkshops(data);
      if (leafletMapRef.current && data.length > 0) {
        updateMapMarkers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Búsqueda global por texto (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = search.trim();
      if (q.length >= 2) {
        setLoading(true);
        try {
          const data = await searchWorkshopsByName(q);
          setWorkshops(data);
          if (leafletMapRef.current && data.length > 0 && data[0].location) {
             leafletMapRef.current.setView([data[0].location.lat, data[0].location.lng], 13);
             updateMapMarkers(data);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      } else if (q.length === 0 && userCoords) {
        loadWorkshops(userCoords.lat, userCoords.lng, radius);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [search, userCoords, radius]);

  const updateMapMarkers = (data: WorkshopEntry[]) => {
    // Remove previous markers — handled by Leaflet
    // Map markers are added during initialization or when data changes
    data.forEach((w: any) => {
      if (w.lat && w.lng && leafletMapRef.current) {
        (window as any).L?.marker([w.lat, w.lng])
          .addTo(leafletMapRef.current)
          .bindPopup(`<b>${w.name}</b><br/>${w.address ?? ''}`);
      }
    });
  };

  // Initialize Leaflet map after mount
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV/XN/WPjg=';
    script.crossOrigin = '';

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';

    document.head.appendChild(link);
    script.onload = () => {
      if (mapRef.current && !leafletMapRef.current) {
        const L = (window as any).L;
        const map = L.map(mapRef.current).setView([-1.6635, -78.6536], 13); // Centro: Riobamba
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
        leafletMapRef.current = map;
        
        // Auto-buscar al abrir
        requestLocation();
      }
    };
    document.head.appendChild(script);

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  const requestLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Tu dispositivo no soporta geolocalización.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        loadWorkshops(coords.lat, coords.lng, radius);
        leafletMapRef.current?.setView([coords.lat, coords.lng], 13);
      },
      () => {
        // Fallback: usar centro de Riobamba
        const riobamba = { lat: -1.6635, lng: -78.6536 };
        setUserCoords(riobamba);
        setLocationError('No se pudo obtener tu ubicación. Mostrando resultados en Riobamba.');
        loadWorkshops(riobamba.lat, riobamba.lng, radius);
      }
    );
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
        <div className={styles.searchBox}>
          <Icon name="search" style={{ color: 'var(--color-outline)' }} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por nombre o dirección…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.radiusControl}>
          <span className={styles.radiusLabel}>Radio: {radius} km</span>
          <input
            type="range" min={1} max={100} value={radius}
            onChange={e => {
              setRadius(Number(e.target.value));
              if (userCoords) loadWorkshops(userCoords.lat, userCoords.lng, Number(e.target.value));
            }}
            className={styles.rangeInput}
          />
        </div>
      </div>

      {/* Mapa Leaflet */}
      <div className={styles.mapContainer} ref={mapRef} />

      {/* Lista de resultados */}
      <div className={styles.workshopGrid}>
        {!userCoords && !loading && (
          <div className={styles.emptyCard} style={{ gridColumn: '1 / -1' }}>
            <Icon name="location_searching" style={{ fontSize: '3rem', opacity: 0.3 }} />
            <p>Haz clic en "Buscar cerca de mí" para encontrar talleres en tu área.</p>
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
                {w.address && (
                  <p className={styles.directoryCardAddress}>
                    <Icon name="location_on" style={{ fontSize: '0.875rem' }} /> {w.address}
                  </p>
                )}
              </div>
            </div>
            {w.distance_meters !== undefined && (
              <div className={styles.distanceBadge}>
                <Icon name="near_me" /> {w.distance_meters < 1000
                  ? `${Math.round(w.distance_meters)} m`
                  : `${(w.distance_meters / 1000).toFixed(1)} km`}
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
