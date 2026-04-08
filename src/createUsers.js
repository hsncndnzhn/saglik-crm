import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://ocenymhgcqaojwejzzpi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jZW55bWhnY3Fhb2p3ZWp6enBpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQwMDQ3NSwiZXhwIjoyMDkwOTc2NDc1fQ.HaastTwxV6F_XXyi4Ga-fG2B-go5b7rn83O7j3VYB64',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const users = [
  { email: 's.topal@swissmeddental.com',     full_name: 'Sefa Topal' },
  { email: 's.alsal@swissmeddental.com',     full_name: 'Sena Alşal' },
  { email: 'u.celik@swissmeddental.com',     full_name: 'Uğur Çelik' },
  { email: 'e.koc@swissmeddental.com',       full_name: 'Emre Koç' },
  { email: 'h.ipek@swissmeddental.com',      full_name: 'Hakan İpek' },
  { email: 'u.karadogan@swissmeddental.com', full_name: 'Umut Karadoğan' },
  { email: 's.semerci@swissmeddental.com',   full_name: 'Sedef Semerci' },
  { email: 'h.denizhan@swissmeddental.com',  full_name: 'Hasancan Denizhan' },
  { email: 'a.pulat@swissmeddental.com',     full_name: 'Alperen Pulat' },
  { email: 's.sanir@swissmeddental.com',     full_name: 'Sevgi Sanır' },
  { email: 'a.adatepe@swissmeddental.com',   full_name: 'Ayfer Adatepe' },
  { email: 'z.yilmaz@swissmeddental.com',    full_name: 'Zümrüt Yılmaz' },
  { email: 'n.gundogan@swissmeddental.com',  full_name: 'Nazlı Gündoğan' },
  { email: 'a.theiner@swissmeddental.com',   full_name: 'Alexa Theiner' },
]

async function createUsers() {
  for (const u of users) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: 'Elite2026!',
      email_confirm: true,
      user_metadata: { full_name: u.full_name }
    })
    if (error) console.error(u.email, error.message)
    else console.log('OK:', u.email, data.user.id)
  }
}

createUsers()