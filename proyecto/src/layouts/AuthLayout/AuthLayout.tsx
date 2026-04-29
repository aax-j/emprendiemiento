import { Outlet } from 'react-router-dom';
import styles from './AuthLayout.module.css';
import logoWhite from '../../assets/logo-white.jpg';

export const AuthLayout = () => {
  return (
    <div className={styles.authContainer}>
      <div className={styles.leftPane}>
        <div className={styles.logoIconWrapper} style={{ marginBottom: '2rem', width: '8rem', height: '8rem', overflow: 'hidden', borderRadius: '24px' }}>
          <img src={logoWhite} alt="AutoTech Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <h1 className={styles.brandName}>AutoTech</h1>
        <p className={styles.brandTagline}>The Precision Engine para la gestión de tu taller.</p>
      </div>
      <div className={styles.rightPane}>
        <div className={styles.card}>
          <div className={styles.logoMobile}>
            <div className={styles.logoIconWrapper} style={{ width: '5rem', height: '5rem', overflow: 'hidden', borderRadius: '16px' }}>
              <img src={logoWhite} alt="AutoTech Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h1 className={styles.mobileTitle}>AutoTech</h1>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
};
