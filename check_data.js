const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://tstowvrkbcpoujmyexif.supabase.co', 'sb_publishable_q5PBuHSdz4UHSfl4DLqyxg_opKXM1Cs');
async function run() {
  const { data: reqs } = await sb.from('registration_requests').select('*');
  console.log('Registration Requests:', reqs);
  
  const { data: schools } = await sb.from('schools').select('*');
  console.log('Schools:', schools);

  const { data: profiles } = await sb.from('profiles').select('*');
  console.log('Profiles:', profiles);
}
run();
