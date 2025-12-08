import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://skiemhluzcrwigignhpk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNraWVtaGx1emNyd2lnaWduaHBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNDcxNzcsImV4cCI6MjA4MDcyMzE3N30.ksW_TOCDOHylOCLnT7B0Rys_kjEyb2W3CcV3ByaQvWs';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);