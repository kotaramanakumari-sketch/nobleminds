const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://tstowvrkbcpoujmyexif.supabase.co', 'sb_publishable_q5PBuHSdz4UHSfl4DLqyxg_opKXM1Cs');
async function run() {
  const email = `test_admin_${Date.now()}@test.com`;
  
  console.log('--- Simulating Registration ---');
  const { data: auth, error: authErr } = await sb.auth.signUp({
    email, password: 'password123'
  });
  if (authErr) { console.error('SignUp failed:', authErr); return; }
  console.log('User signed up:', auth.user.id);

  const { data: req, error: reqErr } = await sb.from('registration_requests').insert([{
    udise: '99999', school_name: 'Test Final', admin_name: 'Admin User',
    email: email, phone: '1234567890', status: 'pending', user_id: auth.user.id
  }]).select().single();

  if (reqErr) { console.error('Request insert failed:', reqErr); return; }
  console.log('Request created:', req.id);

  console.log('--- Simulating Admin Approval (Note: Needs to be Admin) ---');
  // Since I don't have an admin session in this node script, 
  // I can't truly test the approval's DB permission, 
  // but I can check if the logic in data.js would work.
}
run();
