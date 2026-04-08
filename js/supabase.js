/**
 * NobleMinds Supabase Client Configuration
 * This file initializes the connection to the cloud database.
 */

const SUPABASE_URL = 'https://tstowvrkbcpoujmyexif.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_q5PBuHSdz4UHSfl4DLqyxg_opKXM1Cs';

// Initialize the Supabase client
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in other scripts
window.sb = sb;
