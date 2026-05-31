import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../../components/Icon/Icon';
import logoBlue from '../../assets/logo-blue.jpg';
import styles from './ClientLayout.module.css';

export const ClientLayout = () => {
  const { profile, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className={styles.layout}>
      {/* Mobile overlay */}
      <div
        className={`${styles.overlay} ${isSidebarOpen ? styles.open : ''}`}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar B2C */}
      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.open : ''}`}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <img src={logoBlue} alt="AutoTech Logo" className={styles.logoImg} />
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>AutoTech</span>
            <span className={styles.brandSub}>Portal de Cliente</span>
          </div>
        </div>

        {/* Tag del cliente */}
        {profile?.client_tag && (
          <div className={styles.tagCard}>
            <span className={styles.tagLabel}>Tu ID de Cliente</span>
            <span className={styles.tagValue}>{profile.client_tag}</span>
          </div>
        )}

        <nav className={styles.nav}>
          <div className={styles.navSection}>Mi Cuenta</div>

          <NavLink to="/client/dashboard" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            <Icon name="dashboard" className={styles.icon} />
            Panel Principal
          </NavLink>

          <NavLink to="/client/vehicles" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            <Icon name="directions_car" className={styles.icon} />
            Mis Vehículos
          </NavLink>

          <div className={styles.navSection}>Talleres</div>

          <NavLink to="/client/directory" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            <Icon name="location_on" className={styles.icon} />
            Directorio de Talleres
          </NavLink>

          <NavLink to="/client/connections" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            <Icon name="handshake" className={styles.icon} />
            Mis Conexiones
          </NavLink>
        </nav>

        <div className={styles.bottomSection}>
          <div className={styles.profileRow}>
            <div className={styles.avatarCircle}>
              {profile?.full_name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className={styles.profileMeta}>
              <span className={styles.profileName}>{profile?.full_name ?? 'Cliente'}</span>
              <span className={styles.profileEmail}>{profile?.phone ?? ''}</span>
            </div>
          </div>
          <button onClick={signOut} className={`${styles.actionBtn} ${styles.danger}`}>
            <Icon name="logout" className={styles.icon} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={styles.mainContent}>
        {/* Top bar móvil */}
        <header className={styles.topBar}>
          <button
            className={styles.menuBtn}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Menú"
          >
            <Icon name="menu" />
          </button>
          <span className={styles.topBarTitle}>AutoTech</span>
          {profile?.client_tag && (
            <span className={styles.topBarTag}>{profile.client_tag}</span>
          )}
        </header>

        <main className={styles.scrollArea}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
