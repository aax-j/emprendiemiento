import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Icon } from '../../../components/Icon/Icon';
import styles from './SetupWorkshop.module.css';

export const SetupWorkshop = () => {
  const navigate = useNavigate();
  const { user, refreshProfile, signOut } = useAuth();
  const [workshopName, setWorkshopName] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setError(null);
    setLoading(true);

    try {
      // Create a timeout promise
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('La base de datos no responde (Tiempo excedido). Verifica tu conexión y tu Llave API.')), 10000)
      );

      // 1. Create the workshop with timeout safety
      const createWorkshopPromise = supabase
        .from('workshops')
        .insert([{ name: workshopName }])
        .select()
        .single();

      const { data: workshopData, error: workshopError } = await Promise.race([
        createWorkshopPromise,
        timeout
      ]) as any;

      if (workshopError) throw workshopError;
      
      console.log('Taller creado con éxito:', workshopData.id);

      // 2. Create the user profile linked to the workshop
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: user.id,
          workshop_id: workshopData.id,
          full_name: fullName,
          role: 'admin' // First user is always admin
        }]);

      if (profileError) throw profileError;

      // 3. Refresh context and redirect
      await refreshProfile();
      navigate('/');
      
    } catch (err: any) {
      console.error('Error during setup:', err);
      setError(err.message || 'Ocurrió un error al configurar tu taller.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <Icon name="storefront" style={{ fontSize: '2rem' }} />
          </div>
          <h1 className={styles.title}>Configura tu Taller</h1>
          <p className={styles.subtitle}>
            Para empezar a usar AutoTech, necesitamos crear el espacio de trabajo para tu negocio.
          </p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form className={styles.form} onSubmit={handleSetup}>
          <div className={styles.inputGroup}>
            <label htmlFor="workshopName" className={styles.label}>Nombre de tu Taller</label>
            <input
              id="workshopName"
              type="text"
              className={styles.input}
              placeholder="Ej: AutoTech Motors Elite"
              value={workshopName}
              onChange={(e) => setWorkshopName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="fullName" className={styles.label}>Tu Nombre Completo</label>
            <input
              id="fullName"
              type="text"
              className={styles.input}
              placeholder="Ej: Juan Pérez"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'Configurando...' : 'Crear Taller y Continuar'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button 
            onClick={async () => {
              setLoading(false); // Unblock UI just in case
              await signOut();
            }} 
            className={styles.logoutBtn}
            type="button"
            style={{ cursor: 'pointer', background: 'none', border: 'none' }}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
};
