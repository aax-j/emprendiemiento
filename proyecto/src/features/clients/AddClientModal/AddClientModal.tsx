import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { createClient } from '../../../lib/api/clients';
import { Icon } from '../../../components/Icon/Icon';
import styles from './AddClientModal.module.css';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddClientModal: React.FC<AddClientModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.workshop_id) return;

    setLoading(true);
    setError(null);

    try {
      await createClient({
        full_name: fullName,
        phone: phone || null,
        email: email || null,
        notes: null,
      }, profile.workshop_id);
      
      onSuccess();
      onClose();
      // Reset form
      setFullName('');
      setPhone('');
      setEmail('');
    } catch (err: any) {
      console.error("Error creating client:", err);
      setError(err.message || 'Error al guardar el cliente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3 className={styles.title}>Nuevo Cliente</h3>
          <button className={styles.closeButton} onClick={onClose} type="button">
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.form}>
            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.inputGroup}>
              <label htmlFor="clientName" className={styles.label}>Nombre Completo *</label>
              <input
                id="clientName"
                type="text"
                className={styles.input}
                placeholder="Ej: María García"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="clientPhone" className={styles.label}>Teléfono</label>
              <input
                id="clientPhone"
                type="tel"
                className={styles.input}
                placeholder="+52 55 1234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="clientEmail" className={styles.label}>Correo Electrónico</label>
              <input
                id="clientEmail"
                type="email"
                className={styles.input}
                placeholder="maria@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.footer}>
            <button 
              type="button" 
              className={styles.cancelBtn} 
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className={styles.submitBtn}
              disabled={loading || !fullName}
            >
              {loading ? 'Guardando...' : 'Guardar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
