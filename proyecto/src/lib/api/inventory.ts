import { supabase } from '../supabase';

export interface InventoryItem {
  id: string;
  workshop_id: string;
  name: string;
  item_type: string;
  price: number;
  stock: number;
  min_stock_alert: number;
  created_at: string;
}

export interface RepairItem {
  id: string;
  repair_id: string;
  inventory_id: string;
  quantity: number;
  unit_price: number;
  inventory?: Pick<InventoryItem, 'name' | 'item_type'>;
}

// -- INVENTORY CRUD --

export const getInventory = async (workshopId: string): Promise<InventoryItem[]> => {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('workshop_id', workshopId)
    .order('name', { ascending: true });

  if (error) throw error;
  return data as InventoryItem[];
};

export const createInventoryItem = async (
  item: Omit<InventoryItem, 'id' | 'created_at' | 'workshop_id'>,
  workshopId: string
): Promise<InventoryItem> => {
  const { data, error } = await supabase
    .from('inventory')
    .insert([{ ...item, workshop_id: workshopId }])
    .select()
    .single();

  if (error) throw error;
  return data as InventoryItem;
};

export const updateInventoryItem = async (
  id: string,
  updates: Partial<Omit<InventoryItem, 'id' | 'created_at' | 'workshop_id'>>
): Promise<InventoryItem> => {
  const { data, error } = await supabase
    .from('inventory')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as InventoryItem;
};

export const deleteInventoryItem = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('inventory')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// -- REPAIR ITEMS CRUD --

export const getRepairItems = async (repairId: string): Promise<RepairItem[]> => {
  const { data, error } = await supabase
    .from('repair_items')
    .select('*, inventory(name, item_type)')
    .eq('repair_id', repairId);

  if (error) throw error;
  return data as RepairItem[];
};

export const saveRepairItems = async (
  repairId: string,
  items: Omit<RepairItem, 'id' | 'repair_id' | 'inventory'>[]
): Promise<void> => {
  // First, get existing items to compare for stock updates (if we want to update stock)
  // But the user asked: "¿Deseas que al agregar un ítem a una reparación, el stock en la tabla de inventario se reste automáticamente?"
  // I will implement a basic "replace all" approach for the items, which is easier for editing.
  // We delete existing items and insert the new ones. 
  // If we need to subtract stock, we should do it here.

  // To keep it simple and robust, let's just delete all and insert new.
  // Warning: This doesn't revert stock. If the user wants stock management, we need a more complex diff.
  // Assuming no strict stock deduction yet unless explicitly requested, but let's implement basic deduction.

  // For now, just save the items. 
  
  // 1. Delete existing
  const { error: delError } = await supabase
    .from('repair_items')
    .delete()
    .eq('repair_id', repairId);
    
  if (delError) throw delError;

  // 2. Insert new
  if (items.length > 0) {
    const payloads = items.map((i: any) => {
      const { _name, _type, inventory, ...rest } = i;
      return {
        ...rest,
        repair_id: repairId
      };
    });
    
    const { error: insError } = await supabase
      .from('repair_items')
      .insert(payloads);
      
    if (insError) throw insError;
  }
};
