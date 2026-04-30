import { useState, useEffect } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { getExpenses, createExpense, updateExpense, deleteExpense, Expense } from '../../../lib/api/expenses';
import styles from './FinanceDashboard.module.css';

interface ExpensesTabProps {
  workshopId: string;
  onExpensesChanged: () => void;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({ workshopId, onExpensesChanged }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('arriendo');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEditingExpense(null);
    setDescription('');
    setAmount('');
    setCategory('arriendo');
    setDate(new Date().toISOString().split('T')[0]);
    setShowModal(false);
  };

  const handleEditClick = (exp: Expense) => {
    setEditingExpense(exp);
    setDescription(exp.description);
    setAmount(exp.amount.toString());
    setCategory(exp.category);
    setDate(exp.date);
    setShowModal(true);
  };

  useEffect(() => {
    fetchExpenses();
  }, [workshopId]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const data = await getExpenses(workshopId);
      setExpenses(data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !date) return;
    
    setSaving(true);
    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, {
          description,
          amount: parseFloat(amount),
          category,
          date
        });
      } else {
        await createExpense({
          description,
          amount: parseFloat(amount),
          category,
          date
        }, workshopId);
      }
      
      resetForm();
      await fetchExpenses();
      onExpensesChanged(); // Notify parent to refresh summary
    } catch (error) {
      console.error('Error saving expense:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este gasto?')) return;
    try {
      await deleteExpense(id);
      await fetchExpenses();
      onExpensesChanged();
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  return (
    <div className={styles.contentGrid}>
      <div className={styles.tableCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Registro de Gastos Operativos</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={styles.secondaryBtn} onClick={() => { fetchExpenses(); onExpensesChanged(); }}>
              <Icon name="refresh" />
              Refrescar
            </button>
            <button className={styles.primaryBtn} onClick={() => { resetForm(); setShowModal(true); }}>
              <Icon name="add" style={{ fontSize: '1.125rem' }} />
              Nuevo Gasto
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className={styles.emptyState}>Cargando gastos...</div>
        ) : expenses.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No hay gastos registrados aún.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => (
                  <tr key={exp.id}>
                    <td>{new Date(exp.date + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td style={{ textTransform: 'capitalize' }}>{exp.category}</td>
                    <td>{exp.description}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600' }}>
                      ${exp.amount.toLocaleString('es-CO')}
                    </td>
                    <td style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                      <button className={styles.iconBtn} onClick={() => handleEditClick(exp)} title="Editar">
                        <Icon name="edit" style={{ fontSize: '1.25rem', color: 'var(--color-primary)' }} />
                      </button>
                      <button className={styles.dangerIconBtn} onClick={() => handleDelete(exp.id)} title="Eliminar">
                        <Icon name="delete" style={{ fontSize: '1.25rem' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className={styles.overlay} onClick={resetForm}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{editingExpense ? 'Editar Gasto' : 'Registrar Gasto'}</h3>
              <button className={styles.closeBtn} onClick={resetForm}>
                <Icon name="close" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Categoría</label>
                  <select className={styles.input} value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="arriendo">Arriendo</option>
                    <option value="servicios">Servicios (Agua, Luz, Internet)</option>
                    <option value="nomina">Nómina / Salarios</option>
                    <option value="materiales">Materiales y Herramientas</option>
                    <option value="otros">Otros Gastos</option>
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Descripción</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    placeholder="Ej: Pago arriendo local abril"
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Monto</label>
                    <input 
                      type="number" 
                      className={styles.input} 
                      value={amount} 
                      onChange={e => setAmount(e.target.value)} 
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Fecha</label>
                    <input 
                      type="date" 
                      className={styles.input} 
                      value={date} 
                      onChange={e => setDate(e.target.value)} 
                      required
                    />
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={resetForm}>Cancelar</button>
                <button type="submit" className={styles.primaryBtn} disabled={saving}>
                  {saving ? 'Guardando...' : (editingExpense ? 'Actualizar Gasto' : 'Guardar Gasto')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
