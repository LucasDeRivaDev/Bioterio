import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || 'https://sjsbendrhuipbfsovmbz.supabase.co'
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqc2JlbmRyaHVpcGJmc292bWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDI2OTQsImV4cCI6MjA5MDgxODY5NH0.IeKnsorq-Ugn1UStFgRAZPiKO4JoD4k2jfHkqbOsH2g'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
