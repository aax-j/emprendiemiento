import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { getInventory, deleteInventoryItem, InventoryItem } from '../../../lib/api/inventory';
import { Icon } from '../../../components/Icon/Icon';
import { InventoryModal } from '../InventoryModal/InventoryModal';
import styles from './InventoryList.module.css';

export const InventoryList = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState('');

  const fetchItems = async () => {
    if (!profile?.workshop_id) return;
    setLoading(true);
    try {
      const data = await getInventory(profile.workshop_id);
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [profile]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este ítem del inventario?')) return;
    try {
      await deleteInventoryItem(id);
      fetchItems();
    } catch (err) {
      alert('Error al eliminar');
      console.error(err);
    }
  };

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.item_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Inventario</h1>
          <p className={styles.subtitle}>Gestiona tus piezas, refacciones y servicios</p>
        </div>
        <button 
          className={styles.primaryBtn}
          onClick={() => { setEditingItem(null); setShowModal(true); }}
        >
          <Icon name="add" style={{ fontSize: '1.25rem' }} />
          Nuevo Ítem
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Icon name="search" style={{ color: 'var(--color-outline)' }} />
          <input 
            type="text" 
            placeholder="Buscar por nombre o tipo..."
            className={styles.searchInput}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.emptyState}>Cargando inventario...</div>
        ) : filteredItems.length === 0 ? (
          <div className={styles.emptyState}>
            <Icon name="inventory_2" style={{ fontSize: '3rem', opacity: 0.3 }} />
            <p>No se encontraron ítems en el inventario</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Precio Base</th>
                <th>Stock</th>
                <th style={{ width: '100px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const lowStock = item.stock <= item.min_stock_alert;
                return (
                  <tr key={item.id}>
                    <td style={{ fontWeight: '500' }}>{item.name}</td>
                    <td>
                      <span className={styles.typeChip}>{item.item_type}</span>
                    </td>
                    <td>${item.price.toLocaleString('es-CO')}</td>
                    <td>
                      <span className={`${styles.stockBadge} ${lowStock ? styles.lowStock : ''}`}>
                        {item.stock}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button 
                          className={styles.iconBtn}
                          onClick={() => { setEditingItem(item); setShowModal(true); }}
                        >
                          <Icon name="edit" style={{ fontSize: '1.125rem' }} />
                        </button>
                        <button 
                          className={`${styles.iconBtn} ${styles.dangerBtn}`}
                          onClick={() => handleDelete(item.id)}
                        >
                          <Icon name="delete" style={{ fontSize: '1.125rem' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <InventoryModal 
          item={editingItem}
          onClose={() => setShowModal(false)}
          onSuccess={fetchItems}
        />
      )}
    </div>
  );
};
