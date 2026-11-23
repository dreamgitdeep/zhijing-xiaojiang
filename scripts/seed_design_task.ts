import { readFileSync } from 'node:fs';
import { getSupabaseClient } from '../src/storage/database/supabase-client';

async function main() {
  const t = JSON.parse(readFileSync('public/data/tasks/chuangzhi-task.json', 'utf8'));
  const n = JSON.parse(readFileSync('public/data/tasks/chuangzhi-nongyuan.json', 'utf8'));
  const admin = getSupabaseClient();
  const row = {
    id: t.id,
    case_id: t.caseId,
    title: t.name,
    subtitle: n.subtitle,
    cover_url: t.cover,
    tags: t.tags,
    difficulty: t.difficulty,
    est_minutes: (t.hours ?? 2) * 45,
    intro: t.intro,
    stages: t.stages,
    site: n.site,
    inquiry: n.inquiry,
    diagnosis_form: n.diagnosisForm,
    positioning_options: { options: n.positioningOptions, rule: n.positioningRule },
    principle_options: { options: n.principleOptions, rule: n.principlesRule },
    reference_solution: t.referenceSolution,
    task_def: t,
    nongyuan: n,
    status: 'published',
  };
  const { error } = await admin.from('design_tasks').upsert(row, { onConflict: 'id' });
  if (error) throw error;
  const { data } = await admin.from('design_tasks').select('id, title').eq('id', t.id).single();
  console.log('seeded:', JSON.stringify(data));
}
main().catch((e) => { console.error('SEED FAIL', e.message); process.exit(1); });
