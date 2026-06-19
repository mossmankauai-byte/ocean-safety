// config.js — THE ONE PLACE to drop in keys once the Supabase project exists.
// The publishable key is safe in the browser (RLS guards the data). NEVER put the
// secret key here — it lives only in Edge Function / Netlify build secrets.
window.OCEANSAFE_CONFIG = {
  SUPABASE_URL: "https://arndnljtmjfsnzcpcuen.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_riEPrtz2STeoz0vq4HKIdA_3Tu8a3Um",
  FUNCTIONS_BASE: "https://arndnljtmjfsnzcpcuen.supabase.co/functions/v1",
};
