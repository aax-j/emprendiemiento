import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { TopAppBar } from '../../components/TopAppBar/TopAppBar';
import styles from './MainLayout.module.css';

export const MainLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className={styles.layout}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className={styles.mainContent}>
        <TopAppBar onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        
        <main className={styles.scrollArea}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
