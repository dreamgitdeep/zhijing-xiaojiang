import { getAdminClient } from '@/lib/supabase-server';
import {
  DEFAULT_MASTERY_PASS_RATIO,
  MAX_MASTERY_PASS_RATIO,
  MIN_MASTERY_PASS_RATIO,
} from './mastery-engine';

/**
 * 教学配置（app_settings 表，仅服务端 service_role 可读写）。
 * 所有可配置业务阈值的键名集中定义于此；阈值默认值/区间在 mastery-engine 单点定义，此处仅转发。
 * 业务代码只读配置、不写死字面量。
 */

export { DEFAULT_MASTERY_PASS_RATIO, MIN_MASTERY_PASS_RATIO, MAX_MASTERY_PASS_RATIO };

export const MASTERY_PASS_RATIO_KEY = 'mastery_pass_ratio';
export const MASTERY_REBASE_REPORT_KEY = 'mastery_rebase_report';

/** 校验/收敛阈值；非法值返回 null（由调用方回落默认，不抛错） */
export function clampPassRatio(input: unknown): number | null {
  const v = typeof input === 'string' ? Number(input) : input;
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  if (v < MIN_MASTERY_PASS_RATIO - 1e-9 || v > MAX_MASTERY_PASS_RATIO + 1e-9) return null;
  return Math.min(MAX_MASTERY_PASS_RATIO, Math.max(MIN_MASTERY_PASS_RATIO, v));
}

export async function getSetting(key: string): Promise<unknown | null> {
  const admin = getAdminClient();
  const { data, error } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle();
  if (error || !data) return null;
  return ((data as { value: unknown }).value ?? null);
}

export async function setSetting(key: string, value: unknown, updatedBy?: string): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('app_settings')
    .upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: updatedBy ?? null },
      { onConflict: 'key' },
    );
  if (error) throw new Error(`保存配置失败：${error.message}`);
}

/** 读取掌握判定阈值；配置缺失或非法时回落默认 100%，不抛错 */
export async function getMasteryPassRatio(): Promise<number> {
  try {
    return clampPassRatio(await getSetting(MASTERY_PASS_RATIO_KEY)) ?? DEFAULT_MASTERY_PASS_RATIO;
  } catch {
    return DEFAULT_MASTERY_PASS_RATIO;
  }
}

/** 保存掌握判定阈值；非法值（越界/非数字）返回 error，不落库 */
export async function setMasteryPassRatio(
  value: unknown,
  updatedBy?: string,
): Promise<{ ok: true; passRatio: number } | { ok: false; error: string }> {
  const passRatio = clampPassRatio(value);
  if (passRatio === null) {
    return {
      ok: false,
      error: `阈值需在 ${Math.round(MIN_MASTERY_PASS_RATIO * 100)}%–${Math.round(MAX_MASTERY_PASS_RATIO * 100)}% 之间`,
    };
  }
  try {
    await setSetting(MASTERY_PASS_RATIO_KEY, passRatio, updatedBy);
    return { ok: true, passRatio };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '保存失败' };
  }
}

export interface MasteryRebaseReport {
  at: string;
  passRatio: number;
  changedStudents: number;
  changedPairs: number;
  demoted: number;
  promoted: number;
}

export async function getMasteryRebaseReport(): Promise<MasteryRebaseReport | null> {
  try {
    const raw = await getSetting(MASTERY_REBASE_REPORT_KEY);
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Partial<MasteryRebaseReport>;
    if (typeof r.at !== 'string' || typeof r.changedStudents !== 'number') return null;
    return r as MasteryRebaseReport;
  } catch {
    return null;
  }
}

/** 别名：口径重算报告（页面/接口读取用） */
export const getRebaseReport = getMasteryRebaseReport;
