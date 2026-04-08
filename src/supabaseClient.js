import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ocenymhgcqaojwejzzpi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jZW55bWhnY3Fhb2p3ZWp6enBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDA0NzUsImV4cCI6MjA5MDk3NjQ3NX0.Ty-5SqZVVqYo_AL8UT4ak-UdxFyAOumUt0wKc2XpKf0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)