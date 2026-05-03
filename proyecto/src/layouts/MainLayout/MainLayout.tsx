import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { useAuth } from '../../contexts/AuthContext';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { TopAppBar } from '../../components/TopAppBar/TopAppBar';
import { Icon } from '../../components/Icon/Icon';
import styles from './MainLayout.module.css';

export const MainLayout = () => {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [botStatus, setBotStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');

  useEffect(() => {
    if (!profile?.workshop_id) return;

    const initializeBot = async () => {
      const workshopId = profile.workshop_id;
      try {
        // 1. Sync Customization Configuration
        try {
          const configPath = 'chatbot-config.json';
          const content = await readTextFile(configPath, { baseDir: BaseDirectory.AppData });
          const parsedConfig = JSON.parse(content);
          
          await fetch(`http://127.0.0.1:3001/api/config/${workshopId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsedConfig)
          });
        } catch (e) {}

        // 2. Status polling
        const checkStatus = async () => {
          try {
            const res = await fetch(`http://127.0.0.1:3001/api/status/${workshopId}`);
            const data = await res.json();
            setBotStatus(data.status === 'ready' ? 'connected' : 'disconnected');
          } catch (e) {
            setBotStatus('disconnected');
          }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 10000); // Cada 10 segundos
        return () => clearInterval(interval);
      } catch (err) {}
    };

    initializeBot();
  }, [profile?.workshop_id]);

  const showDisconnectAlert = botStatus === 'disconnected' && location.pathname !== '/settings';

  return (
    <div className={styles.layout}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className={styles.mainContent}>
        <TopAppBar onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        
        <main className={styles.scrollArea}>
          <Outlet />
        </main>
      </div>

      {showDisconnectAlert && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'var(--color-surface)',
            padding: '2.5rem',
            borderRadius: '1.25rem',
            maxWidth: '450px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            border: '1px solid var(--color-outline-variant)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              borderRadius: '50%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              margin: '0 auto 1.5rem auto'
            }}>
              <Icon name="block" style={{ fontSize: '32px' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--color-on-surface)' }}>WhatsApp Desconectado</h2>
            <p style={{ color: 'var(--color-on-surface-variant)', marginBottom: '2rem', lineHeight: '1.5' }}>
              El bot de atención automática se encuentra fuera de línea. Tus clientes no están recibiendo respuestas automáticas en este momento.
            </p>
            <button 
              onClick={() => navigate('/settings')}
              style={{
                background: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 2rem',
                borderRadius: '0.75rem',
                fontWeight: '600',
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                width: '100%'
              }}
            >
              <Icon name="link" />
              Ir a Configuración y Conectar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
