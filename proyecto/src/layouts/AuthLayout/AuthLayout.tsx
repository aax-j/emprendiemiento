import { Outlet } from 'react-router-dom';
import styles from './AuthLayout.module.css';
import { Icon } from '../../components/Icon/Icon';

export const AuthLayout = () => {
  return (
    <div className={styles.authContainer}>
      <div className={styles.leftPane}>
        <div className={styles.logoIconWrapper} style={{ marginBottom: '2rem', width: '4rem', height: '4rem' }}>
          <Icon name="precision_manufacturing" className="display-lg" style={{ fontSize: '2rem' }} />
        </div>
        <h1 className={styles.brandName}>AutoTech</h1>
        <p className={styles.brandTagline}>The Precision Engine para la gestión de tu taller.</p>
      </div>
      <div className={styles.rightPane}>
        <div className={styles.card}>
          <div className={styles.logoMobile}>
            <div className={styles.logoIconWrapper}>
              <Icon name="precision_manufacturing" />
            </div>
            <h1 className={styles.mobileTitle}>AutoTech</h1>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
};
