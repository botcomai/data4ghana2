// js/supabase.js

// Replace these values with your actual Supabase URL and Anon Key
const SUPABASE_URL = "https://wynmejzsybkxhqvazjzu.supabase.co";

// This is still the old, wrong key because the user didn't explicitly give us the new one in their response.
// The correct Supabase Anon Key provided by the user
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bm1lanpzeWJreGhxdmF6anp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzU4MzAsImV4cCI6MjA4OTE1MTgzMH0.f9MFrnPZ4ODzJOz71zuWtuCThWO5UUyEv1FkWDEzRiU";

window.supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// We also expose the old variable name 'supabase' globally to avoid breaking existing code
window.supabase = window.supabaseInstance;
