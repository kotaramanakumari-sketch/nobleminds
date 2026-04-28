const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://tstowvrkbcpoujmyexif.supabase.co', 'sb_publishable_q5PBuHSdz4UHSfl4DLqyxg_opKXM1Cs');
async function run() {
  const email = `test${Date.now()}@test.com`;
  const { data, error } = await sb.auth.signUp({
    email, password: 'password123', options: { data: { full_name: 'test' } }
  });
  console.log('signUp returned session:', !!data.session);
  if (data.user) {
    const { data: schools, error: scErr } = await sb.from('schools').insert([{
      name: 'Test School', code: 'TST', udise: '12345'
    }]).select();
    console.log('insert schools auth:', schools ? 'SUCCESS' : 'FAILED', scErr);
    
    // Also test without code
    const { data: schools2, error: scErr2 } = await sb.from('schools').insert([{
      name: 'Test School 2', udise: '12345'
    }]).select();
    console.log('insert schools auth NO CODE:', schools2 ? 'SUCCESS' : 'FAILED', scErr2);

    const { data: prof, error: profErr } = await sb.from('profiles').insert([{
      id: data.user.id, name: 'test', role: 'admin'
    }]).select();
    console.log('insert profile auth:', prof ? 'SUCCESS' : 'FAILED', profErr);
  }
}
run();
