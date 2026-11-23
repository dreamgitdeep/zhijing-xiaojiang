import { getSupabaseClient } from '../src/storage/database/supabase-client';

async function main() {
  const client = getSupabaseClient();
  const email = '2030501@stu.zhijing.edu.cn';
  const password = 'zjxj-test-2026';

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: '测试同学',
        student_no: '2030501',
        class_name: '景观2301',
        role: 'student',
      },
    },
  });
  if (error) throw new Error(`注册失败: ${error.message}`);
  console.log('signup ok, user id:', data.user?.id);
  console.log('has session:', !!data.session);

  const { data: login, error: loginError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (loginError) throw new Error(`登录失败: ${loginError.message}`);
  console.log('login ok, token length:', login.session?.access_token.length);

  const token = login.session!.access_token;
  const rls = getSupabaseClient(token);
  const { data: profile, error: profileError } = await rls
    .from('profiles')
    .select('*')
    .eq('id', login.user!.id)
    .maybeSingle();
  if (profileError) throw new Error(`查 profiles 失败: ${profileError.message}`);
  console.log('profile:', JSON.stringify(profile));

  const { data: plants, error: plantsError } = await rls
    .from('plants')
    .select('id, name')
    .limit(3);
  if (plantsError) throw new Error(`查 plants 失败: ${plantsError.message}`);
  console.log('plants sample:', plants?.map((p) => p.name).join('/'));
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
