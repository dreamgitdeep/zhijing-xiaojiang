# 植景小匠 · Supabase 建表脚本（在 Supabase SQL Editor 中整段执行）

```sql
-- ============================================================
-- 0. 扩展与工具函数
-- ============================================================
create extension if not exists pgcrypto;

-- 判断当前登录用户是否为教师（SECURITY DEFINER 避免策略递归）
create or replace function public.is_teacher()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

-- ============================================================
-- 1. 用户档案（学生 / 教师）
-- ============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  role         text not null default 'student' check (role in ('student', 'teacher')),
  name         text,
  student_no   text,
  class_name   text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_profiles_class on public.profiles(class_name);

-- 注册时自动建档（角色从注册表单 metadata 带入）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role, name, student_no, class_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'student_no',
    new.raw_user_meta_data->>'class_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. 植物库（权威数据，教师后台可增删改）
--    data 字段存放完整植物对象（含 quiz / images / warning / 派生字段）
--    冗余列用于筛选与排序
-- ============================================================
create table if not exists public.plants (
  id          text primary key,            -- p001 …
  name        text not null,
  latin       text,
  category    text,                        -- 设计分类（14 类）
  layer       text check (layer in ('tree', 'shrub', 'herb', 'vine', 'bamboo')),
  is_warning  boolean not null default false,
  restriction text check (restriction in ('forbid', 'caution')),
  data        jsonb not null,              -- 完整对象，前端直接使用
  sort_order  int default 0,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id)
);
create index if not exists idx_plants_layer      on public.plants(layer);
create index if not exists idx_plants_category   on public.plants(category);
create index if not exists idx_plants_warning    on public.plants(is_warning);
create index if not exists idx_plants_data_tags  on public.plants using gin ((data->'tagGroups'));

-- ============================================================
-- 3. 掌握状态（每用户 × 每植物一条）
-- ============================================================
create table if not exists public.mastery (
  user_id     uuid references public.profiles(id) on delete cascade,
  plant_id    text references public.plants(id) on delete cascade,
  mastered    boolean not null default false,
  best_score  int not null default 0,
  attempts    int not null default 0,
  manual      boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_id, plant_id)
);
create index if not exists idx_mastery_user on public.mastery(user_id);

-- ============================================================
-- 4. 练习记录（每次提交一条，用于学情分析）
-- ============================================================
create table if not exists public.quiz_attempts (
  id         bigserial primary key,
  user_id    uuid references public.profiles(id) on delete cascade,
  plant_id   text references public.plants(id) on delete cascade,
  score      int not null,
  total      int not null,
  answers    jsonb,                        -- [{index, chosen, correct, dimension}]
  created_at timestamptz not null default now()
);
create index if not exists idx_attempts_user on public.quiz_attempts(user_id, created_at desc);
create index if not exists idx_attempts_plant on public.quiz_attempts(plant_id);

-- ============================================================
-- 5. AI 对话记录
-- ============================================================
create table if not exists public.chat_messages (
  id         bigserial primary key,
  user_id    uuid references public.profiles(id) on delete cascade,
  plant_id   text,
  conversation_id text,
  role       text not null check (role in ('user', 'assistant', 'conversation_meta')),
  content    text not null,
  created_at timestamptz not null default now(),
  -- 第 5 轮：消息级附件（推荐资源/相关链接/生成效果图），旧行 NULL=无附件
  meta       jsonb,
  -- 第 5 轮：会话来源标识（chat=普通对话 / catalog=图鉴速查），旧行回填 chat
  source     text not null default 'chat'
);
create index if not exists idx_chat_user on public.chat_messages(user_id, created_at);
create index if not exists idx_chat_user_conv on public.chat_messages(user_id, conversation_id, created_at);

-- ============================================================
-- 6. 行级安全策略（RLS）
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.plants         enable row level security;
alter table public.mastery        enable row level security;
alter table public.quiz_attempts  enable row level security;
alter table public.chat_messages  enable row level security;

-- profiles：本人读写；教师读全部
drop policy if exists "profiles_self_read"   on public.profiles;
create policy "profiles_self_read"   on public.profiles for select using (auth.uid() = id or public.is_teacher());
drop policy if exists "profiles_self_write"  on public.profiles;
create policy "profiles_self_write"  on public.profiles for update using (auth.uid() = id);
drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles for insert with check (auth.uid() = id);

-- plants：所有人可读；仅教师可增删改
drop policy if exists "plants_read"  on public.plants;
create policy "plants_read"  on public.plants for select using (true);
drop policy if exists "plants_write" on public.plants;
create policy "plants_write" on public.plants for all
  using (public.is_teacher()) with check (public.is_teacher());

-- mastery / attempts / chat：本人读写；教师只读（学情看板）
drop policy if exists "mastery_rw" on public.mastery;
create policy "mastery_rw" on public.mastery for all
  using (auth.uid() = user_id or public.is_teacher())
  with check (auth.uid() = user_id);

drop policy if exists "attempts_rw" on public.quiz_attempts;
create policy "attempts_rw" on public.quiz_attempts for all
  using (auth.uid() = user_id or public.is_teacher())
  with check (auth.uid() = user_id);

drop policy if exists "chat_rw" on public.chat_messages;
create policy "chat_rw" on public.chat_messages for all
  using (auth.uid() = user_id or public.is_teacher())
  with check (auth.uid() = user_id);

-- ============================================================
-- 7. 图片存储桶（教师后台上传植物图片）
-- ============================================================
insert into storage.buckets (id, name, public)
values ('plant-images', 'plant-images', true)
on conflict (id) do nothing;

drop policy if exists "plant_images_public_read" on storage.objects;
create policy "plant_images_public_read" on storage.objects
  for select using (bucket_id = 'plant-images');

drop policy if exists "plant_images_teacher_write" on storage.objects;
create policy "plant_images_teacher_write" on storage.objects
  for all using (bucket_id = 'plant-images' and public.is_teacher())
  with check (bucket_id = 'plant-images' and public.is_teacher());
```

## 植景设计 · 学生任务视图（安全加固版，2026-09 重建）

旧版视图无 `security_invoker`（以 owner 权限执行、绕过 design_tasks RLS）且暴露
`inquiry`（含 answer）/`principle_options`（含 correct）/`site`/`nongyuan` 等答案列，
已重建为仅含安全列、按调用者权限执行；匿名角色撤销权限。

```sql
-- 注意：CREATE OR REPLACE VIEW 无法删除/重命名已有列，列集变更必须 DROP 后重建；
-- 末尾追加列可以 CREATE OR REPLACE（2026-10 追加 published_classes 即此方式，权限不变）
drop view if exists tasks_student_view;
create view tasks_student_view
with (security_invoker = true) as
select id, case_id, title, subtitle, cover_url, tags, difficulty, est_minutes, intro, stages, status,
       (task_def - 'referenceSolution') #- '{case,designTaskNote}' as task_def,
       published_classes
from design_tasks
where status = 'published';

revoke all on tasks_student_view from anon;
grant select on tasks_student_view to authenticated;
```

## 植景设计 · 发布班级关联（2026-10 任务管理两栏目）

发布任务时选择班级（多选），学生端仅可见发布给自己所在班级的任务。
`published_classes` 存班级邀请码数组（对应 `profiles.class_code` / `classes.invite_code`）；
空数组视为全班可见（宽松兼容）。撤回 = status 改回 draft，学生记录不删。

```sql
alter table public.design_tasks
  add column if not exists published_classes jsonb not null default '[]';
```

## 密码重置码（S11 · 一次性重置码，2026-09）

教师为学生生成一次性重置码：服务端只存 SHA-256 哈希，15 分钟有效，
使用一次即失效；连错 5 次作废。仅 service_role 可访问（启用 RLS 且不建策略，
并撤销 anon/authenticated 的全部权限）。

```sql
create table if not exists public.password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  fail_count integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_reset_codes_user_active
  on public.password_reset_codes (user_id) where used_at is null;

alter table public.password_reset_codes enable row level security;
revoke all on public.password_reset_codes from anon, authenticated;
```


## 初始化数据

在 Supabase 建好表后，任选一种方式灌入 124 种植物：

**方式 A（推荐，无需代码）**：教师后台 →「批量导入」→ 上传 `public/data/plants.json`，前端按 `plants[]` 逐条 upsert 到 `plants` 表（`id/name/latin/category/layer/is_warning/restriction` 从对象中提取，整对象写入 `data`）。

**方式 B（脚本）**：配置 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY` 后运行
`python scripts/seed_supabase.py`（读取 `public/data/plants.json`，批量 upsert）。

## 环境变量

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # 仅服务端/脚本使用，切勿提交到前端
OPENAI_API_KEY=                   # 或其它大模型 Key，未配置时 AI 走本地兜底
NEXT_PUBLIC_DATA_MODE=cloud       # cloud | local（local 时读本地 JSON + localStorage，便于演示）
```

## 意见反馈表（迭代 37）

```sql
create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_name text,
  role text,
  content text not null check (char_length(content) <= 1000),
  created_at timestamptz not null default now()
);
alter table public.feedbacks enable row level security;
create policy "feedbacks_insert_own" on public.feedbacks
  for insert to authenticated with check (auth.uid() = user_id);
```

说明：仅开放本人插入；无 SELECT 策略（学生端不可列举），教师端后续如需查看走 service role。
