import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../Icon/Icon';
import styles from './TopAppBar.module.css';

interface TopAppBarProps {
  onMenuClick?: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({ onMenuClick }) => {
  const { profile } = useAuth();

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.leftArea}>
        <button className={styles.menuBtn} onClick={onMenuClick} aria-label="Abrir menú">
          <Icon name="menu" />
        </button>
        <div className={styles.workshopName}>
          AutoTech SaaS
        </div>
      </div>

      <div className={styles.rightArea}>
        <button className={styles.iconBtn} aria-label="Notificaciones">
          <Icon name="notifications" />
        </button>

        <div className={styles.profileArea}>
          <div className={styles.avatar}>
            {getInitials(profile?.full_name || '')}
          </div>
        </div>
      </div>
    </header>
  );
};
