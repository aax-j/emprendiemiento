import { useState, useMemo } from 'react';
import { RepairHistory } from '../../../lib/api/repairs';
import { Icon } from '../../../components/Icon/Icon';
import styles from './CalendarView.module.css';

interface CalendarViewProps {
  events: (RepairHistory & { vehicles?: any })[];
  onSelectEvent: (event: RepairHistory & { vehicles?: any }) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ events, onSelectEvent }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const days = useMemo(() => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    // Adjust to start on Monday (0 is Sunday in JS, we want 1)
    let startDay = startOfMonth.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1; // 0=Mon, 6=Sun

    const prevMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
    
    const calendarDays = [];

    // Prev month days
    for (let i = startDay - 1; i >= 0; i--) {
      calendarDays.push({
        date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthEnd.getDate() - i),
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= endOfMonth.getDate(); i++) {
      calendarDays.push({
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i),
        isCurrentMonth: true
      });
    }

    // Next month days
    const remaining = 42 - calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
      calendarDays.push({
        date: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i),
        isCurrentMonth: false
      });
    }

    return calendarDays;
  }, [currentDate]);

  const monthName = currentDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  const getEventsForDay = (date: Date) => {
    return events.filter(wo => {
      // Agregar manejo de timezone eliminando la porción de tiempo para la comparación
      // o usar los métodos UTC. Dado que start_date viene como 'YYYY-MM-DD', new Date('YYYY-MM-DD')
      // asume UTC, así que necesitamos asegurarnos de comparar correctamente.
      const startParts = (wo.start_date || wo.created_at).split('T')[0].split('-');
      const year = parseInt(startParts[0]);
      const month = parseInt(startParts[1]) - 1; // 0-indexed
      const day = parseInt(startParts[2]);

      return (
        day === date.getDate() &&
        month === date.getMonth() &&
        year === date.getFullYear()
      );
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.nav}>
        <h2 className={styles.monthTitle}>{monthName}</h2>
        <div className={styles.navBtns}>
          <button className={`${styles.navBtn} ${styles.todayBtn}`} onClick={() => setCurrentDate(new Date())}>Hoy</button>
          <button className={styles.navBtn} onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}>
            <Icon name="chevron_left" />
          </button>
          <button className={styles.navBtn} onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}>
            <Icon name="chevron_right" />
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
          <div key={day} className={styles.dayName}>{day}</div>
        ))}
        {days.map((day, idx) => {
          const events = getEventsForDay(day.date);
          return (
            <div 
              key={idx} 
              className={`${styles.cell} ${!day.isCurrentMonth ? styles.notCurrentMonth : ''} ${isToday(day.date) ? styles.isToday : ''}`}
            >
              <span className={styles.dayNumber}>{day.date.getDate()}</span>
              {events.map(event => (
                <div 
                  key={event.id} 
                  className={`${styles.event} ${styles[`status_${event.status}`]}`}
                  onClick={() => onSelectEvent(event)}
                  title={`${event.vehicles?.plate} - ${event.description}`}
                >
                  {event.vehicles?.plate}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};
