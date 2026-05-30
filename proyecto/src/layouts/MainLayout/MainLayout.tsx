import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { useAuth } from '../../contexts/AuthContext';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { TopAppBar } from '../../components/TopAppBar/TopAppBar';
import { getBotApiUrl } from '../../lib/api/bot';
import styles from './MainLayout.module.css';

export const MainLayout = () => {
  const { profile } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [botStatus, setBotStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');

  useEffect(() => {
    if (!profile?.workshop_id) return;

    const initializeBot = async () => {
      const workshopId = profile.workshop_id;
      try {
        // 1. Sync Customization Configuration
        try {
          const content = await readTextFile('chatbot-config.json', { baseDir: BaseDirectory.AppData });
          const parsedConfig = JSON.parse(content);
          await fetch(`${getBotApiUrl()}/api/config/${workshopId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsedConfig),
          });
        } catch {}

        // 2. Status polling
        const checkStatus = async () => {
          try {
            const res = await fetch(`${getBotApiUrl()}/api/status/${workshopId}`, {
              signal: AbortSignal.timeout(3000),
            });
            const data = await res.json();
            setBotStatus(data.status === 'ready' ? 'connected' : 'disconnected');
          } catch {
            setBotStatus('disconnected');
          }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 10000);
        return () => clearInterval(interval);
      } catch {}
    };

    initializeBot();
  }, [profile?.workshop_id]);

  // No mostrar la notificación cuando el usuario ya está en Configuración
  const activeBotStatus = location.pathname === '/settings' ? 'loading' : botStatus;

  return (
    <div className={styles.layout}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className={styles.mainContent}>
        <TopAppBar
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
          botStatus={activeBotStatus}
        />

        <main className={styles.scrollArea}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
