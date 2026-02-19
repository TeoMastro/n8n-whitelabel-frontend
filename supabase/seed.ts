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

async function seed() {
  console.log('🌱 Seeding database...');

  // Create admin user
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

  if (adminError) {
    if (adminError.message.includes('already')) {
      console.log('⚠️  Admin user already exists, skipping.');
    } else {
      console.error('❌ Error creating admin:', adminError.message);
    }
  } else if (adminData.user) {
    // Update profile to ADMIN role
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: 'ADMIN' })
      .eq('id', adminData.user.id);

    if (profileError) {
      console.error(
        '❌ Error updating admin profile:',
        profileError.message
      );
    } else {
      console.log('✅ Admin user created:', adminData.user.email);
    }
  }

  // Create regular user
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

  if (userError) {
    if (userError.message.includes('already')) {
      console.log('⚠️  Demo user already exists, skipping.');
    } else {
      console.error('❌ Error creating user:', userError.message);
    }
  } else if (userData.user) {
    console.log('✅ Demo user created:', userData.user.email);
  }

  console.log('🎉 Seeding complete!');
}

seed().catch(console.error);
