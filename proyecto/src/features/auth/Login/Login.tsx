import { useState, useEffect } from 'react';
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

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
      } else if (!data?.session) {
        setError("Inicio de sesión exitoso, pero no se obtuvo sesión. ¿Quizás falta confirmar tu correo?");
        setLoading(false);
      }
      // Si todo sale bien, onAuthStateChange de AuthContext actualizará session y authLoading
      // lo que disparará el Navigate de abajo.
    } catch (err: any) {
      setError(err.message || 'Error inesperado al iniciar sesión');
      setLoading(false);
    }
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
