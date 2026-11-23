import type { QuizQuestion } from './types';

/**
 * 掌握判定唯一入口（纯函数核心，服务端与本地模式共用）。
 *
 * 口径（错题订正制）：掌握 ⟺ 曾答对过的题数 / 该植物当前题目总数 ≥ passRatio。
 * - 「曾答对」按题粒度（qid）聚合全部历史练习，答错过后重做答对即计入；
 * - 题目总数取当前题库动态值，教师删题后该题历史不再计入分子分母；
 * - passRatio 为配置项（默认 1，即错题须全部订正），禁止在业务代码中写死阈值。
 */

/** 错题订正率默认 100%：错题必须全部订正才算掌握（配置缺失/非法时的兜底值） */
export const DEFAULT_MASTERY_PASS_RATIO = 1;
export const MIN_MASTERY_PASS_RATIO = 0.5;
export const MAX_MASTERY_PASS_RATIO = 1;

export interface MasteryResult {
  mastered: boolean;
  correctedCount: number;
  totalCount: number;
  passRatio: number;
  /** 尚未曾答对过的题（供练习时优先出题） */
  pendingQuestionIds: string[];
}

export interface AttemptLike {
  score: number;
  total: number;
  answers: unknown;
}

interface AnswerItem {
  qid: string;
  correct?: boolean;
}

export function questionIds(quiz: QuizQuestion[] | undefined | null): string[] {
  return (quiz ?? []).map((qq, i) => qq.qid ?? `idx-${i}`);
}

/** 为题缺少 qid 的题目补确定性 ID（本地种子数据 / 旧导入数据兜底）。 */
export function ensureQuizQids<T extends { id?: string; quiz?: QuizQuestion[] }>(plant: T): T {
  const quiz = plant.quiz;
  if (!Array.isArray(quiz) || quiz.every((qq) => typeof qq.qid === 'string' && qq.qid)) return plant;
  return {
    ...plant,
    quiz: quiz.map((qq, i) =>
      typeof qq.qid === 'string' && qq.qid ? qq : { ...qq, qid: `${plant.id ?? 'plant'}-q${i}` },
    ),
  };
}

function isAnswerItemList(answers: unknown): answers is AnswerItem[] {
  return (
    Array.isArray(answers) &&
    answers.length > 0 &&
    answers.every((x) => x !== null && typeof x === 'object' && typeof (x as AnswerItem).qid === 'string')
  );
}

/**
 * 从历史练习聚合「曾答对过的题」。
 * 新格式记录按 qid 累计；旧格式记录无逐题数据，仅在整卷全对时按当时题即当前题折算。
 */
export function everCorrectQids(attempts: AttemptLike[], currentQids: string[]): Set<string> {
  const current = new Set(currentQids);
  const ever = new Set<string>();
  for (const a of attempts) {
    if (isAnswerItemList(a.answers)) {
      for (const item of a.answers) {
        if (item.correct === true && current.has(item.qid)) ever.add(item.qid);
      }
      continue;
    }
    const score = Number(a.score);
    const total = Number(a.total);
    if (Number.isFinite(score) && Number.isFinite(total) && total > 0 && score === total) {
      for (const q of currentQids) ever.add(q);
    }
  }
  return ever;
}

export function computeMasteryFromParts(opts: {
  everCorrect: Set<string>;
  quiz: QuizQuestion[] | undefined | null;
  passRatio: number;
  manual?: boolean;
  manualMastered?: boolean;
}): MasteryResult {
  const qids = questionIds(opts.quiz);
  const totalCount = qids.length;
  const correctedCount = qids.filter((q) => opts.everCorrect.has(q)).length;
  const pendingQuestionIds = qids.filter((q) => !opts.everCorrect.has(q));
  const mastered = opts.manual
    ? Boolean(opts.manualMastered)
    : totalCount > 0 && correctedCount >= totalCount * opts.passRatio - 1e-9;
  return { mastered, correctedCount, totalCount, passRatio: opts.passRatio, pendingQuestionIds };
}

/** 单植物判定：历史记录 + 当前题库 + 阈值 → 结果。 */
export function computeMastery(opts: {
  attempts: AttemptLike[];
  quiz: QuizQuestion[] | undefined | null;
  passRatio: number;
  manual?: boolean;
  manualMastered?: boolean;
}): MasteryResult {
  const qids = questionIds(opts.quiz);
  const ever = everCorrectQids(opts.attempts, qids);
  return computeMasteryFromParts({ ...opts, everCorrect: ever });
}
