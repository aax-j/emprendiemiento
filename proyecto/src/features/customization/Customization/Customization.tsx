import { useTheme } from '../../../contexts/ThemeContext';
import { Icon } from '../../../components/Icon/Icon';
import styles from './Customization.module.css';

export const Customization = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Personalización</h1>
        <p className={styles.subtitle}>Ajusta la apariencia de la aplicación a tu gusto</p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Tema de la Aplicación</h2>
        <p className={styles.sectionDesc}>Selecciona cómo quieres que se vea AutoTech en tu pantalla.</p>

        <div className={styles.themeGrid}>
          {/* Light Theme Card */}
          <button
            className={`${styles.themeCard} ${theme === 'light' ? styles.selected : ''}`}
            onClick={() => setTheme('light')}
          >
            <div className={styles.themePreview} data-preview="light">
              <div className={styles.previewSidebar} />
              <div className={styles.previewContent}>
                <div className={styles.previewBar} />
                <div className={styles.previewCard} />
                <div className={styles.previewCard} style={{ width: '70%' }} />
              </div>
            </div>
            <div className={styles.themeInfo}>
              <div className={styles.themeNameRow}>
                <Icon name="light_mode" style={{ fontSize: '1.25rem' }} />
                <span className={styles.themeName}>Modo Claro</span>
              </div>
              {theme === 'light' && (
                <span className={styles.activeChip}>
                  <Icon name="check_circle" style={{ fontSize: '0.875rem' }} />
                  Activo
                </span>
              )}
            </div>
          </button>

          {/* Dark Theme Card */}
          <button
            className={`${styles.themeCard} ${theme === 'dark' ? styles.selected : ''}`}
            onClick={() => setTheme('dark')}
          >
            <div className={styles.themePreview} data-preview="dark">
              <div className={styles.previewSidebar} style={{ background: '#1c2022' }} />
              <div className={styles.previewContent} style={{ background: '#0f1416' }}>
                <div className={styles.previewBar} style={{ background: '#1c2022' }} />
                <div className={styles.previewCard} style={{ background: '#1c2022' }} />
                <div className={styles.previewCard} style={{ width: '70%', background: '#1c2022' }} />
              </div>
            </div>
            <div className={styles.themeInfo}>
              <div className={styles.themeNameRow}>
                <Icon name="dark_mode" style={{ fontSize: '1.25rem' }} />
                <span className={styles.themeName}>Modo Oscuro</span>
              </div>
              {theme === 'dark' && (
                <span className={styles.activeChip}>
                  <Icon name="check_circle" style={{ fontSize: '0.875rem' }} />
                  Activo
                </span>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
