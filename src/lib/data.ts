import fs from 'node:fs';
import path from 'node:path';
import type { Plant, PlantsDataset } from './types';
import { ensureQuizQids } from './mastery-engine';
import { getAdminClient, isCloudConfigured } from './supabase-server';

/**
 * 本地数据模式：读取 public/data/plants.json（种子数据，禁改）。
 */
export function loadDataset(): PlantsDataset {
  const file = path.join(process.cwd(), 'public', 'data', 'plants.json');
  const raw = fs.readFileSync(file, 'utf-8');
  return JSON.parse(raw) as PlantsDataset;
}

/**
 * 服务端植物数据统一入口：
 * cloud 模式读数据库 plants 表（教师后台的增删改与题目变更对学生生效），
 * local 模式降级读 plants.json；两者都保证每题带 qid（掌握判定按题聚合的依据）。
 */
export async function loadPlantsForServer(): Promise<PlantsDataset> {
  const local = loadDataset();
  if (!isCloudConfigured()) {
    return { ...local, plants: local.plants.map((p) => ensureQuizQids(p)) };
  }
  try {
    const admin = getAdminClient();
    const { data, error } = await admin.from('plants').select('data').order('id');
    if (error || !data?.length) return { ...local, plants: local.plants.map((p) => ensureQuizQids(p)) };
    const plants = (data as { data: Plant }[]).map((row) => ensureQuizQids(row.data));
    return { ...local, plants };
  } catch {
    return { ...local, plants: local.plants.map((p) => ensureQuizQids(p)) };
  }
}
