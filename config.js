/* Supabase connection. From the dashboard:
   - supabaseUrl:     Settings → Data API → Project URL
   - supabaseAnonKey: Settings → API Keys → publishable key (sb_publishable_...),
                      or the legacy 'anon public' key on older projects.
   Never the secret (sb_secret_) / service_role key — that bypasses row security.
   Both values here are safe to commit and publish; what they can touch is
   controlled by the database policies in supabase-schema.sql.
   Leave both empty and the app runs in single-phone mode (localStorage only). */
window.YG_CONFIG = {
  supabaseUrl: '',      // e.g. 'https://abcdefghijkl.supabase.co'
  supabaseAnonKey: '',  // sb_publishable_... (or legacy anon key)
};
