import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../Icon/Icon';
import logoBlue from '../../assets/logo-blue.jpg';
import styles from './Sidebar.module.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { signOut } = useAuth();

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`${styles.overlay} ${isOpen ? styles.open : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <img src={logoBlue} alt="AutoTech Logo" className={styles.logoImg} />
          </div>
          <span className={styles.brandName}>AutoTech</span>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navSection}>Módulos</div>

          <NavLink to="/agenda" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            <Icon name="calendar_month" className={styles.icon} />
            Agenda
          </NavLink>

          <NavLink to="/clients" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            <Icon name="group" className={styles.icon} />
            Gestión de Clientes
          </NavLink>

          <NavLink to="/vehicles" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            <Icon name="directions_car" className={styles.icon} />
            Vehículos
          </NavLink>

          <NavLink to="/inventory" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            <Icon name="inventory_2" className={styles.icon} />
            Inventario
          </NavLink>

          <NavLink to="/finance" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            <Icon name="account_balance_wallet" className={styles.icon} />
            Finanzas
          </NavLink>

          <NavLink to="/customization" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            <Icon name="dashboard_customize" className={styles.icon} />
            Personalización
          </NavLink>
        </nav>

        <div className={styles.bottomSection}>
          <NavLink to="/settings" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            <Icon name="manage_accounts" className={styles.icon} />
            Cuenta y Configuración
          </NavLink>

          <button onClick={() => signOut()} className={`${styles.actionBtn} ${styles.danger}`}>
            <Icon name="logout" className={styles.icon} />
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
};
