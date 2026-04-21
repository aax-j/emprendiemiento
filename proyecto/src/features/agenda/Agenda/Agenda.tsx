import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { getAllRepairs, RepairHistory } from '../../../lib/api/repairs';
import { Icon } from '../../../components/Icon/Icon';
import { CalendarView } from '../CalendarView/CalendarView';
import { BoardView } from '../BoardView/BoardView';
import { ScheduleModal } from '../ScheduleModal/ScheduleModal';
import { WorkOrderDetailModal } from './WorkOrderDetailModal';
import styles from './Agenda.module.css';

type ViewMode = 'calendar' | 'board';

export const Agenda = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [events, setEvents] = useState<(RepairHistory & { vehicles?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<(RepairHistory & { vehicles?: any }) | null>(null);

  const fetchAgendaEvents = async () => {
    if (!profile?.workshop_id) return;
    setLoading(true);
    try {
      const repairs = await getAllRepairs(profile.workshop_id);

      // Normalizar reparaciones del historial para la Agenda
      const normalizedRepairs = (repairs || []).map(r => {
        let status = r.status;
        if (status === 'open') status = 'pendiente';
        if (status === 'in_progress') status = 'en_proceso';
        if (status === 'completed') status = 'completado';

        return {
          ...r,
          status: status,
          // Si no tiene start_date, usamos created_at
          start_date: r.start_date || r.created_at,
        };
      });

      // Ordenar por fecha
      normalizedRepairs.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

      setEvents(normalizedRepairs);
    } catch (err) {
      console.error("Error al cargar agenda:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgendaEvents();
  }, [profile]);

  const handleViewVehicle = (vehicleId: string) => {
    // Navigate to vehicles list and we'll handle selection there via state/search or URL
    navigate(`/vehicles?id=${vehicleId}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Agenda</h1>
          <p className={styles.subtitle}>Gestiona tus citas y reparaciones programadas</p>
        </div>

        <div className={styles.actions}>
          <div className={styles.viewSwitcher}>
            <button 
              className={`${styles.viewBtn} ${viewMode === 'calendar' ? styles.activeView : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              <span className={styles.btnContent}>
                <Icon name="calendar_month" style={{ fontSize: '1.125rem' }} />
                Calendario
              </span>
            </button>
            <button 
              className={`${styles.viewBtn} ${viewMode === 'board' ? styles.activeView : ''}`}
              onClick={() => setViewMode('board')}
            >
              <span className={styles.btnContent}>
                <Icon name="view_kanban" style={{ fontSize: '1.125rem' }} />
                Paneles
              </span>
            </button>
          </div>

          <button className={styles.primaryBtn} onClick={() => setShowModal(true)}>
            <Icon name="add" style={{ fontSize: '1.25rem' }} />
            Agendar Cita
          </button>
        </div>
      </div>

      <div className={styles.viewContainer}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ color: 'var(--color-outline)' }}>Cargando agenda...</p>
          </div>
        ) : viewMode === 'calendar' ? (
          <CalendarView 
            events={events} 
            onSelectEvent={setSelectedEvent} 
          />
        ) : (
          <BoardView 
            events={events} 
            onSelectEvent={setSelectedEvent} 
          />
        )}
      </div>

      {showModal && (
        <ScheduleModal 
          onClose={() => setShowModal(false)} 
          onSuccess={fetchAgendaEvents}
        />
      )}

      {selectedEvent && (
        <WorkOrderDetailModal 
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRefresh={fetchAgendaEvents}
          onViewVehicleHistory={handleViewVehicle}
        />
      )}
    </div>
  );
};
