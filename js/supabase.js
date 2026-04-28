/**
 * NobleMinds Supabase Client Configuration
 * This file initializes the connection to the cloud database.
 */

const SUPABASE_URL = 'https://tnjhemaxjdzbtocdlznk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6-x0okkIWrV1HEA7cUzFfA_KALVnd_-';

// Initialize the Supabase client
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in other scripts
window.sb = sb;
