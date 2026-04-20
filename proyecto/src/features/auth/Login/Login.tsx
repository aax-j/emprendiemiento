import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import styles from './Login.module.css';

export const Login = () => {
  const { session, loading: authLoading, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // No navegamos manualmente aquí. Esperamos a que el AuthContext actualice su estado
    // y el useEffect de abajo se encargue de la redirección correcta.
  };

  // Redirect automatically when session and profile are fully loaded
  if (session && !authLoading) {
    if (profile && profile.workshop_id) {
      return <Navigate to="/" replace />;
    } else {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Iniciar Sesión</h2>
        <p className={styles.subtitle}>Ingresa tus credenciales para acceder</p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <form className={styles.form} onSubmit={handleLogin}>
        <div className={styles.inputGroup}>
          <label htmlFor="email" className={styles.label}>Correo Electrónico</label>
          <input
            id="email"
            type="email"
            className={styles.input}
            placeholder="taller@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="password" className={styles.label}>Contraseña</label>
          <input
            id="password"
            type="password"
            className={styles.input}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button 
          type="submit" 
          className={styles.submitBtn}
          disabled={loading}
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <div className={styles.footer}>
        ¿No tienes cuenta? <Link to="/register" className={styles.link}>Regístrate aquí</Link>
      </div>
    </div>
  );
};
