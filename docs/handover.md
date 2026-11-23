# 植景小匠 · 工作交接文档

> 交接日期：2026-10（迭代 47 · 植景设计六阶段演示答案 + 学生端指定账号门控）· 版本 0.1.0 · 仓库 HEAD：`0ce3bfd`
> 本文是接手本项目的入门指引。深度细节与全部踩坑记录在 `AGENTS.md`，功能规格在 `docs/dev-prompt.md`，已交付工作按时间线见 `docs/work-log.md`，三者是权威来源，动手前必读。

---

## 1. 项目是什么

**植景小匠**是面向上海农林职业学院《植物造景》课程的教学网页应用：

- **学生端**：植物图鉴（135 种植物 + 810 道练习题，筛选/卡片/详情）、练习与掌握判定（错题订正制）、AI 智能问答（SSE 流式 + 语音）、学习管理数据大屏、消息通知（教师提醒）、植景设计实训（六阶段案例任务 + AI 评阅，S1 场地顾问为**云端语音通话**模式）。
- **教师端**：概览统计、植物数据管理（两栏主从编辑 + 图片上传 + 智能识别）、学情看板（班级管理 + 导出 + AI 学情分析）、设计任务发布与评阅管理（含提醒未完成学生）。

数据双模式：配置了 Supabase 环境变量走云端（Auth/Postgres/Storage），否则降级 local（plants.json + localStorage）。当前运行环境已接 Supabase 云端。

## 2. 当前状态（交接时刻）

**已完成的主要里程碑**（由近及远）：

| 迭代 | 内容 |
|---|---|
| 47 | **植景设计六阶段「演示答案」**：`src/lib/design-demo-answers.ts` 注册表（S1–S6 全量标准作答，内容取自 referenceSolution）+ `POST /api/design/stage/apply-demo`（复用 saveStageRecord 满分写入并解锁下一阶段）+ 工作台头部「演示答案」按钮。**入口在学生端，仅指定学号 `20232001027` 可见可用**（教师点名；教师端无法演示学生设计流程）。注册表只在服务端路由 import，不进客户端 bundle。附赠修复：StageZoning/StagePositioning 回显 `stage_payloads` 未解包 `.payload` 的平读 bug。冒烟 `scripts/demo_answer_smoke.ts` |
| 46 | **S1 场地顾问语音通话升级为云端引擎**：`/api/voice/tts`（TTSClient，音色 `zh_female_vv_uranus_bigtts`，返回 audio/mpeg 字节）+ `/api/voice/asr`（ASRClient）；`use-voice-call.ts` 重写为分句预取播放 + MediaRecorder/AnalyserNode 能量 VAD + 16kHz WAV 上云识别；**每日通话配额护栏**（`voice_usage` 表，北京时间 5 通/日，超额降级文字/浏览器语音输入条）；`/api/voice/session` 配额路由。冒烟 `scripts/voice_smoke_test.ts` |
| 45 | S1 场地顾问从「文字输入 + 语音输入」改为**纯语音通话模式**（接打电话体感，移除文字输入框）。Web Speech 初版已被迭代 46 云端方案取代 |
| 44 | 案例背景页 `/design/[taskId]` 改**左右双栏定高**（左案例素材 / 右信息 + 开始设计，整页不滚、板块内部滚动，FLIP 转场进工作台）；随后按教师点名删除「任务要求」区块 |
| 43 | 设计令牌与文案配置治理：业务组件硬编码清零；`src/config/` 四配置文件；`PageHeader` Props 化 |
| 42 | 全站视觉升级为**新野兽派（Neo-Brutalism）克制版**（奶油底网格/黑描边/硬阴影/柠檬黄，详见第 8 节）；同年按教师点名删除首页左上标题贴纸（首页现仅剩遮罩舞台 + 进入按钮） |
| 37–41 | 左侧导航改版、连通大面板 + 可拖分栏、图鉴滚动根因修复、垂直对齐、AI 搜索 textarea |
| 38 | 消息通知模块（教师提醒未完成学生 + 侧栏红点 + /notifications） |
| 二期 1–5 | 植景设计模块：六阶段工作台（S1 场地顾问 → S6 定稿）、规则+LLM 双轨评阅、S3 功能分区画布、学生端防剧透脱敏 |
| 一期 | 账号体系、图鉴、练习、AI 问答、教师后台三页、班级管理、数据大屏 |

**遗留 backlog**（记录在 `plan.md` 与 AGENTS.md「下一步」）：

1. **A1**：ReviewCard 评阅反馈改 markdown 渲染 + 评分明细可视化（目前评阅 feedback 仍是纯文本）。
2. **A2**：S3 画布增强——顶点拖动微调、撤销/重做（教师知情后置）。
3. **B1**：全站原型走查与排版规范扫描。注意：原型是迭代 42 之前的旧视觉，**视觉以新野兽派现状为准**，B1 走查只对照布局/信息结构，不对照配色。
4. 安全加固后续批：P1-3 拼接过滤、P1-4 CSRF Origin 校验、P1-5 初始密码策略、pnpm audit、两个 design AI 路由限流、全部 P2 项。
5. 教师手动调整掌握状态（mastery.manual）UI；云端图片上传 URL 回填编辑流程打磨。
6. **迭代 43 边界**：quiz/chat/design 各阶段组件内部的功能级文案（题目流程、阶段指引等）尚未抽取到配置，目前页面级文案已 100% 外置；后续如继续治理从这里入手。
7. **演示答案目前只注册了 `task-chuangzhi-01` 一个任务**：新增设计任务时若要演示答案，需按同形状补注册表条目（S3/S5 多边形要按新任务底图重新对齐）。

## 3. 技术栈速览

- Next.js 16（App Router）+ 自定义 server（`src/server.ts`，端口读 `PORT`，绑定 `HOSTNAME`）
- React 19 + TypeScript 5 + Tailwind CSS 4（M3 语义变量 + shadcn 双层 + 新野兽派令牌）
- Supabase（Auth/Postgres/Storage），统一数据层 `src/lib/repo.ts`（cloud/local 双模式）
- AI：coze-coding-dev-sdk（LLMClient `doubao-seed-2-0-lite-260215`，SSE 流式；ImageClient 造景效果图；**TTSClient/ASRClient 云端语音**）
- 字体：next/font/google（Space Grotesk + Noto Sans SC）
- 包管理器 **只用 pnpm**（禁 npm/yarn）；图片处理 sharp

## 4. 运行 / 预览 / 部署

**⚠️ 最重要的一条：预览跑的是生产构建，不是 dev 模式，没有热更新。**

```bash
# 改完代码必须重建 + 重启才生效：
bash scripts/build.sh
PID=$(ss -tlnp | grep ':5000 ' | grep -oP 'pid=\K[0-9]+' | head -1); [ -n "$PID" ] && kill $PID
setsid nohup bash scripts/start.sh > /tmp/zjxj-start.log 2>&1 &
```

- 预览绑定 `0.0.0.0:5000`（`.preview` 声明 `expose_port = 5000`，代码不 hardcode）。
- `start.sh` 内 `COZE_PROJECT_ENV=PROD` 强制生产模式——曾改回 dev 模式导致整站卡顿（每路由首次访问 1–2s），勿重蹈。
- `.coze`：`[dev]` 与 `[deploy]` 同源（build.sh → start.sh）；`sub_id = 35e3866b` 不可改。
- 代码验收只认 `test_run`；日常小改按用户偏好不主动跑完整测试。

**数据环境**：应用实际读写的 Supabase = exec_sql **develop** 环境；product 是另一个只读环境（数据可能滞后），验证数据要用 develop，别被 product 旧值误导。

## 5. 关键入口

| 位置 | 作用 |
|---|---|
| `src/config/site.ts` | 品牌/导航项/用户菜单/首页文案/检查更新文案 + `formatTemplate` 占位替换工具 |
| `src/config/pages.ts` | `PAGE_COPY`：各页面标题/说明/按钮/空态文案 |
| `src/config/auth-copy.ts` | `AUTH_COPY`：登录/注册/找回密码全部文案 |
| `src/config/design-palette.ts` | 设计画布 SVG 内容配色（植物层次色/图例墨线/分区色板） |
| `src/app/globals.css` | 全部设计令牌（颜色/字号/尺寸/阴影/圆角/动效缓动），改样式先来这里 |
| `src/lib/repo.ts` | 统一数据层（mastery/统计/学情/植物 CRUD），cloud/local 双模式 |
| `src/lib/auth-service.ts` / `auth.ts` | 认证纯函数（学号→映射邮箱）/ 会话（`getSessionUser` 单次 RLS 自查 + 120s token 缓存） |
| `src/lib/design.ts` | 设计任务数据层：`getTaskFull`（脱敏）/`ensureRun`/`saveStageRecord`（统一阶段完成与解锁）/`resetRun` |
| `src/lib/design-demo-answers.ts` | **演示答案注册表**（`DEMO_STUDENT_NO` + 按 taskId×stageKey 的 payload/meta；只许被服务端路由 import） |
| `src/components/design/use-voice-call.ts` | S1 云端通话引擎：`CallPhase` 状态机、TTS 分句预取播放、VAD 录音、`MAX_CALL_SECONDS=900` |
| `src/app/api/voice/{tts,asr,session}/route.ts` | 云端语音三路：TTS 合成字节流 / ASR 识别 / 每日配额闸门（`QUOTA_CALLS_PER_DAY=5`） |
| `src/app/api/design/stage/apply-demo/route.ts` | 演示答案应用（学号门控，满分写入 + 解锁下一阶段） |
| `src/app/api/design/review/route.ts` | 六阶段评阅分派（规则分 + LLM 判分），`saveStageRecord` 收口 |
| `src/components/design/` | 植景设计六阶段工作台组件（DesignCase 壳 + StageDiagnosis…StageEvaluation + RemindModal） |
| `src/components/chat/` | `ChatPanel`（page/embedded 双模式）+ `RecommendPanel` + `CatalogChatEngine`（图鉴内嵌） |
| `src/components/AppShell.tsx` | 天蓝侧栏壳层（可拖宽、用户卡片弹窗、消息红点角标），导航读 `src/config/site.ts` |
| `scripts/seed_plants.ts` | 135 种植物导入 Supabase（upsert 可重跑） |
| `scripts/*_smoke*.ts` | 冒烟脚本：`auth_smoke_test` / `teacher_stats_smoke` / `voice_smoke_test` / `demo_answer_smoke`（均带测试账号自动清理） |
| `supabase/schema.sql` | 表结构参考（线上已落地，文件本身禁改原始内容；`voice_usage` 表为迭代 46 线上 exec_sql 落地） |
| `public/data/plants.json` | 种子数据（**禁改**），135 种 + 810 题 |

## 6. 红线与长期约束（违反会出事故）

1. **禁改**：`public/data/plants.json`、`public/images/`、`supabase/schema.sql` 原始内容。数据变更走教师后台或重跑构建脚本。
2. **学生端防剧透是 P0 红线**：`/design/[taskId]` 下发前必须脱敏（剔 referenceSolution、answer、correct、mustMention、site 答案区等）。改该 page 时保持脱敏，勿把 full.task/nongyuan 直接传客户端。**演示答案注册表同理**：`design-demo-answers.ts` 只能被服务端路由 import，不得进任何客户端组件（已验证不在客户端 chunk）。
3. **演示答案门控**：按钮与 `apply-demo` 路由都按 `user.studentNo === DEMO_STUDENT_NO`（当前 `20232001027`）放行，其他学生/教师一律 403。改门控两处同步；学号常量在 DesignCase 内联（防注册表进客户端）。
4. **语音配额是成本护栏**：`voice_usage`（user_id+usage_date 复合主键，北京时间计数）服务端强制，刷新不重置；`/api/voice/session` 先于通话放行。勿把配额判断挪到客户端。
5. **Service role key / 模型 Key 不得进前端**；前端调自身接口用相对路径。
6. **会话 cookie 必须 `sameSite:'none' + secure:true`**（平台预览是跨站 iframe，Lax 会丢登录态）。
7. **排版规范（迭代 42 起）**：字号走 `text-fs-*` 语义令牌，任何文字 ≥13px；标题/数字可 700–900 粗体，正文与控件 400/500；正文色 `#111111`、次要 `#55606E`（禁 #999）；宽度只走 `max-w-shell`（1680px）/`max-w-measure`（880px）。
8. **硬编码红线（迭代 43 起）**：业务组件内不得出现裸色值、字面像素任意类、内联 fontSize/color。样式一律引用 `globals.css` 令牌（尺寸写法 `w-[var(--size-*)]`），文案一律来自 `src/config/`。验收口径见 AGENTS.md「设计令牌与文案配置治理」。
9. **只改用户点名的点**，不顺带调整周边；不主动跑测试（用户明说才跑）。
10. 不用中文文件名/路由；新增表单提交优先 API 路由，避免 server action（dev 重启会使 action ID 失效）。
11. 首页只有遮罩舞台 + 进入按钮（标题贴纸、校徽、花卉底图、书法标题、「薄荷绿洲」色板均已删，勿恢复）；全站其他页面是奶油底 + 网格，两套底图勿混用。

## 7. 高频踩坑速查（完整列表见 AGENTS.md「常见问题和预防」）

- **`stage_payloads` 是嵌套结构 `{ payload, meta }`**：组件回显必须解包 `.payload`（迭代 47 修复了 S2/S3 平读导致已完成阶段重进空白的 bug）；读历史 quiz_attempts 要兼容新旧两种 answers 格式。
- **Tailwind v4 没有 `--size-*`/`--inset-*` 工具类命名空间**：`--size-modal-sm` 不会生成 `w-modal-sm`，必须写 `w-[var(--size-modal-sm)]`（曾致模态宽度静默失效）。
- **perl 批量替换中文需 `-Mutf8`**；批量替换类名先排除 JS 标识符（`border` → `border-neo` 曾误伤 `${a.border}`），改完立即构建验证。
- **`text-primary`（柠檬黄）在浅底不可见**：强调文字用 `text-foreground` 或黄底黑字。
- **mastery 列名是 `updated_at`**，不是 last_practiced_at（supabase-js 无类型约束不报错）。
- **supabase-js `auth.updateUser()` 与 persistSession:false 不兼容**——写 auth 用户一律走 `getAdminClient().auth.admin.updateUserById()`。
- **curl 测登录态**：Secure cookie 在 http 下不进 cookie jar，必须从 `Set-Cookie` 头 grep 出 `zj_session=...` 原串用 `-b "$(cat 文件)"` 发送；登录字段是 `identifier`；登录路由恒返 200，失败看 body `error`。
- **测试账号清理协议**：冒烟脚本建的账号跑完必须删 `auth.users`（含 mastery/quiz_attempts/student_runs/stage_records/voice_usage 等按 `not exists(profiles)` 清孤儿行），否则污染教师统计。
- **练习页参数契约是 `plantId`**（曾回归成 404）：参数名、首植物兜底、AppShell 三者都不得丢。
- **`.gitignore` 会让 Tailwind v4 跳过扫描对应源文件**——任何 `src/**` 源文件不得写进 `.gitignore`。
- **exec_sql 视图**：删列须 DROP+CREATE，DROP 后重新 REVOKE，改完 `NOTIFY pgrst,'reload schema'`。
- **notifications.task_id 是 text 不是 uuid**：真实任务 id 是 `task-chuangzhi-01` 这类文本。
- **图鉴/问答/案例面板勿加 `flex-1`**：会把显式定高撑失效导致整页滚动（迭代 39 根因）；图鉴 AI 栏断点是 `xl` 不是 `lg`。
- **文件会被自动重排**：`edit_file` 前必须先重读最新内容；重排偶发语义改写（改名/简化），发现引用断裂先 grep 全项目。
- **S1 通话是半双工**：AI 播报期间麦克风恒关（防回声）；VAD 阈值按环境底噪自适应，改录音链路前先跑 `voice_smoke_test`。

## 8. 视觉现状（迭代 42 新野兽派定型，43 令牌治理）

- **基调「新野兽派克制版」**：奶油油纸底 `#FBF3E4` + 1px 细网格；所有卡片/按钮/输入框 2.5px 纯黑描边（`border-neo` 工具类）；圆角封顶 12px；**只用硬阴影无模糊**（`Npx Npx 0`，悬停左上移 + 阴影加大、按下阴影收回，`--ease-slam` 过冲缓动）。
- **撞色纪律**：主色柠檬黄 `#FFD84D`（当前项/高亮/主按钮）、辅色天蓝 `#8EC5FF`（侧栏/图表次要）、红 `#E5322D`/绿 `#2FBF71` 仅状态；全页撞色不超过三种。
- **字体**：Space Grotesk（拉丁）+ Noto Sans SC（中文），大数字 `font-black tabular-nums`（学习大屏巨数 96–160px）。
- **图表**：平涂实色 + 黑描边，禁渐变；零值/次要数据用灰色网点纹理（`url(#trendDots)`）。
- **导航**：左侧贴边天蓝侧栏（右缘可拖宽 200–400px，存 `zjxj:sidebar-w`），方角菜单项（选中=柠檬黄底黑字黑边硬阴影），底部用户区弹窗五件套；<lg 顶栏 + 汉堡抽屉。学生侧栏含「消息通知」项（未读红点角标）。
- **连通大面板模式**：/chat 三板块、/catalog 三模块均为单个连通卡片 + 可拖分隔条（宽度键 `zjxj:chat:left-w/right-w`、`zjxj:catalog:filter-w/ai-w`），各栏内部滚动；面板定高走 `--size-panel-vh*` 令牌。案例背景页同模式（左素材右信息，`--size-case-media-w`）。
- **⚠️ 面板 div 绝不能加 `flex-1`/`min-h-0`（迭代 39 根因）**：面板靠显式 height 定高，一旦带 `flex-1`（flex-basis:0%）height 会失效、面板被内容撑高导致整页滚动。图鉴 AI 讲解栏断点是 `xl`（≥1280px），勿改成 lg。
- **首页**：`HeroMask` 鼠标遮罩舞台（硬边聚光，半径 `--spotlight-r`，底图 `hero-bg.webp`）+ 柠檬黄进入按钮，无其他元素；登录/注册走 `AuthPanel` 浮层。
- **S1 通话屏**：头像呼吸环 + 阶段文案 + 计时 + 字幕 + VAD 指示，超额后降级为底部输入条（文字 + 浏览器语音输入）。
- 支持深色模式（`.dark` class + `zjxj:theme`，描边翻转为奶油色）。

## 9. 改样式 / 改文案去哪里（迭代 43 治理成果）

| 想改什么 | 去哪里 |
|---|---|
| 颜色/阴影/圆角/字号/动效缓动 | `src/app/globals.css` `@theme`（M3 语义 + `--neo-ink` 等） |
| 布局尺寸（模态宽高/面板/图表高/徽章等 40+ 项） | `globals.css` 的 `--size-*`/`--inset-*`，组件用 `w-[var(--size-*)]` 引用 |
| 导航项/品牌/首页/用户菜单/检查更新文案 | `src/config/site.ts` |
| 页面标题/说明/按钮/空态文案 | `src/config/pages.ts`（`PAGE_COPY`） |
| 登录/注册/找回密码文案 | `src/config/auth-copy.ts`（`AUTH_COPY`） |
| 设计画布 SVG 配色 | `src/config/design-palette.ts` |
| 图表配色/刻度字号 | `src/components/learning/chart-config.ts`（`CHART`）与 `analytics/AnalyticsChart.tsx`（`C`） |
| 演示答案内容 | `src/lib/design-demo-answers.ts`（按 taskId×stageKey；改 S3/S5 几何要对照底图像素） |

新增页面：先在 `PAGE_COPY` 登记文案，页头用 `PageHeader` 组件（props 传入），不要在 JSX 里写死标题。

## 10. 交接核对清单

接手后建议按此顺序建立手感：

- [ ] 通读 `AGENTS.md`（尤其「常见问题和预防」「设计令牌与文案配置治理」）、`docs/dev-prompt.md` 与 `docs/work-log.md`
- [ ] `bash scripts/build.sh` + 重启 start.sh，确认 5000 端口预览可访问
- [ ] 用真实学生/教师账号各走一遍主路径（登录 → 图鉴 → 练习 → 问答 / 教师后台四页）
- [ ] 走一遍植景设计：案例背景页（左右双栏）→ 开始设计 → S1 语音通话（说一句话验证 ASR/TTS 往返）→ 用学号 `20232001027` 账号验证「演示答案」按钮可见且逐阶段可用（其他账号应不可见）
- [ ] 验证消息通知链路：教师端「提醒未完成」→ 学生侧栏红点 → /notifications 已读跳转
- [ ] 确认视觉为新野兽派（奶油底网格/黑描边/硬阴影/柠檬黄高亮），深色模式切换正常
- [ ] 确认 Supabase develop 环境数据正常（`select count(*) from plants;` 应为 135；`voice_usage` 表存在）
- [ ] 查看 `.cozeproj/documents/plan.md` 了解 backlog 优先级
- [ ] 与教师确认下一迭代方向（backlog 中 A1/A2/B1 是候选）

---

*本文档随重大节点更新；日常细节沉淀请写 `AGENTS.md`，勿只留在对话里。*
