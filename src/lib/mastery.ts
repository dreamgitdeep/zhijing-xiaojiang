import { computeMasteryFromParts, questionIds, DEFAULT_MASTERY_PASS_RATIO } from './mastery-engine';
import type { QuizQuestion } from './types';

export interface MasteryInfo {
  bestScore: number;
  attempts: number;
  mastered: boolean;
  manual: boolean;
  updatedAt: string | null;
  /** 以下字段由判定引擎产出（云端为服务端计算后下发；本地模式存 localStorage） */
  correctedCount?: number;
  totalCount?: number;
  pendingQuestionIds?: string[];
}

const STORAGE_KEY = 'zhijing-mastery-v2';
const LEGACY_STORAGE_KEY = 'zhijing-mastery-v1';

export interface LocalMasteryItem extends MasteryInfo {
  plantId: string;
  /** 曾答对过的题 qid 集合（错题订正制的本地载体） */
  everCorrect?: string[];
}

export function loadLocalMastery(): Map<string, LocalMasteryItem> {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return new Map();
    const items = JSON.parse(raw) as LocalMasteryItem[];
    return new Map(items.map(item => [item.plantId, item]));
  } catch {
    return new Map();
  }
}

export function saveLocalMastery(items: Map<string, LocalMasteryItem>): void {
  if (typeof window === 'undefined') return;
  const list: LocalMasteryItem[] = [...items.entries()].map(([plantId, info]) => ({
    ...info,
    plantId,
  }));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/**
 * 本地模式答题记录：按题累计「曾答对」，用与服务端相同的引擎函数判定。
 * 本地模式无数据库配置，阈值取集中定义的默认值。
 */
export function recordLocalAttempt(
  items: Map<string, LocalMasteryItem>,
  plantId: string,
  outcome: { score: number; total: number; correctQids: string[] },
  quiz: QuizQuestion[],
): LocalMasteryItem {
  const prev = items.get(plantId);
  const ever = new Set<string>([...(prev?.everCorrect ?? []), ...outcome.correctQids]);
  const result = computeMasteryFromParts({
    everCorrect: ever,
    quiz,
    passRatio: DEFAULT_MASTERY_PASS_RATIO,
    manual: prev?.manual ?? false,
    manualMastered: prev?.mastered ?? false,
  });
  const next: LocalMasteryItem = {
    plantId,
    bestScore: Math.max(prev?.bestScore ?? 0, outcome.score),
    attempts: (prev?.attempts ?? 0) + 1,
    mastered: result.mastered,
    manual: prev?.manual ?? false,
    updatedAt: new Date().toISOString(),
    correctedCount: result.correctedCount,
    totalCount: result.totalCount,
    pendingQuestionIds: result.pendingQuestionIds,
    everCorrect: [...ever],
  };
  items.set(plantId, next);
  saveLocalMastery(items);
  return next;
}

/** 本地模式：取某植物尚未答对过的题（用于练习优先出题） */
export function localPendingQids(
  items: Map<string, LocalMasteryItem>,
  plantId: string,
  quiz: QuizQuestion[],
): string[] {
  const qids = questionIds(quiz);
  const ever = new Set(items.get(plantId)?.everCorrect ?? []);
  return qids.filter((q) => !ever.has(q));
}
