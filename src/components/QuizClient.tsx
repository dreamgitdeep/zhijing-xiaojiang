'use client';

import { useState } from 'react';
import type { Plant, QuizQuestion } from '@/lib/types';
import { loadLocalMastery, recordLocalAttempt } from '@/lib/mastery';

interface QuizClientProps {
  plant: Plant;
  isCloud: boolean;
  bestScore: number | null;
  mastered: boolean;
  /** 尚未答对过的题（服务端按判定引擎计算），练习时优先出 */
  pendingIds?: string[];
  /** 判定口径：错题订正率（0.5-1，默认 1） */
  passRatio?: number;
  correctedCount?: number;
  totalCount?: number;
}

interface AnswerRecord {
  picked: number | null;
  correct: boolean;
}

interface Verdict {
  mastered: boolean;
  corrected: number;
  total: number;
  pending: string[];
}

/** 待订正的题排在前面（错题重做），其余保持原顺序 */
function orderQuestions(quiz: QuizQuestion[], pendingIds: string[] | undefined): QuizQuestion[] {
  if (!pendingIds?.length) return quiz;
  const pendingSet = new Set(pendingIds);
  return [...quiz.filter((q) => pendingSet.has(q.qid ?? '')), ...quiz.filter((q) => !pendingSet.has(q.qid ?? ''))];
}

export default function QuizClient({
  plant,
  isCloud,
  bestScore,
  mastered: initialMastered,
  pendingIds,
  passRatio = 1,
  correctedCount = 0,
  totalCount,
}: QuizClientProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => orderQuestions(plant.quiz, pendingIds));
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>(() => plant.quiz.map(() => ({ picked: null, correct: false })));
  const [stage, setStage] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [score, setScore] = useState(0);
  const [localMastered, setLocalMastered] = useState(initialMastered);
  const [verdict, setVerdict] = useState<Verdict>({
    mastered: initialMastered,
    corrected: correctedCount,
    total: totalCount ?? plant.quiz.length,
    pending: pendingIds ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = questions.length;
  const q = questions[current];
  const ratioPercent = Math.round(passRatio * 100);

  if (plant.quiz.length === 0) {
    return (
      <div className="mx-auto mt-6 w-full max-w-measure rounded-2xl bg-surface border-neo border-outline-variant p-6 text-center">
        <p className="text-fs-card font-medium text-on-surface">该植物暂无练习题</p>
        <p className="mt-1 text-fs-sub text-on-surface-variant">教师尚未为它配置练习题，请先浏览图鉴或试试智能问答。</p>
      </div>
    );
  }

  const restart = (focusQids?: string[]) => {
    const next = focusQids?.length
      ? plant.quiz.filter((item) => focusQids.includes(item.qid ?? ''))
      : orderQuestions(plant.quiz, verdict.pending);
    setQuestions(next);
    setAnswers(next.map(() => ({ picked: null, correct: false })));
    setCurrent(0);
    setScore(0);
    setError(null);
    setStage('quiz');
  };

  const pick = (optionIndex: number) => {
    if (answers[current].picked !== null) return;
    const correct = optionIndex === q.answerIndex;
    setAnswers(prev => prev.map((a, i) => (i === current ? { picked: optionIndex, correct } : a)));
    if (correct) setScore(s => s + 1);
  };

  const next = () => {
    if (current < total - 1) {
      setCurrent(c => c + 1);
      return;
    }
    void finish();
  };

  const finish = async () => {
    setStage('result');
    const finalAnswers = answers.map((a, i) =>
      a.picked !== null ? a : { picked: null, correct: questions[i].answerIndex === -1 },
    );
    const finalScore = finalAnswers.filter(a => a.correct).length;
    setScore(finalScore);
    setSaving(true);
    setError(null);

    const answersPayload = finalAnswers.map((a, i) => ({
      qid: questions[i].qid ?? '',
      picked: a.picked,
      correct: a.correct,
    }));
    const correctQids = answersPayload.filter((a) => a.correct && a.qid).map((a) => a.qid);

    if (!isCloud) {
      const items = loadLocalMastery();
      const item = recordLocalAttempt(items, plant.id, { score: finalScore, total, correctQids }, plant.quiz);
      setLocalMastered(item.mastered);
      setVerdict({
        mastered: item.mastered,
        corrected: item.correctedCount ?? 0,
        total: item.totalCount ?? plant.quiz.length,
        pending: item.pendingQuestionIds ?? [],
      });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/quiz-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plantId: plant.id, score: finalScore, total, answers: answersPayload }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? '保存练习记录失败');
      setLocalMastered(Boolean(body.mastered));
      setVerdict({
        mastered: Boolean(body.mastered),
        corrected: Number(body.correctedCount ?? 0),
        total: Number(body.totalCount ?? total),
        pending: Array.isArray(body.pendingQuestionIds) ? body.pendingQuestionIds : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存练习记录失败');
    } finally {
      setSaving(false);
    }
  };

  if (stage === 'intro') {
    return (
      <div className="mx-auto mt-6 w-full max-w-measure rounded-2xl bg-surface border-neo border-outline-variant p-6">
        <h2 className="text-fs-title font-medium text-on-surface">开始练习</h2>
        <p className="mt-2 text-fs-body text-on-surface-variant">
          共 {total} 道题，覆盖光照、水分、土壤、观赏特性、配置方式与安全应用。
          {verdict.pending.length > 0 ? `将优先安排你尚未答对的 ${verdict.pending.length} 道题。` : ''}
        </p>
        <p className="mt-1.5 text-fs-sub text-on-surface-variant">
          判定方式：把错题订正到 {ratioPercent}% 即判为已掌握（已答对的题不会因后续答错被撤销）。
        </p>
        {bestScore !== null && (
          <p className="mt-3 text-fs-sub text-foreground">
            历史最佳：{bestScore} 题 · {localMastered ? '已掌握' : '未掌握'}
          </p>
        )}
        <button type="button" className="mt-4 rounded-lg border-neo border-ink bg-primary px-6 py-2.5 text-fs-control font-medium text-on-primary shadow-card transition-colors hover:bg-primary-hover" onClick={() => setStage('quiz')}>
          开始答题
        </button>
      </div>
    );
  }

  if (stage === 'result') {
    return (
      <div className="mx-auto mt-6 w-full max-w-measure rounded-2xl bg-surface border-neo border-outline-variant p-6">
        <h2 className="text-fs-title font-medium text-on-surface">练习结果</h2>
        <p className="mt-3 text-fs-section font-medium text-foreground">
          {score} / {total}
        </p>
        {saving && <p className="mt-2 text-fs-sub text-on-surface-variant">正在保存练习记录…</p>}
        {error && <p className="mt-2 text-fs-sub text-error">{error}</p>}
        <div className={`mt-4 rounded-xl px-4 py-3 ${verdict.mastered ? 'bg-success-container text-on-success-container' : 'bg-warn-container text-on-warn-container'}`}>
          <p className="text-fs-card font-medium">
            {verdict.mastered ? '已掌握该植物' : verdict.pending.length > 0 ? `还有 ${verdict.pending.length} 道题未订正` : '尚未达到掌握标准'}
          </p>
          <p className="mt-1 text-fs-sub">
            {verdict.mastered
              ? '全部题目均已订正到位，图鉴徽章已点亮；继续练习也不会撤销。'
              : `已订正 ${verdict.corrected}/${verdict.total} 题，订正率达到 ${ratioPercent}% 即判为已掌握。`}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {!verdict.mastered && verdict.pending.length > 0 && (
            <button type="button" className="rounded-lg border-neo border-ink bg-primary px-6 py-2.5 text-fs-control font-medium text-on-primary shadow-card transition-colors hover:bg-primary-hover" onClick={() => restart(verdict.pending)}>
              继续订正
            </button>
          )}
          <button type="button" className="rounded-full border-neo border-outline px-6 py-2.5 text-fs-control font-medium text-on-surface-variant hover:bg-surface-variant transition-colors" onClick={() => restart()}>
            再练一遍
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl bg-surface border-neo border-outline-variant p-6">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-primary-container px-3 py-1 text-fs-label font-medium text-on-primary-container">{q.dimension}</span>
        <span className="text-fs-label text-on-surface-variant">{current + 1} / {total}</span>
      </div>
      <h2 className="mt-4 text-fs-section font-medium text-on-surface">{q.q}</h2>
      <div className="mt-4 space-y-3">
        {q.options.map((option, optionIndex) => {
          const picked = answers[current].picked;
          const isPicked = picked === optionIndex;
          const isCorrect = optionIndex === q.answerIndex;
          const revealed = picked !== null;
          let cls = 'border-outline-variant bg-surface hover:border-primary';
          if (revealed && isCorrect) cls = 'border-success bg-success-container text-on-success-container';
          else if (revealed && isPicked) cls = 'border-error bg-error-container text-on-error-container';
          else if (revealed) cls = 'border-outline-variant opacity-70';
          return (
            <button
              key={optionIndex}
              type="button"
              disabled={revealed}
              onClick={() => pick(optionIndex)}
              className={`w-full rounded-xl border-neo px-4 py-3 text-left text-fs-body transition-colors ${cls}`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {answers[current].picked !== null && (
        <div className="mt-4 rounded-xl bg-surface-container px-4 py-3">
          <p className={`text-fs-card font-medium ${answers[current].correct ? 'text-success' : 'text-error'}`}>
            {answers[current].correct ? '回答正确' : '回答错误'}
          </p>
          <p className="mt-1 text-fs-sub text-on-surface-variant">{q.explain}</p>
          <button type="button" className="mt-3 rounded-lg border-neo border-ink bg-primary px-5 py-2 text-fs-control font-medium text-on-primary shadow-card hover:bg-primary-hover transition-colors" onClick={next}>
            {current < total - 1 ? '下一题' : '查看结果'}
          </button>
        </div>
      )}
    </div>
  );
}
