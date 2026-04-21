import { useState, useEffect } from 'react';
import { getInventory, InventoryItem, RepairItem } from '../../../lib/api/inventory';
import { Icon } from '../../../components/Icon/Icon';
import styles from './VehicleDetail.module.css';

interface RepairItemsManagerProps {
  workshopId: string;
  items: Omit<RepairItem, 'id' | 'repair_id' | 'inventory'>[];
  onChange: (items: Omit<RepairItem, 'id' | 'repair_id' | 'inventory'>[]) => void;
  onCostChange: (totalCost: number) => void;
}

export const RepairItemsManager: React.FC<RepairItemsManagerProps> = ({ workshopId, items, onChange, onCostChange }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState<number | ''>('');

  useEffect(() => {
    getInventory(workshopId).then(setInventory).catch(console.error);
  }, [workshopId]);

  // Cuando se selecciona un item, prellenamos el precio
  const handleItemSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedItemId(id);
    const found = inventory.find(i => i.id === id);
    if (found) {
      setCustomPrice(found.price);
    } else {
      setCustomPrice('');
    }
  };

  const handleAdd = () => {
    if (!selectedItemId || customPrice === '') return;
    
    const invItem = inventory.find(i => i.id === selectedItemId);
    if (!invItem) return;

    // Check if item is already added
    const existingIdx = items.findIndex(i => i.inventory_id === selectedItemId);
    let newItems = [...items];
    
    if (existingIdx >= 0) {
      // Just update it if it exists
      newItems[existingIdx].quantity += quantity;
      newItems[existingIdx].unit_price = Number(customPrice);
    } else {
      newItems.push({
        inventory_id: selectedItemId,
        quantity,
        unit_price: Number(customPrice),
        // We temporarily store the name in a non-standard property just for UI rendering before save
        _name: invItem.name, 
        _type: invItem.item_type
      } as any);
    }
    
    onChange(newItems);
    calculateTotal(newItems);
    
    // Reset form
    setSelectedItemId('');
    setQuantity(1);
    setCustomPrice('');
  };

  const handleRemove = (idx: number) => {
    const newItems = items.filter((_, i) => i !== idx);
    onChange(newItems);
    calculateTotal(newItems);
  };

  const calculateTotal = (currentItems: any[]) => {
    const total = currentItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
    onCostChange(total);
  };

  return (
    <div className={styles.infoSection} style={{ marginTop: '1rem', borderTop: '1px solid var(--color-outline-variant)', paddingTop: '1rem' }}>
      <h4 className={styles.sectionLabel}>Piezas y Servicios (Inventario)</h4>
      
      <div className={styles.formRow} style={{ alignItems: 'flex-end', marginBottom: '1rem' }}>
        <div className={styles.inputGroup} style={{ flex: 2 }}>
          <label className={styles.label}>Seleccionar Ítem</label>
          <select className={styles.input} value={selectedItemId} onChange={handleItemSelect}>
            <option value="">-- Elige una pieza o servicio --</option>
            {inventory.map(inv => (
              <option key={inv.id} value={inv.id}>{inv.name} (Stock: {inv.stock})</option>
            ))}
          </select>
        </div>
        
        <div className={styles.inputGroup} style={{ flex: 1 }}>
          <label className={styles.label}>Cantidad</label>
          <input 
            type="number" 
            className={styles.input} 
            value={quantity} 
            onChange={e => setQuantity(Number(e.target.value))}
            min={1}
          />
        </div>

        <div className={styles.inputGroup} style={{ flex: 1 }}>
          <label className={styles.label}>Precio Venta</label>
          <input 
            type="number" 
            className={styles.input} 
            value={customPrice} 
            onChange={e => setCustomPrice(e.target.value === '' ? '' : Number(e.target.value))}
            step="0.01"
            min={0}
          />
        </div>

        <button 
          type="button" 
          className={styles.secondaryBtn} 
          onClick={handleAdd}
          disabled={!selectedItemId || customPrice === ''}
          style={{ height: '42px' }}
        >
          <Icon name="add" />
        </button>
      </div>

      {items.length > 0 && (
        <div style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-md)', padding: '0.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ color: 'var(--color-outline)', textAlign: 'left', borderBottom: '1px solid var(--color-outline-variant)' }}>
                <th style={{ padding: '0.5rem' }}>Ítem</th>
                <th style={{ padding: '0.5rem' }}>Cant.</th>
                <th style={{ padding: '0.5rem' }}>P. Unit</th>
                <th style={{ padding: '0.5rem' }}>Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                  <td style={{ padding: '0.5rem' }}>{it._name || 'Ítem Guardado'}</td>
                  <td style={{ padding: '0.5rem' }}>{it.quantity}</td>
                  <td style={{ padding: '0.5rem' }}>${it.unit_price.toLocaleString('es-CO')}</td>
                  <td style={{ padding: '0.5rem' }}>${(it.quantity * it.unit_price).toLocaleString('es-CO')}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                    <button type="button" onClick={() => handleRemove(idx)} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer' }}>
                      <Icon name="close" style={{ fontSize: '1rem' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
