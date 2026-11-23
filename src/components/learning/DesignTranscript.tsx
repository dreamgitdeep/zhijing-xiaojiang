import { Award, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { DesignTranscriptTask } from "@/lib/design";

/** 学生端植景设计成绩单：各阶段最佳分 + AI 评阅记录 + 最终成绩（S6） */
export function DesignTranscript({ transcripts }: { transcripts: DesignTranscriptTask[] }) {
  if (!transcripts.length) {
    return null;
  }
  return (
    <section className="rounded-xl bg-surface p-6 shadow-card">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-fs-body font-medium text-on-surface">植景设计成绩</h2>
        <span className="text-fs-label text-on-surface-variant">各阶段最佳分 · 含 AI 评阅记录 · 最终成绩为方案评估（S6）</span>
      </div>
      <div className="space-y-5">
        {transcripts.map((t) => (
          <div key={t.taskId} className="rounded-xl border-neo border-outline-variant/25 bg-surface-container/30 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-fs-sub font-medium text-on-surface">{t.title}</p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-fs-label font-medium ${
                  t.status === "completed" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                }`}
              >
                {t.status === "completed" ? "已定稿" : "进行中"}
              </span>
              {t.finalScore != null && (
                <span className="ml-auto flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-fs-label font-medium text-on-primary">
                  <Award className="h-4 w-4" /> 最终成绩 {t.finalScore} 分
                </span>
              )}
            </div>

            {t.stages.length === 0 ? (
              <p className="mt-3 text-fs-label text-on-surface-variant">还没有提交记录。</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {t.stages.map((s) => (
                  <li key={s.key} className="rounded-lg bg-surface px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-fs-label font-medium text-on-surface">{s.key} {s.name}</span>
                      <span className="text-fs-label text-on-surface-variant">{s.attempts} 次提交</span>
                      <span className={`ml-auto text-fs-sub font-medium ${s.bestScore != null ? "text-on-surface" : "text-on-surface-variant"}`}>
                        {s.bestScore != null ? `最佳 ${s.bestScore} 分` : "—"}
                      </span>
                    </div>
                    {s.feedback && <p className="mt-1.5 text-fs-label leading-relaxed text-on-surface-variant">AI 评阅：{s.feedback}</p>}
                  </li>
                ))}
              </ul>
            )}

            <Link
              href={`/design/${t.taskId}`}
              className="mt-3 inline-flex items-center gap-1 text-fs-label font-medium text-foreground transition-opacity hover:opacity-80"
            >
              进入工作台 <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
