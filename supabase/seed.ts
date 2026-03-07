import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function ensureProfile(userId: string, email: string, firstName: string, lastName: string, role: string) {
  // Upsert profile — handles both fresh creates and schema resets where auth.users survived
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, email, first_name: firstName, last_name: lastName, role },
      { onConflict: 'id' }
    );
  if (error) {
    console.error(`❌ Error upserting profile for ${email}:`, error.message);
    return false;
  }
  return true;
}

async function seed() {
  console.log('🌱 Seeding database...');

  // --- Admin user ---
  const { data: adminData, error: adminError } =
    await supabase.auth.admin.createUser({
      email: 'admin@nextlaunchkit.com',
      password: 'demoadmin!1',
      email_confirm: true,
      user_metadata: {
        first_name: 'Admin',
        last_name: 'User',
      },
    });

  if (adminError && !adminError.message.includes('already')) {
    console.error('❌ Error creating admin:', adminError.message);
  } else {
    // User either just created or already exists — get their ID
    let adminId = adminData?.user?.id;
    if (!adminId) {
      // Already exists in auth.users, look them up
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = listData?.users?.find((u) => u.email === 'admin@nextlaunchkit.com');
      adminId = existing?.id;
    }
    if (adminId) {
      const ok = await ensureProfile(adminId, 'admin@nextlaunchkit.com', 'Admin', 'User', 'ADMIN');
      if (ok) console.log('✅ Admin user ready:', 'admin@nextlaunchkit.com');
    }
  }

  // --- Demo user ---
  const { data: userData, error: userError } =
    await supabase.auth.admin.createUser({
      email: 'user@nextlaunchkit.com',
      password: 'demouser!1',
      email_confirm: true,
      user_metadata: {
        first_name: 'Demo',
        last_name: 'User',
      },
    });

  if (userError && !userError.message.includes('already')) {
    console.error('❌ Error creating user:', userError.message);
  } else {
    let userId = userData?.user?.id;
    if (!userId) {
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = listData?.users?.find((u) => u.email === 'user@nextlaunchkit.com');
      userId = existing?.id;
    }
    if (userId) {
      const ok = await ensureProfile(userId, 'user@nextlaunchkit.com', 'Demo', 'User', 'USER');
      if (ok) console.log('✅ Demo user ready:', 'user@nextlaunchkit.com');
    }
  }

  console.log('🎉 Seeding complete!');
}

seed().catch(console.error);
