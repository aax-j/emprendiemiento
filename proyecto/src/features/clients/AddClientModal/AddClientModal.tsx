import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { createClient } from '../../../lib/api/clients';
import { supabase } from '../../../lib/supabase';
import { Icon } from '../../../components/Icon/Icon';
import styles from './AddClientModal.module.css';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const COUNTRY_CODES = [
  { code: '593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '57', flag: '🇨🇴', name: 'Colombia' },
  { code: '51', flag: '🇵🇪', name: 'Perú' },
  { code: '54', flag: '🇦🇷', name: 'Argentina' },
  { code: '56', flag: '🇨🇱', name: 'Chile' },
  { code: '52', flag: '🇲🇽', name: 'México' },
  { code: '34', flag: '🇪🇸', name: 'España' },
  { code: '1', flag: '🇺🇸', name: 'USA' },
];

export const AddClientModal: React.FC<AddClientModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState('593');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workshopName, setWorkshopName] = useState<string>('nuestro taller');

  useEffect(() => {
    if (isOpen && profile?.workshop_id) {
      supabase
        .from('workshops')
        .select('name')
        .eq('id', profile.workshop_id)
        .single()
        .then(({ data }) => {
          if (data?.name) setWorkshopName(data.name);
        });
    }
  }, [isOpen, profile?.workshop_id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.workshop_id) return;

    setLoading(true);
    setError(null);

    try {
      // Limpiar el número de cualquier 0 inicial si el usuario lo puso por error
      const cleanPhone = phone.replace(/^0+/, '').replace(/\D/g, '');
      const fullPhone = countryCode + cleanPhone;

      const newClient = await createClient({
        full_name: fullName,
        phone: fullPhone || null,
        email: email || null,
        notes: null,
      }, profile.workshop_id);
      
      // Enviar bienvenida vía Bot
      if (fullPhone && newClient?.id) {
        try {
          await fetch('http://127.0.0.1:3001/api/send-welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: fullPhone,
              clientName: fullName,
              workshopName: workshopName,
              clientId: newClient.id,
              workshopId: profile.workshop_id
            })
          });
        } catch (botErr) {
          console.error('Bot offline:', botErr);
        }
      }

      onSuccess();
      onClose();
      setFullName('');
      setPhone('');
      setEmail('');
    } catch (err: any) {
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
              <label className={styles.label}>Nombre Completo *</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Ej: María García"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Teléfono WhatsApp</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select 
                  value={countryCode} 
                  onChange={(e) => setCountryCode(e.target.value)}
                  className={styles.input}
                  style={{ width: '110px', fontSize: '0.9rem' }}
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.flag} +{c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  className={styles.input}
                  placeholder="990715214"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--color-outline)', marginTop: '0.25rem' }}>
                No incluyas el 0 inicial ni el símbolo +.
              </p>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Correo Electrónico</label>
              <input
                type="email"
                className={styles.input}
                placeholder="maria@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className={styles.submitBtn} disabled={loading || !fullName}>
              {loading ? 'Guardando...' : 'Guardar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
