const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://tstowvrkbcpoujmyexif.supabase.co', 'sb_publishable_q5PBuHSdz4UHSfl4DLqyxg_opKXM1Cs');
async function run() {
  const { data: profiles } = await sb.from('profiles').select('*').limit(1);
  console.log('Profile columns:', profiles ? Object.keys(profiles[0] || {}) : 'No data');
  
  const { data: reqs } = await sb.from('registration_requests').select('*').limit(1);
  console.log('Request columns:', reqs ? Object.keys(reqs[0] || {}) : 'No data');
}
run();
