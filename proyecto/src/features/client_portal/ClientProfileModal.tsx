import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../../components/Icon/Icon';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ClientProfileModal = ({ isOpen, onClose }: Props) => {
  const { profile, user, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone: phone || null })
        .eq('id', profile.id);
        
      if (error) throw error;
      await refreshProfile();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div onClick={onClose} style={{ zIndex: 3000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-surface)', padding: '2rem', borderRadius: '1rem', width: '90%', maxWidth: '400px', border: '1px solid var(--color-outline-variant)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-on-surface)' }}>Editar Mi Perfil</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-on-surface-variant)' }}><Icon name="close" /></button>
        </div>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</div>}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-on-surface)' }}>Nombre Completo</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-on-surface)' }}>Teléfono</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-on-surface)' }}>Correo Electrónico</label>
            <input type="email" value={user?.email || ''} readOnly style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-variant)', color: 'var(--color-on-surface-variant)', cursor: 'not-allowed' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-on-surface-variant)', fontWeight: 500 }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem', background: 'var(--color-primary)', color: 'var(--color-on-primary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
