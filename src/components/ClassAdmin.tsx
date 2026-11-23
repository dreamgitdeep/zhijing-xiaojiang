"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Upload, Users } from "lucide-react";

interface ClassRow {
  id: string;
  name: string;
  inviteCode: string;
  students: number;
}

const field =
  "w-full rounded-md border-neo border-outline-variant/30 bg-surface px-3 py-2 text-fs-body text-on-surface focus:border-primary focus:outline-none";

const DOT = ["bg-primary", "bg-water", "bg-sun", "bg-blossom", "bg-sprout", "bg-lavender", "bg-bark"];

export default function ClassAdmin() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [newName, setNewName] = useState("");
  const [importId, setImportId] = useState("");
  const [rosterText, setRosterText] = useState("");
  const [busy, setBusy] = useState<"create" | "import" | "delete" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<ClassRow | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/classes");
    if (res.ok) {
      const data = await res.json();
      const list: ClassRow[] = data.classes ?? [];
      setClasses(list);
      setImportId((cur) => (list.some((c) => c.id === cur) ? cur : list[0]?.id ?? ""));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function create() {
    if (!newName.trim() || busy) return;
    setBusy("create");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "创建失败" });
      } else {
        setMsg({ ok: true, text: `班级「${newName.trim()}」已创建` });
        setNewName("");
        await refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function doImport() {
    if (!importId || busy) return;
    const rows: { studentNo: string; name: string }[] = [];
    let invalid = 0;
    for (const line of rosterText.split(/\n+/)) {
      const t = line.trim().split(/[\s,，、\t]+/);
      if (!line.trim()) continue;
      if (t.length >= 2) rows.push({ studentNo: t[0], name: t[1] });
      else invalid++;
    }
    if (rows.length === 0) {
      setMsg({ ok: false, text: "名单为空或格式不正确，每行格式：学号 姓名" });
      return;
    }
    setBusy("import");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/classes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: importId, rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "导入失败" });
      } else {
        const parts = [`新建 ${data.added}`, `移入 ${data.moved}`, `已在班 ${data.skipped}`];
        if (data.failed) parts.push(`失败 ${data.failed}`);
        if (invalid) parts.push(`格式跳过 ${invalid}`);
        setMsg({ ok: !data.failed, text: `导入完成：${parts.join("，")}` });
        if (!data.failed) setRosterText("");
        await refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function doDelete() {
    if (!confirmDel || busy) return;
    const target = confirmDel;
    setBusy("delete");
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/classes/${target.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "删除失败" });
      } else {
        setMsg({
          ok: true,
          text: `班级「${target.name}」已删除${data.unassigned ? `，${data.unassigned} 名学生已改为未分班` : ""}`,
        });
        setConfirmDel(null);
        await refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
    <section className="overflow-hidden rounded-xl border-neo border-lavender/25 bg-lavender-container/40 shadow-leaf lg:col-span-5">
      <div className="h-1.5 bg-lavender" />
      <div className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lavender text-on-primary">
          <Users className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-medium text-on-surface">班级管理</h2>
          <p className="text-fs-label text-on-surface-variant">创建班级、生成邀请码，并导入学生名单完成分班</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-fs-label font-medium text-on-surface-variant">创建班级</p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="班级名称，如 景观2401"
              className={field}
              maxLength={20}
            />
            <button
              onClick={create}
              disabled={busy !== null || !newName.trim()}
              className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-4 py-2 text-fs-sub font-medium text-on-primary transition hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              创建
            </button>
          </div>

          <p className="mb-2 mt-4 text-fs-label font-medium text-on-surface-variant">班级列表</p>
          <ul className="space-y-2">
            {classes.length === 0 && (
              <li className="rounded-md bg-surface-container px-3 py-2 text-fs-sub text-on-surface-variant">暂无班级</li>
            )}
            {classes.map((c, i) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-md border-neo border-lavender/15 bg-surface px-3 py-2 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[i % DOT.length]}`} />
                  <span className="text-fs-sub font-medium text-on-surface">{c.name}</span>
                  <span className="rounded bg-lavender/15 px-2 py-0.5 text-fs-label font-medium text-on-lavender-container">邀请码 {c.inviteCode}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-fs-label text-on-surface-variant">{c.students} 人</span>
                  <button
                    onClick={() => setConfirmDel(c)}
                    disabled={busy !== null}
                    title={`删除班级「${c.name}」`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant transition hover:bg-error/10 hover:text-error disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col">
          <p className="mb-2 text-fs-label font-medium text-on-surface-variant">导入学生名单</p>
          <select value={importId} onChange={(e) => setImportId(e.target.value)} className={`${field} mb-2 h-10 w-auto`}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <textarea
            value={rosterText}
            onChange={(e) => setRosterText(e.target.value)}
            placeholder={"每行一名学生：学号 姓名\n例：20232001028 张三"}
            rows={7}
            className={`${field} flex-1 resize-y font-mono text-fs-label leading-5`}
          />
          <p className="mt-2 text-fs-label text-on-surface-variant">
            已有学号将移入所选班级；新学号自动创建账号，默认密码为学号后 6 位。
          </p>
          <button
            onClick={doImport}
            disabled={busy !== null || !importId || !rosterText.trim()}
            className="mt-2 flex items-center justify-center gap-1 rounded-md bg-primary px-4 py-2 text-fs-sub font-medium text-on-primary transition hover:opacity-90 disabled:opacity-40"
          >
            <Upload className="h-4 w-4" />
            {busy === "import" ? "导入中…" : "开始导入"}
          </button>
        </div>
      </div>

      {msg && (
        <p className={`mt-3 text-fs-sub ${msg.ok ? "text-success" : "text-destructive"}`}>{msg.text}</p>
      )}
      </div>
    </section>

    {confirmDel && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        onClick={() => busy !== "delete" && setConfirmDel(null)}
      >
        <div
          className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-float"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-fs-card font-semibold text-on-surface">删除班级「{confirmDel.name}」？</h3>
          <p className="mt-3 text-fs-sub leading-6 text-on-surface-variant">
            {confirmDel.students > 0
              ? `该班级现有 ${confirmDel.students} 名学生，删除后将全部改为未分班（账号与学习记录保留）；`
              : "该班级暂无学生；"}
            已发布给该班级的植景设计任务也会同步取消下发。此操作不可恢复。
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setConfirmDel(null)}
              disabled={busy === "delete"}
              className="rounded-md border-neo border-outline-variant/40 bg-surface px-4 py-2 text-fs-sub font-medium text-on-surface transition hover:bg-surface-container disabled:opacity-40"
            >
              取消
            </button>
            <button
              onClick={doDelete}
              disabled={busy !== null}
              className="rounded-md bg-error px-4 py-2 text-fs-sub font-medium text-on-primary transition hover:opacity-90 disabled:opacity-40"
            >
              {busy === "delete" ? "删除中…" : "确认删除"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
