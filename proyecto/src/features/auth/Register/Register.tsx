import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import styles from '../Login/Login.module.css'; // Reusing Login styles for consistency

export const Register = () => {
  const navigate = useNavigate();
  const { session, loading: authLoading, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (!data.session) {
      // Si Supabase requiere confirmación de email, la sesión será null.
      // Navegamos al login para que el usuario pueda entrar después.
      navigate('/login');
    }
    // Si hay data.session, el auto-login está activado. 
    // Dejamos que el useEffect de abajo maneje la redirección.
  };

  // Redirect automatically when session and profile are fully loaded (Auto-login after signup)
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
        <h2 className={styles.title}>Crear Cuenta</h2>
        <p className={styles.subtitle}>Regístrate para usar Autotech SaaS</p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <form className={styles.form} onSubmit={handleRegister}>
        <div className={styles.inputGroup}>
          <label htmlFor="fullName" className={styles.label}>Nombre Completo</label>
          <input
            id="fullName"
            type="text"
            className={styles.input}
            placeholder="Juan Pérez"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

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
            minLength={6}
          />
        </div>

        <button 
          type="submit" 
          className={styles.submitBtn}
          disabled={loading}
        >
          {loading ? 'Creando...' : 'Registrarse'}
        </button>
      </form>

      <div className={styles.footer}>
        ¿Ya tienes cuenta? <Link to="/login" className={styles.link}>Inicia sesión</Link>
      </div>
    </div>
  );
};
