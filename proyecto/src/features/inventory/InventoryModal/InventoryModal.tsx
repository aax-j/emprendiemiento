import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { createInventoryItem, updateInventoryItem, InventoryItem } from '../../../lib/api/inventory';
import { Icon } from '../../../components/Icon/Icon';
import styles from './InventoryModal.module.css';

interface InventoryModalProps {
  item?: InventoryItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({ item, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [name, setName] = useState(item?.name ?? '');
  const [itemType, setItemType] = useState(item?.item_type ?? 'repuesto');
  const [price, setPrice] = useState(item?.price?.toString() ?? '');
  const [stock, setStock] = useState(item?.stock?.toString() ?? '0');
  const [minStockAlert, setMinStockAlert] = useState(item?.min_stock_alert?.toString() ?? '5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.workshop_id) return;
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name,
        item_type: itemType,
        price: parseFloat(price) || 0,
        stock: parseInt(stock, 10) || 0,
        min_stock_alert: parseInt(minStockAlert, 10) || 0,
      };

      if (item) {
        await updateInventoryItem(item.id, payload);
      } else {
        await createInventoryItem(payload, profile.workshop_id);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{item ? 'Editar Ítem' : 'Nuevo Ítem'}</h3>
          <button className={styles.closeBtn} onClick={onClose}><Icon name="close" /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.body}>
            {error && <div className={styles.errorBox}>{error}</div>}

            <div className={styles.inputGroup}>
              <label className={styles.label}>Nombre del ítem / Servicio *</label>
              <input
                type="text"
                className={styles.input}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Filtro de aceite, Pastillas de freno, Mano de obra..."
                required
                autoFocus
              />
            </div>

            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Tipo</label>
                <select 
                  className={styles.input}
                  value={itemType}
                  onChange={e => setItemType(e.target.value)}
                >
                  <option value="repuesto">Pieza / Repuesto</option>
                  <option value="servicio">Servicio / Mano de obra</option>
                </select>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Precio Base ($)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Stock Actual</label>
                <input
                  type="number"
                  className={styles.input}
                  value={stock}
                  onChange={e => setStock(e.target.value)}
                  min="0"
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Alerta de Stock Mínimo</label>
                <input
                  type="number"
                  className={styles.input}
                  value={minStockAlert}
                  onChange={e => setMinStockAlert(e.target.value)}
                  min="0"
                />
              </div>
            </div>
            
            <p className={styles.helperText}>
              <Icon name="info" style={{ fontSize: '1rem' }} />
              El precio base se usará por defecto en las reparaciones, pero podrás modificarlo según sea el caso.
            </p>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={loading || !name}>
              {loading ? 'Guardando...' : 'Guardar Ítem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
