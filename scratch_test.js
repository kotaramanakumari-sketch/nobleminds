const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://tnjhemaxjdzbtocdlznk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6-x0okkIWrV1HEA7cUzFfA_KALVnd_-';
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await sb.from('movements').select('return_escort_name').limit(1);
  if (error) {
    console.log('Error (does not exist or no permission):', error.message);
  } else {
    console.log('Success! return_escort_name exists!');
  }
}
test();
