import { supabase } from '../supabase';

export interface InventoryItem {
  id: string;
  workshop_id: string;
  name: string;
  item_type: string;
  cost: number;
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
  unit_cost: number;
  inventory?: Pick<InventoryItem, 'name' | 'item_type' | 'cost'>;
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
  // 1. Get existing items to restore their stock
  const { data: existingItems } = await supabase
    .from('repair_items')
    .select('inventory_id, quantity')
    .eq('repair_id', repairId);

  if (existingItems && existingItems.length > 0) {
    for (const oldItem of existingItems) {
      if (!oldItem.inventory_id) continue;
      // Get current stock
      const { data: inv } = await supabase.from('inventory').select('stock').eq('id', oldItem.inventory_id).single();
      if (inv) {
        // Restore stock
        await supabase.from('inventory').update({ stock: inv.stock + oldItem.quantity }).eq('id', oldItem.inventory_id);
      }
    }
  }

  // 2. Delete all existing items for this repair
  const { error: delError } = await supabase
    .from('repair_items')
    .delete()
    .eq('repair_id', repairId);
    
  if (delError) throw delError;

  // 3. Insert new and subtract stock
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

    // Deduct stock for new items and ensure unit_cost is populated
    for (const newItem of items) {
      if (!newItem.inventory_id) continue;
      const { data: inv } = await supabase.from('inventory').select('stock, cost').eq('id', newItem.inventory_id).single();
      if (inv) {
        // We also need to update the inserted items with the correct unit_cost if it wasn't provided,
        // but since we are inserting the payload directly from UI, the UI should ideally send the unit_cost.
        // If the UI didn't send unit_cost, we could do an update here, but it's more efficient if the UI sends it.
        // Actually, we can update the row we just inserted to ensure unit_cost is set to the current inv.cost
        // in case the UI missed it.
        if (newItem.unit_cost === undefined || newItem.unit_cost === null) {
           await supabase.from('repair_items')
             .update({ unit_cost: inv.cost || 0 })
             .eq('repair_id', repairId)
             .eq('inventory_id', newItem.inventory_id);
        }

        // Deduct stock
        await supabase.from('inventory').update({ stock: Math.max(0, inv.stock - newItem.quantity) }).eq('id', newItem.inventory_id);
      }
    }
  }
};
