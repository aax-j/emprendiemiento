const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../proyecto/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: tables } = await supabase.rpc('get_tables'); // If rpc is available
  // Or just guess/check common tables
  const { data: repairs } = await supabase.from('repair_history').select('*').limit(1);
  const { data: vehicles } = await supabase.from('vehicles').select('*').limit(1);
  
  console.log('REPAIR_HISTORY:', repairs ? Object.keys(repairs[0] || {}) : 'not found');
  console.log('VEHICLES:', vehicles ? Object.keys(vehicles[0] || {}) : 'not found');
}
check();
