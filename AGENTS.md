# 植景小匠 · 项目上下文

面向上海农林职业学院《植物造景》课程的教学网页应用（Next.js）。当前里程碑：全链路功能已落地——账号体系（学号登录/注册/找回密码）、植物图鉴、练习与掌握判定、AI 流式问答、教师后台（统计/学情/植物管理/图片上传），数据接入 Supabase 云端（无配置时降级 local）。

## 项目概述

- 教学应用：植物图鉴（筛选/卡片/详情）+ 练习（题数动态，掌握=错题订正制：全部题目曾答对 ≥ 可配置订正率，默认 100%）+ AI 讲解/问答（SSE 流式、markdown 渲染、语音输入/播报、相关问答图片+网络资源推荐）+ 学习管理数据大屏（`/learning`，学生本人）+ 消息通知（`/notifications`，教师提醒未完成植景设计任务的学生，侧栏红点角标）+ 教师后台（`/admin` 概览、`/admin-plants` 两栏主从题库编辑、`/admin-students` 学情看板含班级管理+导出 xlsx/csv/json）。
- 智能问答增强：问题文本自动匹配植物（`lib/plant-match.ts` matchPlantByName，name 优先、latin 兜底）注入图鉴资料；prompt 强制"观赏特性/造景应用/养护要点"三段 markdown、≤300 字；语音=Web Speech API（Recognition 输入 + speechSynthesis 播报，zh-CN）；AI 回答 react-markdown 渲染（.md-body）+ 思维导图视图切换（`components/MindMap.tsx`，解析三段 markdown 为主题+分支卡）+ 可选"生成造景效果图"（/api/plant-render，ImageClient）。
- 左侧导航（迭代 37 起，原顶部白色导航已废弃；**迭代 42 野兽派化**）：天蓝侧栏 `bg-sidebar`（#8EC5FF）+ 右侧 2.5px 黑描边（lg+ fixed 贴边连通内容区，右缘可拖动调宽 200–400px 存 `zjxj:sidebar-w`；<lg 顶栏+汉堡抽屉），菜单项方角（`rounded-lg`，激活=柠檬黄底黑字黑边硬阴影，非激活=黑字 hover 白底黑边）；顶部 = logo-mark.webp + 植景小匠 + `v{版本}`（`NEXT_PUBLIC_APP_VERSION` 由 next.config.ts 从 package.json 注入，改版本号需重建）；菜单：学生 = 学习管理/植物图鉴/智能问答/植景设计，教师 = 概览 /admin、植物数据 /admin-plants、学情看板 /admin-students、任务管理 /admin/design-tasks，无学生端模块；`/admin` 高亮用精确匹配（避免吞掉其他 admin 子路由）；侧栏底部用户区弹窗 = 设置/外观(主题切换)/意见反馈/检查更新/退出登录。/chat 桌面端三板块（历史/对话/推荐）为连通大卡片+可拖动分隔条（`zjxj:chat:left-w`/`right-w`，hook `lib/use-drag-width.ts`）。/catalog 桌面端三模块（筛选/植物库/AI讲解）同为连通大面板+可拖动分隔条（`zjxj:catalog:filter-w`/`ai-w`）。**关键坑：面板 div 绝不能加 `flex-1`/`min-h-0`**——面板靠 `lg:h-[calc(100vh-40px)] lg:overflow-hidden` 定高，一旦带 `flex-1`（flex-basis:0%），在自动高度的 flex 列里显式 height 会失效、面板被内容撑高（实测 3873px）导致整页滚动——这正是「图鉴页会滚、问答页不会」的根因（迭代 39 修复，勿回退）。**垂直对齐约定（迭代 40）**：/catalog 与 /chat 页面 wrapper 用 `student-vivid -my-3 w-full`（负边距抵消 main `py-8` 中的 12px），面板定高 `calc(100vh-40px)`，上下各留 20px 与全高侧栏对齐（对齐「薄荷绿洲」参考的 `calc(100vh-40px)` 习惯）；ChatClient 面板、ChatPanel page 模式同用此高度，三处须同步改。AI 讲解栏断点为 `xl`（≥1280px），**勿改成 lg**：中栏是 `minmax(280px,1fr)` 卡片网格，三栏并排需约 1200px+ 视口，lg(1024px) 下植物列被挤到不足 280px 卡片会横向溢出（迭代 38 那次 xl→lg 是错误改法，已回退）；1024–1280px 呈两栏（筛选+植物库），AI 讲解可到 /chat 页使用。三模块各自内部滚动，滚中栏时左右栏固定不动。
- 数据已内置：`public/data/plants.json`（135 种植物 + 810 道题 + filters 元数据）与 `public/images/plants/`（270 主图/特写 + 135 缩略图）。
- 双模式：`NEXT_PUBLIC_DATA_MODE=cloud|local`；Supabase 环境变量（COZE_SUPABASE_URL/COZE_SUPABASE_ANON_KEY，workload identity 注入）存在即 cloud，否则降级 local（读 plants.json + localStorage）。
- 原型：`.cozeproj/prototype/web/`（8 页，已验收）；视觉规格唯一权威，改样式前先对照原型。`@theme` 变量已全部迁移至 `src/app/globals.css`（check_tokens 9/9 PASS）。
- 完整开发规格见 `docs/dev-prompt.md`（唯一权威，改功能前先读）；已交付工作时间线见 `docs/work-log.md`，交接现状见 `docs/handover.md`。

## 版本技术栈

- **Framework**: Next.js 16 (App Router)，自定义 server 入口 `src/server.ts`
- **Core**: React 19；**Language**: TypeScript 5；**Styling**: Tailwind CSS 4（M3 语义变量 + shadcn 语义双层，迭代 42 起新野兽派令牌：奶油底+网格/2.5px 黑描边/硬阴影/柠檬黄主色）；**Fonts**: next/font/google（Space Grotesk + Noto Sans SC）
- **UI 组件**: shadcn/ui 在 `src/components/ui/`；业务组件用 M3 工具类（`bg-surface`/`text-on-surface-variant`/`shadow-card` 等，与原型一致）
- **数据**: Supabase（Auth/Postgres/Storage）+ `src/lib/repo.ts` 统一数据层（cloud/local 双模式）；drizzle schema 在 `src/storage/database/shared/schema.ts`
- **AI**: coze-coding-dev-sdk LLMClient，模型 `doubao-seed-2-0-lite-260215`，SSE 流式
- **图片处理**: sharp（上传缩略图，server external，部署机 pnpm install 自带）
- **包管理器**: pnpm（强制，禁 npm/yarn）

## 目录结构

```
├── public/
│   ├── data/plants.json      # 135 种 + 810 题种子数据（禁止修改）
│   └── images/plants/        # {id}_full/_close.webp + thumbs/{id}.webp（禁止修改）
│   └── images/hero/          # 首页 hero 底图 community.jpg / bloom.jpg
├── scripts/                  # 模板构建脚本 + 数据/冒烟脚本
│   ├── build.sh / dev.sh / prepare.sh / start.sh / validate.sh   # 模板 dev/deploy 链路
│   ├── seed_plants.ts        # 135 种植物导入 Supabase（upsert 语义，可重跑；node tsx 运行）
│   ├── seed_demo_data.ts     # 演示数据：景观2301 158 人名单 + 分层学情 + 重点账号 20232001027（可重跑，详见「班级管理」节）
│   ├── auth_smoke_test.ts / teacher_stats_smoke.ts               # 认证/教师统计链路冒烟
├── docs/dev-prompt.md        # 完整开发规格（唯一权威）
├── docs/work-log.md          # 工作日志（已交付工作按阶段/迭代的时间线）
├── docs/handover.md          # 工作交接文档（项目现状/运行方式/红线/踩坑/交接清单）
├── docs/declaration.md       # 申报书（约3000字：背景/问题/功能/技术路线/创新点/成效/过程评价创新/示范价值/展望；成效数据取自 product 库 2026-10 中旬快照）
├── docs/figures/             # 申报书配图：tech-roadmap.svg（可编辑源）+ tech-roadmap.png（3200×1800 横屏技术路线图，sharp 自 SVG 栅格化）
├── src/config/               # 文案与内容配色唯一来源（迭代 43 起，改文案/导航/画布色改这里）
│   ├── site.ts               # 品牌/导航项/用户菜单/首页文案/检查更新文案 + formatTemplate
│   ├── pages.ts              # PAGE_COPY：各页面标题/说明/按钮文案
│   ├── auth-copy.ts          # AUTH_COPY：登录/注册/找回密码全部文案
│   └── design-palette.ts     # 设计画布 SVG 内容配色（符号/图例/分区色板，非 UI 皮肤色）
├── supabase/schema.sql       # 5 表 + RLS + 存储桶参考（线上已由 exec_sql 落地）
├── src/
│   ├── app/
│   │   ├── page.tsx                # 首页：HeroMask 遮罩舞台+进入应用按钮（已登录跳转；校徽已移除）
│   │   ├── learning/                                   # 学习管理数据大屏（学生，/api/learning）
│   │   ├── catalog/ plant-quiz/ chat/ design/          # 图鉴/练习/问答/设计占位
│   │   ├── notifications/                              # 消息通知（学生，/api/notifications）
│   │   ├── admin/ admin-plants/ admin-students/        # 教师后台三页（requireTeacher）
│   │   ├── api/                  # mastery(+merge) quiz-attempts chat-history chat(SSE) learning
│   │   │                         # plant-resources(相关推荐：图=本地图鉴 full/close/thumb，链接=webSearch, 10min 缓存) auth/*
│   │   │                         # plant-render(POST 生成造景效果图, ImageClient, 内存缓存)
│   │   │                         # notifications(+unread/read) admin/design-tasks/[id]/remind(教师提醒)
│   │   │                         # admin/plants(+[id]/import/parse 智能识别) admin/upload-image admin/student-detail
│   ├── components/           # HomeHero(首页舞台+浮层开关) AuthPanel(登录/注册浮层) AppShell HeroMask
│   │   │                     # PlantCatalog/PlantCard/PlantDetailModal QuizClient ChatClient
│   │   │                     # PlantsAdminClient StudentsClient SeasonBar NotificationsClient
│   │   │                     # design/RemindModal(教师提醒未完成学生弹窗)
│   ├── lib/
│   │   ├── auth.ts           # SESSION_COOKIE/setSessionCookie/getSessionUser/getAuthContext/requireTeacher
│   │   ├── auth-service.ts   # login/register/resetPassword/logout 纯函数（学号→学号@zjxj.school.edu，CLASS_CODES），API 路由调用
│   │   ├── repo.ts           # 统一数据层：mastery/chatHistory/teacherStats/studentRows/learningDashboard/plants CRUD
│   │   ├── mastery.ts        # 本地模式掌握记录（localStorage）
│   │   ├── chat-fallback.ts  # 无模型 Key 时的本地兜底讲解
│   │   ├── types.ts          # Plant/PlantsDataset 等数据契约；layerLabel()
│   │   └── supabase-server.ts# getAdminClient/getUserClient(token)/isCloudConfigured
│   ├── storage/database/shared/schema.ts  # drizzle 5 表定义
│   └── server.ts             # 自定义 Next.js server（端口读 PORT，绑定 HOSTNAME）
└── next.config.ts
```

## 关键入口 / 核心模块

- 认证：登录字段为"学号/教师账号"，统一映射 `标识@stu.zhijing.edu.cn`（EMAIL_DOMAIN 在 auth-service）后 signInWithPassword；注册走 `handle_new_user()` 触发器自动建档 profiles；找回密码=学号/账号+姓名核对+admin updateUserById。
- **会话性能（重要）**：`getSessionUser` 不再调 `auth.getUser()`——profiles 表已加 `contact_email/class_code/account` 三列（触发器从 metadata 复制，存量已回填），单次 RLS 自查查询组装 SessionUser，并带 120s 进程内 token 缓存（`invalidateSessionCache` 在 profile 修改/退出时调用）。部署机到 Supabase 延迟高，改前每请求两跳≈2s，改后首跳 1 次、缓存期内 0 跳。改 profiles 相关代码时同步维护这三列与触发器。
- 认证入口已从 server actions 迁移到 API 路由（dev server 重启会使旧页面缓存的 action ID 失效，客户端报 "An unexpected response was received from the server"）：核心逻辑在 `src/lib/auth-service.ts`（login/register/resetPassword/logout，纯函数），路由 `src/app/api/auth/{login,register,reset,logout}/route.ts`（POST JSON）；AuthPanel/AppShell 用 fetch 提交，登录成功后 `location.href` 按角色跳转（teacher→/admin，student→/catalog）。`src/lib/auth-actions.ts` 已删除，不要恢复。
- 注册字段（2026-09 改版）：角色选择在最上方。教师=姓名/账号(字母数字 3-20)/邮箱/密码（**无邀请码**）；学生=姓名/学号/班级邀请码(选填)/邮箱/密码。班级邀请码映射在 `auth-service.ts` 的 `CLASS_CODES`（jg2301/2302/2303→景观班级），填错报错、留空班级为 null；用户邮箱存 metadata.contact_email，auth 邮箱仍用映射地址。
- 首页结构：`HomeHero` = `HeroMask` 鼠标遮罩舞台（底层=首页专用底图 `/images/hero/hero-bg.webp`（1920×1080，教师下发 `assets/image_20260915114037890.png` 转换，368KB），CSS `url()` 引用 + `var(--color-primary-container)` 兜底底色；上层 `bloom.webp` 140px 圆形聚光鼠标跟随透出，**迭代 42 起聚光为硬边**（`#000 97%, transparent 100%`，原 FADE_MASK 柔边褪边常量已删，勿恢复）+ 左下提示块（白底黑边硬阴影）；**迭代 42 曾新增左上标题贴纸，迭代 47 已按教师要求整体删除**（HomeHero 现仅剩 HeroMask + 底部 enter-btn；HOME_COPY 同步精简为只有 enter，`--text-hero-title`/`--size-hero-copy` 令牌保留在 globals.css 未删，勿恢复贴纸）；校徽已于迭代 37 移除（`badge.png` 文件保留未删，勿恢复引用）+ 底部 `.enter-btn` **柠檬黄底黑边硬阴影方角按钮**（原绿玻璃胶囊已废弃，按压物理同全站）点击后 AuthPanel 浮层上浮（rise-in）。`.enter-btn` 样式类在 globals.css 尾部；`.main-title/.sub-title` 书法字体已清理，不要恢复。`src/lib/hero-image.ts` 已删除（base64 时代产物，勿恢复）；带「植景小匠」大字的原效果图保留在 `public/images/hero/community.jpg`（525KB 原件）+ `community.webp`，无代码引用，供教师课件/分享封面取用，勿删。首页底图与全站底图是两套（首页 hero-bg 舞台 / 全站奶油网格），勿混用。
- 掌握判定：`quiz_attempts` POST 后按 `best_score>=5` upsert `mastery`；`/api/mastery/merge` 同步 localStorage。
- 植物警示与署名：`warning.restriction==='forbid'` 时卡片/详情徽章显示"禁植"（否则"警示"）；PlantDetailModal 底部渲染 `source` + `imageCredit`（full/close 的 license/attribution/photographer/pageUrl，类型 ImageCreditInfo）。
- 教师后台统计：`getTeacherStats()`（学生数/活跃/人均掌握/班级对比/最近动态）；列名用 `updated_at`（**不是** last_practiced_at）。
- `.coze`：**`[dev]`（预览）已改为生产构建** = build.sh→start.sh（与 `[deploy]` 同源），不再用 dev.sh 的 `tsx watch` dev 模式；`[deploy]`=build.sh（next build + tsup 打包 dist/server.js）→start.sh（`node dist/server.js`）。sub_id=`35e3866b`。详见「运行与预览」的性能说明。
- `.preview`：`expose_port = 5000`。

## 运行与预览

- **⚠️ 预览跑生产构建（性能修复，勿改回 dev）**：教师反馈整站卡顿——根因是预览原用 dev 模式（`COZE_PROJECT_ENV=DEV`，`server.ts` 里 `dev = COZE_PROJECT_ENV!=='PROD'`），Next.js dev 按页即时编译，每个路由首次访问 1–2s、客户端 hydration 也慢，切换模块明显卡。已实测生产构建首跳即 <0.2s。故 `[dev]` 改为 build.sh→start.sh，`start.sh` 内 `export COZE_PROJECT_ENV=PROD` 强制生产（否则退回 dev 模式复现卡顿）。**代价：改完代码必须重跑 `bash scripts/build.sh` 再重启（`setsid nohup bash scripts/start.sh`）预览才生效，没有热更新**。若后续要高频改代码可临时切回 `dev.sh`，但交付/验收前务必切回生产预览。
- 预览（本地，生产）：`bash scripts/build.sh` 后 `setsid nohup bash scripts/start.sh`，绑定 `0.0.0.0:5000`。
- 生产：`build.sh`（tsup 默认 external node_modules，sharp 无需额外配置）→ `start.sh`。
- 数据模式：有 Supabase 环境变量即 cloud；`isCloudConfigured()` 判断。
- 代码验收仅认 `test_run`；有 API 的场景 commands 里补业务 curl。

## 用户偏好与长期约束

- **禁止修改** `public/data/plants.json`、`public/images/`、`supabase/schema.sql` 原始内容；数据变更走教师后台或重跑 `scripts/build_plants.py`。
- 不用中文文件名或中文路由；页面内导航用 `next/link`。
- `SUPABASE_SERVICE_ROLE_KEY`、模型 Key 不得出现在前端代码；前端调自身接口用相对路径。
- 设计基调：**迭代 42 起整站升级为「新野兽派（Neo-Brutalism）克制版」**（用户下发完整规格，取代迭代 37 的「薄荷绿洲」绿色系）：底色=奶油油纸 `#FBF3E4` + 1px 细网格 `#EADFCB`（body `background-image` 双向 22px 网格，深色模式网格 `#243026`）；描边=所有卡片/按钮/输入框 2.5px 纯黑 `#111111`（令牌 `--neo-ink`，深色模式翻转为奶油 `#FBF3E4`），圆角封顶 12px（`--radius:12px`，`rounded-xl/2xl` 同为 12px，**禁止大圆角**）；阴影=**只用硬阴影无模糊** `Npx Npx 0 #111111`（`--shadow-2xs…xl/card/float/dialog/leaf` 全部硬阴影，card=4px、float=6px、dialog=8px），悬停时元素向左上移+阴影加大、按下时阴影收回+元素移到阴影位（`button,a,[role=button]` base 层统一按压物理，`--ease-slam: cubic-bezier(0.3,1.55,0.5,1)` 过冲缓动，120-220ms）；撞色=主色柠檬黄 `#FFD84D`（当前项/高亮/主按钮，深悬停 `#F2C94C`，容器 `#FFE9A8`）+ 辅色天蓝 `#8EC5FF`（侧栏面板/图表次要），红 `#E5322D`、绿 `#2FBF71` **只表示状态**（错误/成功/掌握），全页撞色不超过三种；图表=平涂实色+黑描边，禁渐变，次要/零值数据用灰色网点纹理（SVG `<pattern id="trendDots">`）。**描边工具类约定**：2.5px 描边统一用 `@utility border-neo`（及 `-t/-b/-l/-r-neo` 方向变体），勿写 `border-[2.5px]`；带 `shadow-card/float/dialog` 的元素由 base 层规则自动加 2.5px ink 边框，无需重复声明。字体=Space Grotesk（拉丁）+ Noto Sans SC（中文），next/font/google 加载，`--font-sans` 链 `var(--font-grotesk),var(--font-noto)`（Next 构建时自动改写引用，勿手动改回字面量）；大数字用 `font-black tabular-nums`（学习大屏英雄面板巨数 `clamp(96px,12vw,160px)`）。禁植红/慎用橙语义保留（警示徽章），不用 emoji 当图标；样式一律用 `globals.css` 令牌工具类，不引入新色值。
- **全站底色=奶油油纸+网格（迭代 42）**：迭代 37 的纯色 `#EDF4F0` 底与花卉底图均已废弃（`floral-bg.webp` 文件保留未删，勿恢复引用）。现 body 自带奶油底+网格，`.admin-floral-root` 为 `background: transparent` 让网格透出；AppShell 根 div 不加背景色。首页不走 AppShell，保留自有 hero 舞台（遮罩褪边已改硬边，见首页结构）。
- **排版规范（迭代 42 更新，全站强制）**：字号走 `globals.css` `@theme` 语义变量——`text-fs-title/section/card/body/sub/label/control` = 28/1.3·22/1.4·18/1.5·16/1.8·14/1.6·13/1.4·16，任何文字不得小于 13px；**标题/数字可 700-900（野兽派粗体），正文与控件保持 400/500**；正文色 `#111111`（=on-surface）、次要 `#55606E`（=on-surface-variant），禁止 #999；卡片内边距 20-24px（p-5/p-6）；正文容器 68ch（.md-body 已设）；输入框与按钮 16px。新页面直接用语义类，不逐页硬编码。
- **内容区宽度规范（全站强制）**：宽度只走 `@theme` 两个容器语义变量，禁止逐页硬编码 `max-w-[1680px]` 等——`--container-shell: 1680px`（壳层内容区上限，工具类 `max-w-shell`，AppShell 顶栏与 main 专用）；`--container-measure: 880px`（纯文字阅读区限行宽，工具类 `max-w-measure`，用于对话正文/题干/案例背景）。卡片网格用 `repeat(auto-fill,minmax(…))` 自适应，不写死列数、不依赖 `2xl:` 断点。`max-width + mx-auto` 是 cap 语义，任何视口生效。
- **只改用户点名的点**：用户没提的地方一律不动，不顺带调整周边样式/结构。
- **不主动跑测试**：只有用户明确说"测试"时才跑 test_run / 验证脚本；日常小改只做必要的最小确认（如 curl 看产物），不每次跑完整验收。
- 视觉以 `.cozeproj/prototype/web/` 原型为唯一标准；偏离需在交付说明列出。

## 设计令牌与文案配置治理（迭代 43 起，改样式/文案去哪里）

**硬编码红线**：业务组件（`src/components/**`、`src/app/**`，不含 `src/components/ui/` shadcn 库组件）内**不得出现**裸色值（hex/rgb）、字面像素/视口尺寸的任意类（`w-[440px]` 这类）、内联 fontSize/color。验收口径：`grep -rn '#[0-9a-fA-F]\{3,8\}' src --include='*.tsx'`（排除 ui/、config/、globals.css）与任意值像素扫描均为 0。

- **样式令牌 → `src/app/globals.css` `@theme`**：
  - 颜色：M3 语义（`--color-primary/surface/on-surface/...`）+ `--neo-ink`/`--grid-line`/`--ease-slam`。
  - 字号：`--text-fs-*`（title/section/card/body/sub/label/control）+ `--text-hero-number`（学习大屏巨数 clamp 96-160）+ `--text-hero-title`（首页大标题 clamp 56-120）。
  - 布局尺寸：`--size-*` 一族（模态 `modal-xs/sm/md`+`modal-vh*` 高度档、图表 `chart-sm/md/lg`、对话 `chat-pane/chat-min`、设计工作台 `stage-side`、管理页 `pane-lg/md`、`min-xs…min-lg` 最小高、`panel-vh*` 视口联动定高、`panel-ratio*`/`bubble-max*` 百分比、`badge/accent-bar/text-cap/card-min/spotlight-r` 等）。**注意：Tailwind v4 没有 `--size-*` 工具类命名空间**，组件引用写法是 `w-[var(--size-modal-sm)]`/`h-[var(--size-modal-vh)]`（任意值里包变量），不要写 `w-modal-sm`（不会生成 CSS，曾致模态宽度失效）。`--text-*`/`--container-*`/`--inset-*` 中 `--inset-*` 同理无命名空间，用 `left-[var(--inset-switch-shift)]`。
  - 图表主题：`src/components/learning/chart-config.ts` 的 `CHART`（含 `tickFontSize/valueFontSize` 数值——SVG 属性不支持 var()）与 `src/components/analytics/AnalyticsChart.tsx` 的 `C`。
- **文案配置 → `src/config/`**：`site.ts`（SITE 品牌/版本、NAV_STUDENT/NAV_TEACHER 导航、USER_MENU、HOME_COPY 首页、UPDATE_MODAL、formatTemplate 占位替换工具）；`pages.ts`（PAGE_COPY：admin/adminStudents/adminPlants/designTasks/notifications/designList 的标题/说明/按钮/空态文案）；`auth-copy.ts`（AUTH_COPY：登录/注册/找回密码全量文案）。**改文案只改配置，不动组件**；新增页面先在 PAGE_COPY 登记。
- **组件 Props 化现状**：`PageHeader`（title/description/actions 全 props，admin 三页 + design-tasks 用）；`NotificationsClient`/`DesignTasksAdmin`/`HomeHero` 的页面级文案全部由父级从配置传入；AppShell/AuthPanel 直接读配置（单一消费方，prop 化反而增噪）。**未覆盖**：quiz/chat/design 各阶段组件内部的功能级文案（属后续迭代）。
- **设计画布内容配色 → `src/config/design-palette.ts`**：植物符号层次色（LAYER_COLOR/LAYER_LABEL）、选中高亮、图例墨线色（DIAGRAM_*）、分区 8 色板（ZONING_PALETTE）。SVG 插图内容色不进 globals.css。SVG 内的 `fontSize={30}` 等是 viewBox 用户单位（几何尺寸随画布缩放），不属像素硬编码，勿令牌化。

## 常见问题和预防

- **mastery 相关列名是 `updated_at`**：曾误用 `last_practiced_at`（supabase-js 无类型约束不报错，靠 teacher_stats_smoke 抓出）。改 mastery/quiz_attempts 相关代码时先对 schema.ts 核对列名。
- **⚠️ supabase-js 无分页查询隐式 1000 行上限**：全表聚合（掌握判定、教师统计、学情看板名单）在练习记录超 1000 条后会静默截断——曾致秋千实际 48 掌握/125 练习被算成 6/18。凡对 `quiz_attempts` 等增长表做全量读取必须 `.order('id').range(from, from+PAGE-1)` 分页循环（PAGE=1000）；已分页的入口：`mastery-service.fetchAllAttempts`、`repo.fetchAllAttemptsForStats`（getTeacherStats/getStudentRows/getHardPlants 共用）。新增全量聚合查询时照此办理，勿写裸 select。
- **⚠️ 开发与生产是两套独立 Supabase**：沙箱预览连开发库、部署连生产库，数据不互通——沙箱里灌的演示数据不会出现在线上。生产数据靠 `ensureDemoData()` 启动钩子自动补齐（见「班级管理」节）；判断线上数据状态用 `exec_sql` 的 product 环境（只读 SELECT）。
- **⚠️ 自定义 server 入口禁止传递依赖 next/headers、next/navigation**：`src/server.ts` 由 tsup 打包成 `dist/server.js` 直接 node 运行，任何被它（含间接）import 的模块若在顶层引入 `next/headers`/`next/navigation`，启动即崩 `Invariant: AsyncLocalStorage accessed in runtime where it is not available`。曾踩：demo-seed 引 auth-service（顶部 `import { cookies } from 'next/headers'`）→ 服务起不来。解法：中性常量拆到 `src/lib/auth-constants.ts`（EMAIL_DOMAIN/CLASS_CODES），server 链路只引它。改 server.ts 依赖链后务必本地 `start.sh` 起一遍验证。
- **drop 过的索引**：`idx_plants_data_tags`（JSONB 整列 btree，2728>2704 上限）已 drop，重跑 seed 前不要再建。
- **JSONB 列**：`plants.data` 存完整 Plant 对象；读取后需转视图类型（latLatin/category 从 data 内取）。
- **shadcn 组件与原型样式冲突**：优先原生元素 + 原型 class（如 Input→`<input>`），避免被组件默认样式覆盖。
- **重复 key（"竹类"）**：标签数组用 `Set` 去重 + 索引 key。
- **图片路径**：plants thumb 在 `thumbs/` 子目录，full/close 在根；上传图走 `/api/admin/upload-image`（sharp 缩略图，plant-images 桶）。
- **测试账号清理**：冒烟脚本建的账号邮箱后缀 `@test.local`，跑完删 `auth.users`，否则污染教师统计。
- **server action 过期 ID**：dev server 重启后旧页面缓存的 action ID 失效，客户端报 "unexpected response"（fetchServerAction）。认证已迁 API 路由规避；新增表单提交优先 API 路由，避免再引入 'use server' action。
- **Turbopack CSS 编译竞态**：向 globals.css 追加普通 CSS 类可能不进产物，需重启 dev server（`pkill -f 'tsx watch src/server.ts'` 后 `setsid nohup bash scripts/dev.sh`）才生效。
- **预览 iframe 登录态**：平台预览以跨站 iframe 嵌入，session cookie 必须 `sameSite: 'none' + secure: true`（Lax 会被当第三方 cookie 拦截，表现为预览里登录态丢失、浏览器直开正常）。改 cookie 属性后旧 cookie 不自动升级，需重新登录。
- **COZE_API_TOKEN 缺失噪音**：模板 `supabase-client.ts` 曾无条件调 SDK `getReportBuffer()`，缺 `COZE_API_TOKEN` 时 SDK console.error 被 Next dev overlay 弹成 Console Error。已加 `if (process.env.COZE_API_TOKEN)` 守卫；动该文件时别删守卫。
- **视图 DDL**：`CREATE OR REPLACE VIEW` 不能删/重命名列（静默失败），删列须 `DROP VIEW`+`CREATE VIEW`；DROP 后 Supabase 默认权限会自动重授 anon/authenticated SELECT，须重新 `REVOKE`；改完 `NOTIFY pgrst,'reload schema'` 否则 REST 仍走旧 schema 缓存。
- **Next 16 proxy**：`middleware.ts` 已废弃更名 `proxy.ts`（函数导出名 `proxy`）；proxy 默认 Node.js 运行时，写 `runtime` 配置会报错。
- **cookie 值编码**：`res.cookies.set` 会把 `|` 编码为 `%7C`，`cookies().get` 读取自动解码；手动用 curl 测试会话时两种形态服务端都接受。
- **掌握判定改造遗留**：旧 `quiz_attempts.answers` 被 `map(Number)` 写成 `[null,...]`（无逐题数据），新提交为 `[{qid,picked,correct}]`；读历史时两种格式都要兼容（见 mastery-engine everCorrectQids）。改判定相关代码只认 `mastery-engine`/`mastery-service` 两个模块，不要在路由/页面里另写聚合。
- **学生端植物数据源**：cloud 模式 `catalog`/`plant-quiz` 走 `loadPlantsForServer()`（DB plants 表），教师改题即时生效；`chat`/`plant-render`/`plant-resources` 等仍读 plants.json（未切换，属已知边界）。plants.json 永远是种子，禁改。
- **tsx 脚本顶层 await**：`pnpm tsx scripts/x.ts` 按 CJS 处理，顶层 await 报错——包一层 `async function main()`。
- **curl 测登录态**：session cookie 带 `Secure` 标志，curl 的 cookie jar（`-c`/`-b 文件`）在 http:// 下**不保存也不发送** Secure cookie，jar 文件会是空的、请求变匿名。必须从登录响应 `Set-Cookie` 头 grep 出 `zj_session=...` 原始串，用 `-b "$(cat 文件)"` 字符串形式发送。登录接口字段是 `identifier`（不是 studentNo/account）；登录路由恒返 200，失败在 body `error` 字段，别只看状态码。
- **dev 模式 console.log 会进 RSC 流**：服务端页面的 console 输出会被 Next dev 序列化进 flight payload（供 dev overlay），grep 页面 HTML 找数据 ID 时会被这些日志片段干扰——判断"学生端是否可见某任务"要 grep 渲染出的 `href="/design/{id}"` 链接，不要只数 ID 出现次数。
- **练习页参数契约是 `plantId`（曾回归为 404）**：`/plant-quiz` 读 `searchParams.plantId`；图鉴详情弹层、学习管理页共 3 处入口全部用 `?plantId=`。f22b266（错题订正制那轮）重写页面时曾把参数改成 `id` 且去掉首植物兜底与 AppShell，导致全站「开始练习」404——已修复回 `plantId` + `?? plants[0]` 兜底 + AppShell 壳。**改练习页时参数名、兜底、AppShell 三者都不得丢**；「继续订正」是客户端 `restart(verdict.pending)` 不走 URL。mastery/quiz_attempts 的 user_id 无 FK，删 auth.users 会留孤儿行，清理测试账号时按 `not exists(profiles)` 一并删。
- **⚠️ supabase-js updateUser 与 persistSession:false 不兼容（保存/改密曾静默全坏）**：模板客户端 `getSupabaseClient(token)` 以 `persistSession:false` + 仅 Authorization 头创建，storage 永远无 session。`auth.updateUser()`（`_updateUser`）强制要求 storage session、**无** custom Authorization 豁免分支，必然抛 "Auth session missing!"；而 `auth.getUser()`（`_getUser`）**有**豁免分支能正常用。所以凡是要写 auth 用户（改元数据/改密），一律走 `getAdminClient().auth.admin.updateUserById(user.id, …)`，字段名 `user_metadata`（非 `data`）。身份核验仍可用 userClient.getUser。
- **admin.updateUserById 改密会撤销该用户全部会话**：改密成功后旧 access/refresh 立即失效，下次请求 proxy 续期失败即登出，用户需重新登录——属预期（配合「密码已修改，下次登录使用新密码」文案）。
- **统计 catalog JS 体积要大小写不敏感排除 polyfill**：Next 注入的 polyfill chunk 属性是 `noModule=""`（大写 M），`grep nomodule` / 精确小写匹配会漏掉它、把 ~110KB 误算进 modern 口径。
- **⚠️ `.gitignore` 会让 Tailwind v4 跳过扫描对应源文件（曾致整文件工具类缺失）**：oxide 扫描器按 `.gitignore` 排除源文件。曾误把 `src/components/AppShell.tsx` 写进 `.gitignore`，导致该文件所有类（`max-w-shell`/`pl-1`/`w-80`/`max-w-[8em]` 等）不进候选、产物 CSS 无对应规则，且靠其它文件同名类或原型巧合掩盖、长期难察觉。排查"某工具类不进产物"时先 `git check-ignore <file>` 与翻 `.gitignore`；**不要把任何 `src/**` 源文件写进 `.gitignore`**。
- **原型 HTML 在 Tailwind 扫描范围内**：`.cozeproj/prototype/web/*.html` 未被 ignore，其类名（如 `max-w-7xl`/`z-40`/`top-11`）会进产物 CSS。判断"某类是否仍被源码使用"不能只看产物 CSS 有没有，要找**全项目唯一**且原型里没有的类来验证。
- **批量替换类名的正则边界（迭代 42 教训）**：perl 批量改 `border` → `border-neo` 时 lookahead 必须排除 `}`——曾把 admin/page.tsx 模板字符串 `${a.border}`（对象属性访问）误改成 `${a.border-neo}` 导致 TS 编译失败。批量改样式类前先确认该词没有作为 JS 标识符/属性名使用；改完立即 `pnpm build` 或 `tsc` 验证。
- **primary 从绿变黄后 `text-primary` 文字不可见**：柠檬黄 #FFD84D 在浅底上对比度不足，迭代 42 已把全站 60 处浅底 `text-primary` 批量改为 `text-foreground`、`ring-primary/*` 焦点环改 `ring-ink`。后续新增"强调文字"勿用 `text-primary`，用 `text-foreground` 或黄底黑字（`bg-primary text-on-primary`）。
- **next/font 会自动改写 CSS 里的字体族引用**：globals.css 里写 `'Space Grotesk', 'Noto Sans SC'` 会被 Next 构建改写为 `var(--font-grotesk), var(--font-noto)`（变量由 layout.tsx 的 next/font/google 在 `<html>` 上注入）。这是正常链路不是 bug，勿手动改回字面量；换字体时同步改 layout.tsx 的 `Space_Grotesk/Noto_Sans_SC` 导入。
- **产物 CSS 是压缩单行**：统计某规则出现次数用 `grep -o 'pattern' file | wc -l`，`grep -c` 只算行数会严重低估。
- **⚠️ Tailwind v4 无 `--size-*`/`--inset-*` 工具类命名空间（迭代 43 踩坑）**：在 `@theme` 定义 `--size-modal-sm: 440px` 后写 `w-modal-sm` 不会生成任何 CSS（模态静默丢宽）。正确写法是任意值包变量：`w-[var(--size-modal-sm)]`。有命名空间的是 `--text-*`（text-hero-number 可用）、`--container-*`（max-w-shell 可用）、`--color-*`、`--shadow-*`、`--radius-*` 等。
- **perl 批量替换中文需 `-Mutf8`**：`perl -CSD -i -pe 's/中文/…/'` 不生效（脚本字节未解码），必须 `perl -CSD -Mutf8`；`-0777` 多行模式下 `[\s\S]{0,N}` 的 N 要留足（表单 input 属性展开常超 200 字符）。
- **文件自动重排**：write_file/edit_file 后文件可能被外部重排（类名顺序、常量改名、空行），二次编辑前必须重读当前内容；跨文件改名前先 grep 确认引用方。
- **移动端顶栏品牌字体/抽屉圆角遗留（迭代 43 已修，勿恢复）**：AppShell 移动顶栏曾残留 `fontFamily: "Noto Serif SC", serif`（该字体未加载，实际回退）已删；抽屉面板 `rounded-[28px]` 违反 12px 圆角上限已改 `rounded-xl`。

## 二期迭代 1 · 植景设计模块

- 页面：`/design` 卡片列表（进度徽章）；`/design/[taskId]` 案例背景页（迭代 44 起左右双栏定高，FLIP 转场进工作台）；教师端 `/admin/design-tasks`（列表+发布/撤回/删除，教师导航"设计任务"入口）。
- 任务编辑表单（DesignTaskEdit）：任务名称/简介 + 学生问询条目（topic/keywords/importance/answer，critical 自动汇总 criticalEntryIds）+ S1 诊断项（label/hint/mustMention）+ 六阶段评分标准 `rubricsByStage`（label/weight/desc）+ 及格线；PATCH 整文写 task_def/nongyuan。评阅 LLM feedback 注入当前阶段 rubricsByStage。
- 删除任务：`DELETE /api/admin/design-tasks/[id]`，无外键级联，按 run_events→stage_records→student_runs→design_tasks 顺序删。
- 工作台 `src/components/design/`：DesignCase（壳+阶段条+抽屉）、StageDiagnosis（S1「场地顾问 AI」**语音通话**+诊断表，迭代 45 起）、StagePositioning（S2 定位+原则+理由）、StageZoning（S3 功能分区画布）、ReviewCard（评分+反馈+cards+重交/解锁）。S4/S5/S6 已在迭代 27/28/30 落地（StagePlanting/StageLayout/StageEvaluation）。
- **S1 场地顾问（原「场地问询」已改名）**：学生端文案/提示词自称均为「场地顾问 AI」（数据字段 `inquiry` 等未动）；**迭代 45 起交互为纯语音通话**（无文字输入，见「二期迭代 45」节）；AI 回复文本仍走 `ReactMarkdown + remarkGfm + .md-body` 渲染（挂断后的通话记录视图，与 /chat 同款，react-markdown 默认不渲染原始 HTML= XSS 安全，勿加 rehype-raw）。`.md-body`（globals.css）含表格/blockquote/`overflow-wrap: anywhere` 样式，为 /chat 与 S1 共用。已知遗留：ReviewCard 的评阅 feedback 仍是纯文本渲染（待后续轮次）。
- 数据：`public/data/tasks/chuangzhi-task.json`（stages/rubrics/referenceSolution）+ `chuangzhi-nongyuan.json`（site/inquiry/diagnosisForm/positioning/principle/scoring）+ `public/images/tasks/chuangzhi/*.svg`。DB：design_tasks/student_runs/stage_records/run_events + tasks_student_view（剥离 referenceSolution）+ RLS；种子 `scripts/seed_design_task.ts`（整文存 task_def/nongyuan jsonb）。
- API：`/api/design/chat`（问询条目匹配：标签同义≥2 或 关键词+实体共现，SSE 事件 `{type:"text",text}` / `{type:"meta",askedCount,criticalHitCount,newHits}`，禁泄 referenceSolution）；`/api/design/review`（规则算分+LLM feedback/cards，LLM 挂走规则兜底，passed 解锁下阶段，返回含 bestScore）；`/api/design/progress` GET/POST；`/api/admin/design-tasks(+[id])`。
- **学生端防剧透（P0 红线）**：`/design/[taskId]` page 下发前必须脱敏——`safeTask` 解构剔除 `referenceSolution`，`safeCase` 再剔 `case.designTaskNote`（内部备注含评分锚点词）；`safeNongyuan` 剔除 `site`（zones/baseMap/constraints 含答案）、`positioningRule`，inquiry.entries 只留 id/topic/importance（answer/keywords 不下发），diagnosisForm 只留 key/label/hint（mustMention 不下发），principleOptions 剔 `correct` 标记。改该 page 时保持脱敏，勿把 full.task/nongyuan 直接传客户端。
- **案例背景为「改造前」公开版**：`chuangzhi-task.json` 的 `case` 块已换公开版（含 `backgroundSections` 4 段、`designTaskNote` 内部备注——禁词 2016/集装箱/小蓝屋/稻田/湿地/朴门菜园/一米菜园/儿童活动区/沙坑/树皮软坑/蹦床/四方运维/AAAA 不得进学生端）；`chuangzhi-nongyuan.json` subtitle 已去"2016年建成"。DB 行已同步（定点 `jsonb_set`，勿整行覆盖）。`requirements/complianceRules/publicReviewCards/inquiry` 内的功能区指称待教师决策，暂保留。C4 展开全文抽屉=FullTextDrawer（读 `case.backgroundSections` 的 title/text，顶条缩略图旁按钮，motion-reduce 无动画）。
- **案例卡播报/简介来源=教师「任务简介」（intro 列），不是 case.background**：教师端编辑的任务简介存 `design_tasks.intro` 列（task_def 内无此键）；`getTaskFull` 须 `select("task_def, nongyuan, intro")` 并把 `intro` 并入返回的 task，`DesignCase` 的 `<CaseIntro text={task.intro || case.background || case.summary}>` 优先用 intro。曾只读 case.background 导致教师改简介不生效（2026-09 修复）。local 模式 JSON 无顶层 intro，回退 case.background。
- **exec_sql 环境**：应用实际读写的 Supabase = exec_sql **develop** 环境；**product 是另一个只读环境**（数据可能滞后/不同），验证线上数据要在 dev 页面或用 develop 环境查询，别被 product 旧值误导。
- **前后端提交契约**：S1 submit body `{taskId,stageKey:"S1",payload:form,meta:{hitEntryIds,askedCount}}`（review 从 `body.meta` 读，放顶层会导致 coverage 恒 0）；S2 payload `{primary,secondary:[],principles,reasons:{r1..}}`（ruleScoreS2 按此读，reasons 是对象不是字符串）。
- **刷新恢复（C12）**：服务端恢复=run.stage_payloads/stage_reviews/stage_scores（page 传入 initialRun）；对话文本与未提交草稿=localStorage，key `zjxj:design:{taskId}:{S1|S2}:{userId}`（S1 存 messages/hitEntryIds/askedCount/form，S2 存 mainPos/principles/reasons）。
- saveStageRecord 支持 passScore 参数并返回 `{attemptNo,bestScore}`；ReviewCard 展示"本次 x 分 · 历史最佳 y 分"。
- dev 模式 RSC payload 会混入 React 19 dev-only 调试块（孤立 supabase Response chunk 含全量 task），属开发仪表数据，生产构建已验证无 referenceSolution/answer/correct 泄漏；排查泄漏以 `next build` 产物为准。
- local 模式：任务读 json，进度存 localStorage（design.ts 双模式）。

### 二期迭代 5 · S3 功能分区与空间骨架（画布）

- **布局（教师指定四栏）**：左=CasePanel（DesignCase 已渲染，与 S1/S2 一致）；中上=S2 产出回显（只读：主定位 + 设计原则 chips，从 `run.stage_payloads.S2` 读，经 positioningOptions/principleOptions 映射 id→label）；中主体=画布；右=AI 评阅卡（提交前显示 rubricsByStage.S3 要求 + 提交按钮，提交后显示 ReviewCard）。
- **画布 `ZoningCanvas.tsx`**：SVG。底图 `<image>` = 教师提供的**空白未分区**平面图 `public/images/tasks/chuangzhi/site-plan-blank.webp`（1024×2048，16KB，由 `assets/创智农园原始场地图_未分区.png` 转 webp）。**⚠️ 勿用 `site-map-full.svg`——那是含 5 个命名单元的答案图，不得给学生。**
  - 坐标系：`canvasGeom(base)` 由底图尺寸推导**正方形画布** `S=ceil(hypot(bw,bh))+20`（=2310），底图居中放置（imgX/imgY），绕中心 `C` 旋转——正方形保证 360° 任意角度底图完整可见。分区顶点存**内容坐标**（逆旋转后），渲染在 `rotate(angle C C)` 组内。
  - **360° 旋转**：工具条左转/右转 15°、滑杆 0-359、复位；点击坐标经 `getScreenCTM().inverse()` → viewBox 坐标 → 逆旋转回内容坐标，任意角度落点准确。
  - **缩放（放大/缩小）**：用动态 `viewBox` 窗口实现（放大=窗口变小，`view.w ∈ [S/8, S]`），工具条 ZoomIn/ZoomOut 按钮 + 滚轮缩放（围绕鼠标位置，原生 wheel 监听 passive:false）+ 百分比显示；「复位」同时复位角度与缩放。因 `getScreenCTM()` 自动适配 viewBox，任意缩放级别点击落点仍精准；描边/顶点/字号乘 `zk = view.w/S` 补偿，保持屏幕视觉大小恒定。
  - **多边形绘制**：「新建分区」→ 点击落点（rubber-band 预览线 + 顶点圆点，首顶点绿色放大）→ 点首顶点或「闭合」（≥3 点）成区 → 弹命名层（名称 + 自动配色）→ 生成 zone。
  - **分区管理**：zone=`{id,name,color,points,note?}`；分区列表 chips（色点+名称+面积%）点选高亮；选中后可编辑名称/改色（8 色 PALETTE）/删除。半透明填充（选中加深）+ 中心名称标签（描边防糊）。
  - **本轮未做（教师知情后置）**：顶点拖动微调、撤销/重做。
- **脱敏**：page.tsx `safeNongyuan.canvas = { asset, viewBox:[0,0,1024,2048] }` 只下发空白底图与坐标系；`site`（含答案 zones/constraints）保持 `undefined` 不下发。
- **评阅（规则 + LLM 各半加权，教师确认）**：`/api/design/review` S3 分支。
  - `ruleScoreS3(payload, meta)` 结构分 0-100 = 分区数量 25（≥5 满/≥4 22/≥3 18）+ 命名 25（全命名 15 + 不重名 10）+ 覆盖率 30（30%-95% 满，shoelace 面积和 / site 面积）+ 顶点在场地内 20。`meta.site={x,y,w,h}`/`meta.siteArea` 由客户端从 canvasGeom 传入。
  - `llmScoreS3(...)` 返回 `{score 0-100, feedback, cards}`，prompt 注入 rubricsByStage.S3 + 结构分明細 + S2 定位与原则 + 案例背景（backgroundSections，≤1200 字）+ 分区摘要（名称/面积%/顶点数）。
  - 最终 `score = round(rule*0.5 + llm*0.5)`；LLM 挂（score=null）回退纯规则分。`detail` 含 `llmScore`。
  - POST 顶部已提前 `ensureRun`（S3 需读 `run.stage_payloads.S2` 组装回显文案）。
- **提交契约**：S3 submit body `{taskId, stageKey:"S3", payload:{zones}, meta:{site:{x,y,w,h}, siteArea}}`。通过后 `NEXT_STAGE.S3="S4"` 自动解锁。
- **刷新恢复**：服务端=stage_payloads/reviews/scores.S3；草稿 zones 存 localStorage，key `zjxj:design:{taskId}:S3:{userId}`。
- **已实测**：建一次性学生→提交 4 分区→规则 97 / LLM 70 / 最终 84 通过解锁 S4，progress 落库正确；测试账号及 run/stage/孤儿行已彻底清理（users=0/orphan=0）。

### 二期迭代 48 · S3 画布手势 + 铅笔 + 手绘图上传（迭代 5 的升级，上文手势描述以此为准）

- **ZoningCanvas 手势层（Pointer Events 重写）**：工具条三工具**铅笔（默认）/落点/拖动**；原「新建分区」按钮已删（落点工具首次点击即起稿）。手势：拖动工具/空格临时平移=拖动画布；落点模式按住拖动=平移、轻点=落点；铅笔拖动=画曲线、**轻点（<3 采样点）=选中/取消点中的分区**；滚轮缩放保留（以指针为中心）；触屏双指=捏合缩放+平移（单指跟工具）。平移有 clamp 不出界；「复位」=角度归零+视图适配（图标 `Expand`）。
- **S3 撤回/删除 + 无弹窗建区（教师两轮点名，勿回退）**：① 围合（铅笔曲线闭合/落点闭合）**不再弹命名窗**——`onDraftClose` 直接按 `nextZoneName()`（避开已占用的「分区 N」号）+ 轮转配色建区并自动选中，改名/换色全在底部选中面板；`pending`/`pendingName`/命名弹层已删，勿恢复。② 「撤回/删除」为**纯图标**按钮，放在 **ZoningCanvas 工具条放大/缩小左侧**（`Undo2`/`Trash2`，经 `onUndo/onDeleteSelected/canUndo/hasSelection` props 传入）；上传模式无画布工具条，撤回/删除图标收进底部选中面板。撤回=`history` 栈（`commit()` 新增/删除分区前压入当前 zones，上限 50），改名/换色等 patch 不入栈。铅笔图标为自绘 `PencilIcon`：**描边空心简笔铅笔**（斜置笔杆轮廓 + 左下收尖笔尖 + 笔尖分界线，strokeWidth 2.4，18px），已用 sharp 栅格化点阵验证一眼可辨。**勿换回 lucide `Pencil`（顶部横穿箍线，小尺寸像十字架），也勿改回实心多段斜带（同色实心会糊成一条对角线、看不出笔尖）**。
- **铅笔**：笔迹采样（最小步长 S*0.004）→ RDP 简化（eps=S*0.0025，上限 100 点，超限自动加大 eps）→ 首尾距离 < S*0.02 自动闭合，否则直线闭合+提示 → 复用命名弹层。产出仍是 `points[]` 多边形，面积/结构分/下游全兼容。
- **上传手绘图模式**：StageZoning 分段切换「画布划分/上传手绘图」。图片走 `POST /api/design/upload-sketch`（登录即可、≤8MB、sharp 压 webp 长边 1600）→ Supabase 桶 **`design-sketches`（公开读，dev+product 已建）** → 公开 URL。本地模式该入口禁用。
- **S3 上传评阅分支**（`/api/design/review`）：`payload.mode==="upload"` 时跳过规则分，`llmScoreS3Vision`（doubao-seed-2-0-lite 多模态，image_url 传公开 URL）**100% AI 分**，AI 同时识别图中分区名（2-8 个，识别不出兜底「分区 1/2/3」），服务端配 id+ZONING_PALETTE 色后写回存档 `payload {mode:"upload", imageUrl, zones}`、`meta {mode:"upload"}`，响应附 `zones`（客户端回显）。AI 失败返 500 不落记录。画布分支（规则+LLM 各半）不变。
- **⚠️ zones 可能无几何（上传模式 `points: []`）**：下游消费必须守卫 `z.points?.length >= 3`——`PlantingCanvas`（`geomZones` 过滤 + `fallbackZoneId` prop：无分区几何时落位归入所选分区、跳过底图多边形、提示语切换）、`PlantingDiagram`（跳过无 points 分区边界）、`StageLayout`（`hasGeom` 为假默认选中第一分区）。S4 只用 id/name/color 不受影响；**新增分区几何消费方时同样要守卫**。
- **已实测**：临时学生冒烟（跑完已清理）——上传模拟手绘图→评阅 68 分通过、AI 准确识别「入口花园/科普花境/可食菜园」→ progress 回读正确、S4 解锁；画布模式回归 81 分正常。铅笔手势为浏览器端行为，未做自动化验证。

## 消息通知（迭代 38）

- 表 `notifications`（id uuid / user_id / sender_id / type='design_reminder' / title / content / task_id **text**（与 design_tasks.id 同型，勿用 uuid——真实任务 id 是 `task-chuangzhi-01` 这类文本）/ link / read_at / created_at）；RLS 仅学生 select/update 自己的行，insert 不开放（全走 service role）。索引 `(user_id, created_at desc)` + 部分索引 `(task_id, user_id) where read_at is null`。schema.ts 已同步。
- 教师提醒链路：DesignTasksAdmin 已发布卡片「提醒未完成」铃铛按钮 → `design/RemindModal`（GET 未完成名单 + 留言 ≤100 字 + 发送）。未完成 = 发布班级（`published_classes` 班级码，空数组=全员）内无 `student_runs` 或 `status != 'completed'`（completed 仅在 S6 评阅通过时写入）。
- 防重复：发送时跳过该任务已有**未读**提醒的学生（允许再次提醒已读者），返回 `{reminded, skipped}`。
- 学生端：AppShell `NAV_STUDENT` 末项「消息通知」（Bell 图标），未读角标 = `bg-error` 红底白字 13px（>99 显示 99+）；角标数据来自 `/api/notifications/unread` 轮询（挂载 + 每 60s，仅学生）。`/notifications` 页 = `NotificationsClient`（列表/全部已读/点击卡片标记已读并按 link 跳转 `/design/{taskId}`）。
- 学生侧栏底部用户卡按钮为常驻 `bg-white/10 hover:bg-white/15`（迭代 38 用户点名：与绿色侧栏区分，勿改回透明底）。
- local 模式：通知类 API 返回空/400（`本地模式不支持消息通知`），入口照常显示空态。
- 冒烟脚本 `scripts/remind_smoke_test.ts`：建临时教师/学生（独立班级码 test-remind，避免波及真实学生）+ 临时已发布任务（**刻意用非 uuid 的 text id**，回归 task_id 类型问题）走完全链路后清理；跑完核对 `notifications 孤儿=0`。

## 班级管理（学情看板内）

- `classes` 表（id/name/invite_code/created_at，RLS 教师可写）；种子：景观2301-2303（码 jg2301-03）+ 测试班（码 test01）。
- API：`/api/admin/classes`（GET 列表含人数/POST 建班生成邀请码）、`/api/admin/classes/import`（POST 名单导入）、`/api/admin/classes/[id]`（DELETE 删除班级）。
- 导入语义：已有学号→移入班级（同步 metadata class_code/class_name）；新学号→admin.createUser 建档（默认密码=学号后 6 位，UI 有提示）；同班跳过、失败计数。
- 删除班级语义（`deleteClass`）：该班学生 profiles 置 `class_name/class_code=null`（转未分班，账号与学习记录保留）→ `design_tasks.published_classes` 移除该班邀请码 → 删班级行；返回 `{ok, unassigned}`。UI 在班级行右侧垃圾桶按钮 + 确认弹窗（警示文案见 ClassAdmin）。
- 注册邀请码：先查 `CLASS_CODES` 硬编码，未命中再查 `classes` 表 invite_code（auth-service register）。
- UI：`src/components/ClassAdmin.tsx`，渲染在 StudentsClient 网格最上方（班级掌握对比/最近练习动态之上）。
- 演示数据：逻辑在 `src/lib/demo-seed.ts` 的 `ensureDemoData()`（幂等），`scripts/seed_demo_data.ts` 只是手动运行入口。**服务启动后异步自动执行**（server.ts listen 回调内 fire-and-forget）——开发/生产两套 Supabase 是分开的库，沙箱里手动灌的数不会进生产库，生产环境靠首次启动自动补齐。幂等护栏：学号段 `20232001%` 已齐 158 人则跳过班级/名单同步（防止教师删班后被重启复活）；学情按学生逐个判断，已有练习记录者跳过（重点账号 >50 条才跳过）。内容=景观2301 158 人名单（20232001001..158，027=秋千）+ 分层学情（26% 活跃/44% 中等/20% 低/10% 无数据）+ 重点账号加量（48+ 掌握、近 7 天每日练习、8 组问答）。手动运行需从运行中服务进程 `/proc/PID/environ` 提取 COZE_SUPABASE_* 注入 shell。

## 二期迭代 2 · 安全加固四件套（S10/S7/S2/S11）

- **S10 tasks_student_view 重建**：`security_invoker=true`，仅 12 安全列（`id,case_id,title,subtitle,cover_url,tags,difficulty,est_minutes,intro,stages,status,task_def`），`task_def` 已剥 `referenceSolution`+`case.designTaskNote`，`WHERE status='published'`。anon 已 `REVOKE`（401），authenticated 保留。唯一消费方 `listPublishedTasks`（design.ts），`.order("id")`（视图无 created_at，曾误用导致列表空）。DDL 后须 `NOTIFY pgrst,'reload schema'`。schema.sql 已同步。
- **S7 接口鉴权+限频**：`/api/plant-render`（requireUserToken + 每用户 3/分、30/天，仅真实生成计数，缓存命中不耗配额，超限 429 中文提示）；`/api/plant-resources`（requireUserToken）。ChatClient generateRender 解析 401/429 在按钮下方显示 `text-error` 提示。匿名访客资源包不加载、生成按钮随之隐藏（预期）。
- **相关推荐图片只用本地图鉴图（教师指定，勿再引网络图）**：`/api/plant-resources` 的 `images` 不再走 `SearchClient.imageSearch`（网络图常加载失败、回退单字占位很丑），改为该植物本地 `images.full/close/thumb`（去重，均 `/images/plants/…` 必定可加载）；`links` 仍走 webSearch 保留，`/api/plant-render` 造景效果图不变。`use-chat.ts` `resourceImgs` 只保留 `url.startsWith("/images/")` 的图并标 `local:true`（历史会话残留的网络图被过滤，点图跳 `/catalog?plantId=`）。
- **S2 会话续期**：`zj_session` 升级为 `access|refresh`（传输中 `|` 被编码为 `%7C`，读取自动解码）。**`src/proxy.ts`**（Next 16 中 middleware 已更名 proxy；proxy 默认 Node.js 运行时，配 `runtime` 会报错）在 access 剩余 <5 分钟（含过期）时用 refresh 续期，回写浏览器 cookie + 重写本次请求 cookie 头（下游同请求即用新 access）；失败清 cookie 登出；并发续期走进程内 in-flight Map 去重。`getSessionToken()` 返回解析后 access（缓存键=access）；`setSessionCookie(access,refresh,remember)`。旧格式 access-only cookie 平滑兼容。
- **S11 一次性重置码**：`password_reset_codes` 表（code_hash sha256、expires_at 15min、used_at、fail_count，RLS 无策略仅 service_role，已 REVOKE anon/authenticated）。`createResetCode`（8 位数字，新码顶替旧未用码）+ `resetPassword({identifier,code,password})`（连错 5 次该生所有未用码失效）。教师端 `POST /api/admin/reset-codes`（限频 5/分，429）；学生端 `POST /api/auth/reset`（IP 限流 10/15min，429）。AuthPanel 重置表单=学号/重置码/新密码；StudentsClient 每行"重置码"按钮+弹窗提示"线下告知、15 分钟、仅一次"。已移除"学号+姓名"自助重置。

## 二期迭代 3 · 教师端两栏题库编辑 + 掌握判定改「错题订正制」

- **判定口径（唯一入口）**：掌握 ⟺ 曾答对题数 / 该植物当前题数 ≥ passRatio（默认 100%，可配 50–100%）。纯函数核心 `src/lib/mastery-engine.ts`（`everCorrectQids`/`computeMastery(FromParts)`/`questionIds`/`ensureQuizQids`，客户端安全），服务端取数装配在 `src/lib/mastery-service.ts`（`computeMasteryForPlant/ForUser/computeAllMastery`）。结果页、图鉴徽章、掌握筛选、学情看板四处共用，口径天然一致。已掌握不撤销 = everCorrect 集合只增不减；增题扩分母会暂时掉到未掌握（需把新题答对）；删题后该题历史自动出局（无幽灵题）。
- **题目稳定 ID（qid）**：每题带 `qid`（掌握按题聚合的依据）。DB 已迁移（md5 确定性）；教师新增题前端 `genQid()`；本地 json 由 `ensureQuizQids` 合成。旧 `quiz_attempts.answers` 因 `map(Number)` 存成 `[null,...]` 已废弃该写法——新格式存 `[{qid,picked,correct}]`；legacy 行仅在整卷全对时按「当时全对」折算计入当前题。
- **阈值配置**：`app_settings` 表（key/value jsonb，RLS 仅 service_role，已 REVOKE）。键名/读写在 `src/lib/settings.ts`（`getMasteryPassRatio` 缺失/非法回落默认不抛错；`setMasteryPassRatio` 越界返回 error；`getRebaseReport`）。默认值/区间常量单点在 mastery-engine，settings 转发。教师入口：`/admin-plants` 顶栏「掌握判定」弹窗；接口 `GET/PATCH /api/admin/settings`（PATCH body `{masteryPassRatio: 0-1}`，教师限定，400 中文提示）。
- **口径重算**：`scripts/mastery_rebase.ts`（可重跑，--dry 预览）按新口径重写 mastery.mastered（manual 行跳过），差异报告写 `app_settings(mastery_rebase_report)`，学情看板顶部横幅展示口径说明 + 受影响人数（0 变化时显示"无变化"）。
- **教师端 `/admin-plants` 两栏主从**：`PlantsAdminClient` 左栏植物列表（名称/分类/层级/安全/更新时间/编辑/删除，移除练习题数列，选中高亮，默认选中第一项），右栏该植物练习题**卡片分页（一屏一题）**：固定高度容器（`h-[520px] lg:h-[calc(100vh-240px)]`，两栏等高，不随题量变长），切题=切 `currentIdx` 索引（草稿统一由 `quiz` 数组持有，跨题不丢）；三种切题=底部上一题/下一题按钮 + 键盘 ←/→（输入框/弹层内守卫）+ 触屏滑动（`touchStart` ref 判 dx>48）；顶部「第 n / N 题」+ 题号条（≤15 题数字按钮、>15 题收缩为圆点，横向滚动，当前题=主色、已改未保存=警示色）+ 细进度条；末题显示「完成」（滚回顶部，无提交语义）；切题动画 `animate-qcard-next/prev`（globals.css keyframes，`prefers-reduced-motion` 时关闭）。维度限 6 个既有维度下拉、4 选项必填、正确答案单选、解析；删最后一题被阻止；切换植物/离开页面有未保存确认（**切题不提示**）。保存复用 `POST /api/admin/plants`（整株 data 含 quiz），未新增题目接口。植物档案编辑弹层保留（不再含题目区）。
- **学生端**：`loadPlantsForServer()`（data.ts）cloud 读 DB plants 表 / local 降级 json，均保证 qid——`catalog`、`plant-quiz` 已切换（教师改题对学生即时生效；此前学生端只读 plants.json 是既有缺口）。练习优先出未答对的题（pendingIds 排前），结果页动态文案「还有 n 道题未订正」+「继续订正」入口；空题库友好提示。
- **硬编码清理**：业务逻辑已无题数/阈值字面量（`>= 5`/`=== 6`/`>= 0.8` 等）；learning 页与 StudentsClient 的得分配色分档提取为 `DISPLAY_*_RATIO` 展示常量（与判定无关）。`TOTAL_PLANTS` 常量移除，改由页面传 `totalPlants`。chat-fallback 文案中"135 种植物"为数据集描述性文案，未动。

## 二期迭代 4 · 智能问答对话管理（E1/E2/E3）

- **对话分组**：`chat_messages` 加 `conversation_id text` 列 + 索引 `idx_chat_user_conv(user_id, conversation_id, created_at)`（schema.sql 已同步，role check 放宽含 `conversation_meta`）。`/api/chat` 接收并落库 `conversationId`。
- **`/api/chat-history` 重写**（原为死代码）：GET 无参=按 conversation_id 分组列表（标题取 meta 行或首条 user 消息截 40 字，按 lastAt 倒序）；GET ?conversationId=按需加载该对话消息（排除 meta 行）；PATCH=重命名（标题存 `role='conversation_meta'` 行，零新增列/表）；DELETE=删整个对话。均走 user client + `user_id` 过滤。
- **旧数据兜底**：`conversation_id IS NULL` 归入虚拟 `legacy` 对话，标题固定「历史记录」（可重命名），零迁移不丢数据。
- **ChatClient**：左侧历史对话栏（`lg:grid-cols-[240px_minmax(0,1fr)_300px]`，窄屏折叠为顶部展开块）；`sendMessage(text, targetPlant)` 统一发送入口——快捷提问/手输/回车/自动开讲全走它，无活跃对话时 `crypto.randomUUID()` 自动建对话，绝不另开对话；`stream(prompt, plant, convId)` 三参；切换对话 `openConversation` 按需加载。
- **推荐图片兜底**：`ResImg` 组件 onError 回退植物名首字占位块；图片行前置本地缩略图 `/images/plants/thumbs/{id}.webp`（链接到 `/catalog?plantId=`），网络图在后。
- 页面 `/chat` 不再 SSR 平铺加载历史（原读最近 100 条已移除），登录态进页面拉对话列表并自动打开最近一条。

## 二期迭代 5 · 教师端植物智能识别与自动填充（含练习题生成）

- **入口**：`/admin-plants` 植物档案编辑弹层（新建+编辑共用）顶部「智能识别」区：总文本框（不落库、识别后不清空）+「智能识别」按钮（识别中禁用防并发）+ 清空。空文本点击只提示不发请求；>8000 字提示精简。
- **路由**：`POST /api/admin/plants/parse`——getSessionUser 鉴权（未登录 401 / 非教师 403；不用 requireTeacher，它未登录是 redirect 不是 401）+ 进程内限频（5/分、100/天，超限 429）+ LLMClient.stream 累积（同评阅路由）+ 逐字段校验，**只读不写库**；写库仍走教师点「保存」的 `POST /api/admin/plants`。
- **校验核心 `src/lib/plant-parse.ts`**（纯函数、客户端安全）：枚举白名单全部提取自 plants.json 135 条实际取值（LAYERS/LIGHT_NEED/WATER_NEED/SOIL_PH/SOIL_DRAINAGE/PEAK_SEASON/CATEGORIES/TAG_GROUPS/REGION_TAGS/FUNCTION_TAGS/RISK_TYPES/QUIZ_DIMENSIONS）；非法枚举/越界数值/非法月份 → 丢弃计入 invalid；缺失计 unparsed；`deriveMonths`（花期推算前剔除「果期」片段，防果期月份并入花期）、`deriveHeight`、`deriveMinTemp` 做派生自洽——LLM 结构化值与文本矛盾时以文本推算为准并标 needsCheck；`extractLlmJson` 容错 ```json 围栏与前后说明文字。
- **安全保守策略（红线）**：`safeForChildren` AI 永不自动填（客户端也硬跳过），固定进 needsCheck「需教师确认」；`isWarning` 只接受 true（资料明确提风险），false 不采纳；资料未提风险时 warning.* 子项不进任何清单（避免噪音），仅 isWarning+safeForChildren 提示确认。
- **客户端填充机制**：表单是非受控 input（defaultValue）——表单内字段经 `formRef.elements.namedItem` 命令式赋值（`FORM_NAMES` key→name 映射），不在表单的字段（soil.ph/drainage、minTempC、peakSeason、seasonInterest、tagGroups 等）走 `setEditing`+`applyEditingPath`。只填空项（select 默认值 no/caution 视为空）；已有内容不同 → 差异清单逐条「采用」。识别失败：大框文本保留、表单零改动、错误提示。
- **待确认题目区**：生成的题不自动入库，卡片式就地编辑（维度下拉限既有 6 维/题干/4 选项/答案 radio/解析），逐题或全部「采用」→ 进题目草稿：编辑对象=当前选中植物 → `setQuiz` 追加；新植物 → `editing.quiz` 随弹层保存；编辑非选中植物 → `pendingAdoptRef` 切换选中后在 [resolvedId] effect 并入。服务端题目校验：维度非法/选项不足 4/缺答案/维度重复/题干重复 → 丢弃并给原因（`droppedQuestions`）。
- **save() 防丢题**：弹层保存时 `quiz: editing.id === resolvedId ? quiz : editing.quiz`（以右栏草稿为准，避免回退已采用题目）；新植物自动补 `seq = maxSeq+1`；`openNew` 预填建议 id `p{maxSeq+1}`。
- **空图兜底**：PlantCard 无 thumb 时渲染 Flower2 占位块（防新增植物空 src 破图，布局未变）；管理端列表原本已有占位。
- 已实测：401/403/400（空/超长）/429 限频；真实识别 33 字段全合法（金桂样例）；非法枚举「半阴」丢弃；派生矛盾按文本推算+needsCheck；题目 4 类丢弃原因；新植物 p136 保存→入库→清理。

## 二期迭代 6 · 教师端任务管理两栏目（发布到班级）

- **A1 改名**：教师导航「设计任务」→「任务管理」（href 不变 `/admin/design-tasks`）；路由/字段/接口/文件名/组件名均未动；学生端 /design 空态文案改「教师尚未发布新任务，请稍后再来。」（原含"设计任务"字样）。
- **数据模型**：`design_tasks.published_classes jsonb not null default '[]'`（存 classes.invite_code 数组）。`tasks_student_view` 用 CREATE OR REPLACE **末尾追加列**（不 DROP，权限不变，视图追加列合法）。**过滤在应用层**（`listPublishedTasks(classCode)`）：视图经 admin client（service_role）读取，`auth.uid()` 为 NULL，RLS 班级过滤不可行。**空数组=全班可见**（宽松规则，存量 task-chuangzhi-01 不受影响）。
- **学生可见性链路**：`/design` page `getSessionUser().classCode`（来自 profiles.class_code）→ `listPublishedTasks(classCode)` → `classes.length===0 || classes.includes(classCode)`。
- **发布流程**：任务库卡片/编辑页「保存并发布」→ `PublishClassModal`（fetch `/api/admin/classes` 多选）→ PATCH `{status:"published", publishedClasses:[codes]}`。PATCH 校验：显式传空数组 → 400「请至少选择一个班级再发布」；未传 publishedClasses 时查库现有值，为空同样 400。
- **撤回**：PATCH `{status:"draft"}`，学生端立即不可见；**学生 student_runs/run_events 记录保留不删**。删除任务才级联清 run_events→stage_records→student_runs→design_tasks。
- **列表页 `DesignTasksAdmin`**：Tab=任务库（**全部任务**，发布后保留，见迭代 25）/已发布的任务（=published）带计数+各自空态；卡片栅格 `grid-cols-1 lg:grid-cols-2 min-[1440px]:grid-cols-3`；卡片=封面（无封面 ImageOff 占位）+状态徽章+标题/副标题+`line-clamp-2` 简介+发布班级徽章+更新时间+操作（编辑/发布/撤回/归档/删除，撤回与删除二次确认；「发布」对所有任务常显，已发布=编辑发布班级）。
- **编辑页 `DesignTaskEdit`**：SECTIONS 顺序=基本信息→**发布信息**（A6 移到正下方）→任务简介→学生可问问题→场地诊断表→评分标准；左侧 `sticky top-28` 锚点导航（`scrollIntoView` 不产生 history，window scroll 监听联动高亮，`scroll-mt-28` 防遮挡，窄屏隐藏）；任务简介独立卡片 `min-h-[240px] resize-y` + ①任务背景②学生任务示例提示 + 字数统计；保存/发布前校验 title 与 intro 必填（空则拦截提示）。
- **学生统计模块**见二期迭代 7（本轮后续补齐）。
- 已实测：发布→test01 班学生可见/jg2301 班学生不可见；撤回→两班均不可见且学生 run 保留；空班级发布 400；删除级联清零；tsc 通过。

## 二期迭代 7 · 学生统计模块（任务内 + 学情看板，同一口径）

- **唯一聚合实现**：`src/lib/design-stats.ts`（`computeTaskStats` 纯函数 + `loadPublishedTaskStats`/`loadTaskStatsDetail` 取数装配）。任务管理卡片/详情弹窗与学情看板模块**共用同一接口**，禁止在别处另写聚合。
- **接口**：`GET /api/admin/design-task-stats`（教师限定，getSessionUser 鉴权：匿名 401 / 学生 403）。无参=全部已发布任务汇总（列表页一次请求，**固定 4 条查询与任务数无关**：design_tasks→profiles→student_runs→stage_records）；`?taskId=`=单任务统计+学生明细下钻（仅已发布任务，撤回返回 404）。
- **口径**：已提交=stage_records 有该任务的行（student_runs 有行仅代表进过工作台）；各阶段最佳分=该生该阶段历次提交最大 score（重交降分不丢达标）；总分=Σ(阶段最佳分×stageWeights)/100，缺交阶段计 0；达标=总分≥passScore（解析序 `nongyuan.scoring.passScore ?? task_def.passScore ?? 60`，与 review 路由一致）；应提交=发布班级在册学生数（**published_classes 为空=全部学生**，与可见性规则一致）；提交率分母为 0 时返回 `null`（UI 渲染「—」，零除保护）。
- **stageWeights 兜底**：教师新建任务 task_def 不带 stageWeights（DesignTaskEdit buildBody 只展开原有 task_def）→ 按开放阶段等权（100/开放阶段数）兜底，否则总分恒 0；种子任务均带权重不受影响。
- **阶段分布只展示开放阶段**：`OPEN_STAGES=["S1","S2"]` 与 review 路由 `STAGE_NOT_IN_ITER1` 同步，S3+ 开放时两处一起改；未开放阶段不出现 0 行占位。
- **已知口径事实**：种子任务 stageWeights 六阶段合计 100（S1=20/S2=10/…），当前仅 S1/S2 可提交，按六阶段权重总分上限 30 < passScore 60 → 种子任务达标人数恒 0（直到 S3+ 开放）；教师新建任务走等权兜底不受此限。
- **撤回任务**：统计列表只查 status=published，撤回即不展示；历史 student_runs/stage_records 保留，重新发布后统计自动恢复（保留但不展示）。
- **安全**：接口只返回聚合数字与学号/姓名/班级/状态标识，不含 payload/feedback/答案正文（已实测关键词 0 命中）。
- **UI**：任务卡摘要行（已提交 x/y · 提交率 · 达标，暂无提交/加载中兜底）+ BarChart3 按钮开 `TaskStatsModal`（详情下钻含学生表）；学情看板 `DesignTaskStatsBoard`（ClassAdmin 下方，任务切换 pills + `TaskStatsPanel`）。两处共用 `TaskStatsPanel` 渲染。**迭代 51 起学生表含学情列**（掌握/练习/问答/最近活跃，口径=学习管理大屏：`getStudentRows()` + chat_messages 计数，`loadTaskStatsDetail` 内填充；`computeTaskStats` 本身只产 0 值，学情是详情层叠加），任务完成与学情并排看。
- 已实测：权限 401/403；真实任务数字正确；班级范围过滤（发布 test01 只计 test01 在册）；空班 rate=null；最佳分取值（S1 历次 80/55 取 80）；23 个已发布任务汇总 60–110ms；撤回后列表剔除+详情 404；plants.json 未动；tsc 通过。
- **可统计指标清单（供下一轮 AI 学情分析）**：任务维度=应提交/已提交/提交率/达标人数/总分分布/最近提交时间；阶段维度=各开放阶段提交数/通过数/最佳分分布；学生维度=提交状态/各阶段最佳分/总分/达标状态/最近提交时间；班级维度=按 published_classes 或 profiles.class_code 分组。可选过滤：任务 id、班级 invite_code、阶段 key、提交状态、达标状态；时间范围可按 stage_records.created_at 过滤（当前接口未暴露，B 组需要时扩展）。

## 二期迭代 8 · 性能优化（首页底图 + 图鉴首屏 + 构建瘦身）

- **首页底图去 base64**：`src/lib/hero-image.ts` 从 603K 字符 base64 常量改为路径串 `"/images/hero/community.webp"`（HERO_IMG 名保留，HeroMask 未动结构）；资源 `public/images/hero/community.webp`（sharp q70 320KB，源 1920×1080 原样）+ `bloom.webp`（1600w q78 262KB，替换 bloom.jpg 引用）；hero `<img>` 加 `fetchPriority="high"`。原 community.jpg/bloom.jpg 仍在目录内但已无引用（public/images 禁改约束，不删）。效果：首页 HTML 614KB→8.8KB，`data:image` 0 命中，630KB chunk 消失。
- **图鉴首屏 PlantLite**：`lib/types.ts` 加 `PlantLite`+`toPlantLite`（仅 id/name/latin/category/layer/alias/functionTags/tagGroups/images.thumb/isWarning/warning.restriction/safeForChildren/phenology.text）；`catalog/page.tsx` 传 lite；PlantCatalog/PlantCard 改用 lite。首屏 SSR 12 张（`PAGE_SIZE=12`）+ IntersectionObserver 哨兵增量追加（rootMargin 600px）；筛选/搜索/排序仍全客户端（字段都在 lite 里）。效果：/catalog HTML 1.4MB→125KB，answerIndex/quiz/notes/seasonInterest/imageCredit 学生端首屏 0 命中（answerIndex 泄漏修复）。
- **详情按需加载**：新公开接口 `GET /api/plants/[id]`（登录限定 401；`loadPlantsForServer()` 取全量后 find，**解构剥离 quiz** 返回，单株约 1.7KB；404 友好）。`PlantDetailModal` props 改 PlantLite，打开时 fetch 详情，模块级 `detailCache: Map` 同会话不重复请求；加载态/失败态兜底；上/下一种用 lite list 导航。
- **.babelrc 环境分化（生产瘦身关键）**：模板原为全局 `next/babel development:true` + `@react-dev-inspector/babel-plugin`，导致生产 HTML 每元素注入 `data-inspector-*`（catalog 占 ~50KB）且 React 走 dev 编译。已改 `env.development`（保留原样，预览点击定位不受影响）/ `env.production`（纯 next/babel）。layout.tsx 的 `<Inspector />` 本就有 isDev 守卫。勿改回全局 development:true。
- **chunk 现状（生产实测，迭代 10 后更新）**：框架基线 ≈449KB（modern）=react-dom 224KB+next runtime 118KB+共享应用 chunk ~108KB；polyfills 112KB 带 `noModule` 现代浏览器不下载（计入 raw total 但非真实传输）。/catalog modern JS 493KB raw / ~185KB gzip，HTML 132KB raw / 18KB gzip；xlsx 435KB 仍仅动态 import；react-markdown 142KB 仅 /chat 与 /design/[taskId]；motion 84KB 仅 /admin-plants。
- **本地生产验证姿势**：`scripts/start.sh` 不设 `COZE_PROJECT_ENV` → server.ts `dev = env!=='PROD'` 会服务 .next/dev（chunk 名描述性、含 dev 块），**必须** `COZE_PROJECT_ENV=PROD PORT=5000 node dist/server.js` 才是真生产行为。dev 模式图鉴 flight payload 含全量 quiz 的调试块是已知 dev-only 现象，生产 0 命中，勿误判泄漏。
- **冷启动 12.1s 成因（仅报告）**：容器冷启 + Node/Next 模块装载 + 首请求 SSR（cloud 模式含部署机→Supabase 高延迟的首次数据往返）。本轮 HTML/payload 瘦身降低 SSR 序列化与传输耗时，但冷启动量级由运行时环境主导。
- 已实测：首页/图鉴生产 HTML 与 chunk 复测、详情接口 401/200/404、tsc 通过、plants.json 未动、练习页/学习管理/问答回归 200、dev 服务恢复且 inspector 属性保留。

## 二期迭代 9 · 品牌标识与统一头像

- **品牌标识**：教师下发官方 logo（`assets/image_20260916100800790.png`，八边形窗格+幼苗+「植景小匠」字标）。产物：`public/images/brand/logo-mark.webp`（32KB，724×724 方形裁切仅八边形徽标，头像用）+ `public/images/brand/logo.webp`（55KB，徽标+字标完整版，供分享/课件）。**早期自绘 SVG 版 `src/components/brand/LogoMark.tsx` 与 `public/logo-mark.svg` 已删除**（教师以官方 logo 取代，勿恢复）。
- **头像组件** `src/components/Avatar.tsx`（client）：props `src?/name/size(24|32|40|56|80)/shape(默认 circle)/decorative`。显示优先级：自定义头像（src 加载成功）→ 植景小匠 logo；`onError` 回退 logo（同 ResImg 思路，不得出现破图）；**不再用灰底/绿底首字母**。0.5px 边框取 `var(--color-outline-variant)`。无障碍：非装饰时 alt/aria-label=「{name} 的头像」。
- **落位**：学生端与教师端**无独立个人中心页**——AppShell 右上角账号下拉即个人中心。导航账号按钮=胶囊形（Avatar 32 + 用户名 `text-fs-sub font-medium`，gap-2.5=10px，教师要求名称直接可见，勿改回纯头像圆）+ 下拉头部（Avatar 40 + 名称/身份）。两端共用 AppShell 一次生效。导航「已掌握 n/N」徽章已按教师要求删除（AppShell 不再接收 mastered/total props），勿恢复。
- **未做（边界）**：无头像上传能力（profiles 无 avatar 字段，`src` prop 为未来预留，当前恒落 logo）；未覆盖 `src/app/favicon.ico`（教师要求替换先报告）；StudentsClient×2 与 admin/page.tsx×1 的首字母圆是**他人名单占位符**非账号入口，未动。
- shadcn `ui/avatar.tsx` 存在但无人引用（Radix 版），本轮自建轻量 Avatar，未引用它。

## 二期迭代 10（上半）· 图鉴左右分栏 + AI 辅助搜索

- **布局**：`PlantCatalog` 重写为 `lg:grid-cols-[280px_minmax(0,1fr)]`；左栏 `lg:sticky lg:top-20`，<1024px 折叠为顶部「筛选（已选 N 项）」切换按钮。栏头=SlidersHorizontal+「植物筛选」+结果数徽章（**不用品牌 logo**）；分组=分类导航（NavItem 列表：选中 `bg-primary-container/70`+左侧 w-1 色条+右侧数量，静态全量计数）/生长习性（光照/水分/土壤酸碱度胶囊）/安全与状态（仅看安全=新语义 `safety:"safe"` 排除 isWarning、仅警示/仅禁植/仅儿童区可用 + 掌握三态）；`Group` 可折叠不丢值（`groups` state）；底部「已选 N 项」区：各维度条件可单个移除 + 重置全部。右栏=排序 select + 卡片网格（沿用 PlantCard）+ IntersectionObserver 增量（PAGE_SIZE=12）+ 空态含**放宽建议**（逐维度移除计算增益 top2，「去掉「X」（可多 n 种）」）。
- **AI 辅助搜索**：左栏置顶独立块 `AiSearchPanel`（`dynamic ssr:false`，未登录入口可见、点击提示「登录后可用」）。链路：自然语言 → `POST /api/catalog/ai-search`（requireUserToken + 内联 Map 限频 5/分 50/天，plant-render 同款；query 空 400 / >200 字 400）→ LLMClient.stream 累积 → `extractLlmJson` → `validateAiConditions` 白名单逐字段校验 → `loadPlantsForServer().plants.map(toPlantLite).filter(matchesConditions)` → 返回 `{conditions, description, unrecognized, count, ids}`。客户端 `applyAi` 把 UI 维度（category/layer/light/water/soilPh/tagGroups/isWarning→safety/keyword→search）写入手动筛选 state，非 UI 维度（functionTags/regionTags/soilDrainage）存 `extra`（AiExtra）以已选标签呈现；右栏顶部「AI 理解为：…」banner + unrecognized 数 + 一键清除。**服务端与客户端各跑一遍同一 `matchesConditions`/runFilter 语义，结果一致**（已实测 47 种用例两边相同）。
- **校验防御（已实测修复的真实 LLM 偏差）**：单值字段被包成数组（`["shrub"]`）→ 取首元素；大小写/首尾空格 → trim+toLowerCase；截断中文名（「花灌木」→「花灌木/绿篱」、「水生」→「水生/湿生」）→ 子串包含且唯一候选时映射；layer 中文兜底（灌木→shrub 等 ZH_LAYER 映射）。prompt 规则含：宁缺毋猜、分区指称转译（实测「儿童活动区适合种什么」→ isWarning:false，输出无任何分区词）、单值字段禁包数组、同一语义禁跨字段重复映射（早期「耐阴」同时映 light:semi 与 functionTags:["耐阴"] 导致 47 种→0 种，加规则 5 后修复）。
- **文件**：`src/lib/ai-search-labels.ts`（AiConditions/AiExtra 类型 + 5 个 LABEL 映射，零依赖）、`src/lib/ai-search.ts`（validate/matches/describe/extraOf，服务端+异步用）、`src/lib/plant-enums.ts`（LIGHT_NEED/WATER_NEED/SOIL_PH/SOIL_DRAINAGE 小枚举）、`src/app/api/catalog/ai-search/route.ts`、`src/components/catalog/AiSearchPanel.tsx`。
- **⚠️ Turbopack 不 tree-shake plant-parse.ts**：客户端代码 import 它的任一导出都会把整模块（18KB：FIELD_DEFS+全部白名单数组+校验函数）打进首屏 chunk。UI 侧枚举一律从 `plant-enums.ts` 取、labels/类型从 `ai-search-labels.ts` 取；plant-parse 仅供服务端路由与 /admin-plants 使用。
- **首屏瘦身组合拳（catalog 专项）**：① PlantLite 扁平化——`images.thumb→thumb`、`phenology.text→phenologyText`、`light.need→light`、`water.need→water`、`soil→soilPh+soilDrainage`、`warning.restriction→restriction?`（无警示时 JSON 省略该键）；② filters prop 窄化为 `{categories, layers}`（tagGroups/regions/safety 不下发）；③ PlantDetailModal 改 `dynamic ssr:false`（radix Dialog ~45KB 移出首屏，打开弹层才加载；**勿改回静态 import**）；④ shadcn Button 换原生 button（tailwind-merge 20KB+Slot 移出首屏）；⑤ PlantCard 的 next/image 换原生 `<img loading="lazy">`（next/image 运行时 ~15KB 移出首屏；缩略图为单一尺寸 webp 无 srcset 收益，**勿改回**；失败兜底=useState imgFailed→首字占位块）；⑥ AiSearchPanel 本就异步（2.7KB chunk）。
- **实测（生产构建 + COZE_PROJECT_ENV=PROD 复测）**：/catalog HTML 132.4KB raw（18KB gzip）≤150KB ✓；JS modern（不含 noModule polyfills）493KB raw / ~185KB gzip ≤0.5MB ✓；raw total 含 polyfills 603KB（polyfills 现代浏览器 0 下载）；`data:image` 0 命中；AI 面板/详情弹层均为独立异步 chunk。接口实测：未登录 401、空 query 400、真实查询命中数与本地一致、分区指称不泄漏、限频第 6 次/分 429 中文提示。
- **边界**：D3（图鉴右侧问答栏）本轮不做；/chat、AI 讲解按钮、品牌头像、/design、/admin* 未动；季节筛选旧版本就无（SeasonBar 仅详情弹层内），无回归。

## 二期迭代 11 · 个人中心回显加固 + 保存/改密链路修复

- **背景**：教师反馈个人中心卡片「绑定的账号、邮箱都没有了」。只读诊断四项结论：**回显数据链路无断点**——profiles 四列齐全且触发器为新版（注册即从 metadata 复制）、`getSessionUser` select/映射完整、各页服务端 await 同步传 user、auth.users metadata ↔ profiles 逐行一致；无头浏览器（CDP）实测 dev 与生产构建回显均正常，症状无法复现（最可能发生在 f8ca670 改读 profiles 三列之后、存量回填之前的部署窗口，当时 contactEmail/classCode/account 全为 ''）。
- **真 bug（诊断挖出）**：`POST /api/auth/profile` 与 `/api/auth/password` 的 `userClient.auth.updateUser()` **必然失败** "Auth session missing!"——supabase-js 2.95.3 的 `_updateUser` 强制要求 storage 里有 session 且无 custom Authorization 豁免分支（`_getUser` 有），而模板客户端 `persistSession:false` 只传 Authorization 头。即保存修改/修改密码**从未成功过**，库内字段值全部来自注册触发器/班级导入/回填。
- **修复**：① AppShell 三个输入框改**方案 A 脏值优先**——`useState<string | null>(null)`，渲染值 `draft ?? user?.field ?? ""`（user 晚到/更新自动跟随，输入后脏值不被 props 覆盖）；② 两路由的 updateUser 改 `getAdminClient().auth.admin.updateUserById(user.id, …)`（注意 admin API 字段名是 **`user_metadata` 不是 `data`**，tsc 会拦），身份核验仍走 userClient.getUser（有豁免分支可用）。
- **行为变化**：改密走 admin API 后 GoTrue 撤销该用户全部会话——旧 cookie 即刻失效，下次请求 proxy 续期失败即登出，学生需用新密码重新登录（页面提示文案本就是「密码已修改，下次登录使用新密码」）。
- **已知边界（未改，非本任务范围）**：保存时清空邮箱不写回（`if (contactEmail)` 守卫，profiles 与 metadata 均保留旧值），清空后 reload 回显旧值——既有行为。
- **实测**：保存 {ok:true} + profiles/metadata 双写一致 + reload 回显新值；改密后旧密码拒绝/新密码可登；空态占位（未绑定/未填写/—）保留；教师保存只动邮箱（学号/班级码按 role 跳过）；体积红线复测 HTML 135,588B ≤150KB、JS modern 493.0KiB ≤0.5MB（noModule 属性是 `noModule=""` 大写 M，统计脚本需大小写不敏感）；测试账号 3 个已清（含 profiles，业务表无数据）。

## 二期迭代 12 · 全站内容区宽度治理（解除 1280 死限 + 双 main 语义修复）

- **背景**：教师反馈全屏浏览左右大量空白。根因：壳层与 8 处页面内层各自 `max-w-7xl`（1280px）双重限宽，且页面内层与 AppShell 各有一个 `<main>`（双 main 语义错误）。
- **方案**：`@theme` 新增两个容器语义变量（Tailwind 4 `--container-*` 命名空间，自动生成工具类）——`--container-shell: 1680px`→`max-w-shell`（壳层上限）；`--container-measure: 880px`→`max-w-measure`（纯文字阅读区限行宽）。全站宽度只引用这两个变量，无硬编码。
- **改动（18 文件）**：① AppShell 顶栏 :88 与 main :282 改 `max-w-shell`（仅两行，账号下拉卡片 :121–269 未动）；② 8 处页面内层 `<main>`→`<div>` 并去重复限宽/横向 padding（保留纵向），壳层 main 唯一；③ 练习页解除 `max-w-4xl`(896) 死限，QuizClient 三个 return 根部限 `max-w-measure`；④ 图鉴去双层 7xl，卡片网格改 `repeat(auto-fill,minmax(280px,1fr))`（消除全站唯一 `2xl:` 依赖），左筛选栏 280px 不动；⑤ chat 消息流与输入区各包一层 `max-w-measure`（三栏结构不动）；⑥ DesignCase 背景页 `max-w-5xl`→`max-w-measure`（工作台 fixed main 不动）；⑦ 设计列表/教师端各页去内层限宽，设计卡片网格 auto-fill；⑧ 任务编辑器保留组件自身 `max-w-6xl`（用户拍板），只删页面 wrapper 重复 6xl。保留不动：StagePositioning/两弹层 `max-w-3xl`、首页、`ui/sidebar.tsx` 未用 main。
- **🔴 根因级踩坑**：新工具类 `max-w-shell` 始终不进产物，排查约 1 小时——干净重建/删注释/改名均无效，探针实验证明管线正常，最终定位 `.gitignore` 第 166 行误含 `src/components/AppShell.tsx`，Tailwind v4 oxide 按 .gitignore 排除扫描，整文件类缺失。删该行后修复（详见「常见问题」两条）。
- **实测（生产构建 5001 + CDP 无头）**：1920px 各页 main=1680、左右空白 113–128（≤140）；2560px cap 在 1680；正文 measure=880 居中（quiz l=r=520）；1440/1280/1024/768/375 五档无横向溢出；每页 SSR `<main>` 计数全为 1（基线 catalog/chat/plant-quiz 各 2）；图鉴 auto-fill 2560→4 列/1440→3 列/1024→2 列、左栏 280px sticky 不变。
- **回归实测**：迭代 11 账号卡片脏值优先+保存落库+改密（新密码可登/旧会话撤销）完好；图鉴 M8（280px sticky/已选N项/重置/AI 搜索）完好；答题链路全对→掌握持久、部分错→3 道订正项正确；体积 HTML 133.8KiB≤150KB、JS modern 492.9KiB≤0.5MB；首页/base64/品牌未动；tsc 通过。测试账号 2 个已清（含 mastery/quiz_attempts/profiles/auth.users）。

## 二期迭代 13 · 智能问答界面重构（右栏推荐面板 + 对话区组件化）

- **背景**：教师反馈——①中间「新对话」与左侧「新建对话」疑似不同步；②右侧三卡片（从图鉴开始讲解/本次对话可以问/助教说明）无用；③右栏应承载相关推荐/造景效果图/相关链接；④右栏可折叠并与中间联动；⑤为第 10 轮图鉴内嵌问答预留可复用组件。
- **双新建入口诊断（先诊断再删）**：左「新建对话」与中「新对话」**同调一个 `newConversation()`**，只重置本地 state、不落库；新对话为**懒创建**——发出首条消息后（`sendMessage` 生成 UUID→`stream()` finally upsert）才进左侧列表。CDP 实测两入口行为完全一致（点击当下均不入列、发消息后均入列），非两套路径；教师感知的"中间不同步"源于懒创建。按教师要求删中间按钮、留左入口，懒创建逻辑不动。
- **组件化（`src/components/chat/`）**：① `use-chat.ts`——`useChat` hook 承载全部对话状态/处理器/副作用，`mode:"page"|"embedded"`（page 才加载历史并自动开最近对话），预留 `contextPlantId/contextPlantName`（plant 为空时合成最小上下文，供第 10 轮图鉴内嵌）；② `ChatPanel.tsx`——对话区（上下文条+消息流+输入区），状态经 props 注入、无路由/页面级上下文依赖，`headerSlot` 插槽供组合层放折叠开关，**不含「新对话」按钮**；③ `RecommendPanel.tsx`——推荐面板，相关推荐/造景效果图/相关链接三个可折叠分区（CSS `grid-rows-[1fr/0fr]` 过渡、`motion-reduce:transition-none`）、面板内部滚动（`lg:max-h-[calc(100vh-9rem)]`）、无内容的分区不渲染、全无内容时空态提示；④ `ChatClient.tsx` 重写为 page 组合层（历史列表+ChatPanel+RecommendPanel）。
- **右栏折叠联动**：布局由 grid 改 flexbox（`lg:flex-row`），右 aside `transition-[width]` 300↔0、中栏 `flex-1 min-w-0` 自动吃满；折叠开关在 ChatPanel headerSlot（`PanelRightClose/Open`，仅 lg 显示）；状态存 `localStorage zjxj:chat:rightOpen`（挂载后读取并延迟启用过渡，避免首屏动画）。**窄屏不做推荐面板适配**（教师明确无需移动端适配）：右栏 `hidden lg:block`，<1024 不显示推荐面板（与重构前一致）；窄屏历史对话折叠为既有功能未动。
- **推荐数据不变**：仍为 `/api/plant-resources`（图+链接）与 `/api/plant-render`（效果图），内存态、切对话即清（本轮只"放在哪"不"存得住"，持久化留下一轮）；`/api/plant-resources` 需登录（S7），匿名访客面板显示空态提示。
- **实测（登录态 CDP + 生产构建）**：中间「新对话」=0、三卡片=0、左「新建对话」保留；折叠 300→0、中栏 1440 下扩至 1089、展开恢复；提问夹竹桃后三分区推荐+生成按钮出现；1440/1280/1024/768/375 五档无横向溢出、main 计数=1、`max-w-shell`/`max-w-measure` 保留；体积 catalog HTML 132.3KiB、JS modern 492.9KiB（持平基线）；新工具类（`grid-rows-[1fr]`/`transition-[width]`/`lg:max-h-[calc(100vh-9rem)]` 等）生产 CSS 均已生成；tsc 通过。测试账号 tmpchat01 已清（chat_messages/profiles/auth.users，无孤儿行）。
- **注意**：`ChatClient` 不再是 809 行单体，改对话逻辑先认 `chat/use-chat.ts`（状态/接口）与 `chat/ChatPanel.tsx`（渲染）；历史列表仍在 `ChatClient`（page 专属）。推荐块已从消息流内嵌迁至右栏，消息流只保留末条"本答案依据课程植物库资料生成"脚注。

## 二期迭代 14 · 智能问答「资源与生成内容」持久化（历史对话完整还原）

- **背景**：教师反馈——首次问答推荐了资源，退出/切页再回来点历史对话，推荐资源、生成图片、相关链接全没了。本轮让会话非文本内容随消息持久化，任何入口重开（退出/切页/刷新/换设备）都能还原。建立在迭代 13 组件化 + 迭代 12 宽度治理之上，不重做、不拆散。
- **数据模型（加列不建表）**：`chat_messages` 加 `meta jsonb`（消息级附件，旧行 NULL=无附件，读取不报错）+ `source text not null default 'chat'`（会话来源，chat=普通/catalog=图鉴速查，本轮只预留能力、图鉴侧未实现）。DDL 已落地 develop 并同步 `supabase/schema.sql`。**只存 URL 不存 base64**（实测 contains_base64=false）。meta 结构 `{resources?:{plantId,plantName,images[],links[]}, renders?:[{url?,plantId,at,status:'ok'|'failed'}]}`。**注意**：线上 `chat_messages` 无 role CHECK 约束，而 schema.sql:111 有——既有差异，本轮只报告未改。
- **写入链路**：`/api/chat` 落库时带上 `source`（body.source==='catalog'?'catalog':'chat'）。推荐资源/效果图经**新端点 `/api/chat-meta`**（POST，`getAuthContext` 鉴权 401）写入：用 `getUserClient` 查本人该对话最近一条 assistant 消息（legacy 走 `conversation_id is null`），查无→404，读-改-写 meta（resources 覆盖、render 追加 renders 数组），`.update({meta}).eq('id').eq('user_id')` 定点更新、非整行覆盖。前端 `use-chat.ts` `persistMeta()`：`loadResources` 成功后写 resources、`generateRender` 成功写 `{status:'ok'}`/失败写 `{status:'failed'}`（前端显失败文案+可重试，不永久转圈）。失败不阻断主流程。
- **读取还原**：`/api/chat-history` GET detail 增返 `meta`（`select('role,content,meta')`，无该会话→404）；GET list 增返 `source` 但**不返回 meta**（按需加载，实测列表项无 meta 字段）。`use-chat.ts openConversation` 加载消息后，从最近一条带附件 assistant 消息倒序取 meta：`resources`→`setResources`（resourceImgs 自动派生）、`renders` 中 status==='ok' 的→回填 `renderImgs`（**只读还原，不触发重新生成**——CDP 实测还原期间 /api/plant-render 与 /api/plant-resources 请求数均=0）。还原走迭代 13 `RecommendPanel`，不另建 UI；图片失效有 ResImg 兜底。
- **历史列表「图鉴速查」分组**：`ChatClient` 按 `source` 拆 `normalConvs`/`catalogConvs`，catalogConvs 非空才渲染「图鉴速查（n）」可折叠分组（`catalogOpen` 默认展开），**空不渲染空壳**（CDP 实测无 catalog 会话时 catalogGroupPresent=false）。`renderConvItem` 抽出供两组共用。
- **权限（实测）**：A 学生读 B 会话 detail→404、A 对 B 会话写 chat-meta→404（`getUserClient` + `user_id` 过滤，RLS 兜底）；未登录读/写→401。
- **实测（登录态 CDP + curl + 生产构建）**：首问夹竹桃→resources(4图3链接)+效果图落 meta→重开对话三分区完整还原、效果图直显不重新生成；旧消息/无 meta 会话打开正常（meta:null 不报错）；不存在会话→404；越权/未登录如上。体积：catalog HTML 133.8KiB、JS modern 492.9KiB（持平迭代 12/13 基线，无退化）；/chat JS modern 638KiB——超出 0.5MB 部分为**既有 react-markdown/micromark chunk（139.4K，AI markdown 渲染核心，前轮已存在）**，本轮客户端新增 <1KB（仅落入 48.2K chat 业务 chunk），package.json/pnpm-lock 未改（无新依赖）。tsc 通过。
- **注意**：改附件读写只认 `/api/chat-meta` + `use-chat.ts` 的 `persistMeta`/`openConversation`；`/api/chat` 只管文本+source，别把资源写入塞回流式逻辑。source 由 `useChat` 的 `mode` 派生（embedded→catalog），第 10 轮图鉴内嵌时自动生效。测试账号 tmpchat05/06 已清（chat_messages/auth.users，无孤儿行）。

## 二期迭代 15 · 学习管理统计可视化（近 7 天彩色柱状图 + 掌握情况对比）

- **背景**：教师反馈——学生端近 7 天学习趋势只有数字、页面不好看，要彩色柱状图。配色方向教师已定：**品牌绿系深浅**（数值越高越深、峰值高亮、今天描边，**非多色彩虹**）。图表是增强非替换，保留原数字展示且口径一致。
- **近 7 天柱状图**：`src/components/learning/TrendBarChart.tsx`（recharts，"use client"）+ `TrendChart.tsx`（`next/dynamic ssr:false` 包装，加载中占位）。**7 根柱必全显**——recharts 对 0 值不画矩形，故用自定义 `shape={<TrendBarShape/>}`（recharts `Rectangle`）对 0 值画 `ZERO_STUB=4` 浅色小段保柱位，非 0 画 `radius=[6,6,0,0]` 圆角柱。绿系深浅=`var(--color-primary)` 分档 `fillOpacity`（1→0.38 / 2-3→0.62 / ≥4→0.9），峰值=`var(--color-on-primary-container)` op1、今天=主色+`on-primary-container` 描边。柱顶 `LabelList`（0 不显）、X 轴 7 天含「今天」、Y 轴 `allowDecimals:false` 整数、网格弱化虚线、tooltip「日期+次数」。`prefers-reduced-motion` 时 `isAnimationActive=false`。数据**直接复用 `dash.trend`**（emptyLearningDashboard 的 7 天本地日期口径），不重算。
- **掌握情况对比**：`MasteryCompare.tsx`（服务端组件），选「排行列表+迷你条形」——每项需可点击跳转+掌握徽章+百分比，天然是列表语义，迷你条用 CSS 宽度百分比即可、无需再引 recharts。正确率最高/最低各 5 株（`sort accuracy desc` 取 top/bottom），整行 `Link→/plant-quiz?plantId=`。**掌握状态沿用 `computeMasteryForUser` 唯一判定入口**（`results.get(plantId)?.mastered`），不另算口径。
- **数据层**：`repo.ts getLearningDashboard` 末尾聚合 `plantAccuracy`（quiz_attempts 按 plant 聚合 Σscore/Σtotal→百分比，`mastered` 取 computeMasteryForUser 结果），新增 `LearningPlantAccuracy` 接口 + `LearningDashboard.plantAccuracy`。nameById 由 results.keys() 构建已覆盖全部练习过的植物。
- **图表配色集中一处**：`src/components/learning/chart-config.ts`（`CHART` 常量 + `barOpacity`/`barStyle`），全部取 `globals.css` `@theme` 语义变量（primary/on-primary-container/surface-container-highest/outline-variant/on-surface-variant/on-surface），**不引入新色值、不散落硬编码**。
- **性能（动态分包实测）**：recharts 经 `next/dynamic ssr:false` 独立成 374KB chunk，**不在 /learning 初始 HTML**（grep=0，初始仅 10 chunk），图表挂载才懒加载。体积（生产实测、排除 noModule polyfill）：/catalog HTML 134.2KB / JS modern **492.9KB 持平**；/chat HTML 27.5KB / JS modern **638.2KB 持平**（既有 react-markdown，非本轮）；/learning HTML 69.9KB / JS modern **472.4KB（不含 recharts）**。catalog/chat 完全不受影响，HTML 均≤150KB。
- **实测（登录态 CDP + 生产构建）**：7 柱齐显（含 2 零值小段）、绿系深浅/峰值最深/今天描边（SVG fill+opacity+stroke 逐项核对）、数值标签 0 隐藏、tooltip、掌握对比可点击、全 0 与仅 1 天空态、1920/1440/1280 无横向溢出、reduced-motion 无入场动画、`<main>`=1。tsc 通过、plants.json 未改。测试账号 tmplearn01/02/03 已清（12 quiz_attempts + 3 profiles + 3 auth.users，无孤儿）。
- **踩坑**：①recharts 0 值不渲染矩形→必须自定义 shape 补零值小段，否则"7 根柱"缺空日。②**生产构建过时陷阱**：`.next/BUILD_ID` 时间戳早于源码 mtime 时，`node dist/server.js` 提供的是旧页面（本轮曾因此误判"掌握对比缺失/图表未渲染"）——生产验收前先核对 BUILD_ID 是否新于改动、必要时 `pnpm next build` 重建。③`pkill -f "<模式>"` 的模式若出现在当前 shell 命令行里会**自匹配杀掉执行 shell 本身**（输出截断），杀进程优先按 PID。

## 二期迭代 16 · 教师端任务管理 AI 减负（封面本地上传 + 简介语音/润色 + 可问问题智能填写 + 评分标准 AI 生成）

- **背景**：教师反馈任务编辑表单交互负担重——封面只能填 URL、简介纯手敲、可问问题逐格填、评分标准全靠手动。教师确认：4 项全做、封面 ≤5MB、上传与 URL 并存、一次性实施。
- **① 封面本地上传**：`/api/admin/design-tasks/upload-cover`（POST multipart，requireTeacher+云模式校验，**≤5MB**、sharp 转 webp、upsert 到 `plant-images` 桶 `task-covers/{taskId}.webp`，返回**完整公开 URL**）。表单「发布信息」处=上传按钮+原 URL 框并存+封面预览。返回完整 URL 直接存 `cover_url`，渲染处（`DesignTasksAdmin`/`design/page` 直接 `<img src>`）无需改动。**复用桶**：plant-images 已有公开读+教师写策略，无需新建桶/改 RLS。
- **② 简介语音+AI 润色**：简介区加「语音输入」（`use-voice-input.ts` 复用 Web Speech API zh-CN，base-ref 追加式多段口述）+「AI 润色」（`action:"polish"`，按①任务背景②学生任务结构润色、保留原意、≤500 字）。
- **③ 可问问题智能填写**：`InquiryAiModal.tsx` 弹窗——粘贴/口述一大段需求→`action:"parseInquiry"` 按固定维度拆成 `{topic,keywords,importance,answer}` 多条（`importance∈{critical,normal}`，自动判"重点"）→预览后「替换/追加」填入，仍可手动增删改。范式沿用 `/api/admin/plants/parse`（extractLlmJson+限频）。
- **④ 评分标准 AI 生成**：「AI 生成评分标准」按钮→`action:"genRubrics"` 汇总已填 title/subtitle/intro/entries→生成 S1–S6 各阶段 `{label,weight,desc}`→回填，教师继续手动编辑；已有内容时先确认覆盖。
- **AI 统一入口**：`/api/admin/design-tasks/ai`（POST `{action,...}` 分发 polish/parseInquiry/genRubrics），`src/lib/task-ai.ts` 集中 3 套 prompt+`runTaskAi`（requireTeacher+per-user 限频 10/min 200/day+LLMClient `doubao-seed-2-0-lite-260215`+`extractLlmJson`）。模型不可用时中文兜底提示。
- **实测（教师登录态 curl）**：polish 自动整理成①②结构✓；parseInquiry 3 条且"重点"项正确判 critical✓；genRubrics 生成 S1–S6 全阶段、权重合理、贴合任务✓；upload-cover 返回公开 URL 可访问✓、6MB 超限拒✓、未登录拒✓。tsc 通过、四功能 UI 串已进生产 bundle。
- **已知边界（非本轮引入）**：任务编辑页 `/admin/design-tasks/[taskId]` 在 **headless_shell 无头浏览器下主线程阻塞**——对照实验证明**改动前原版同样阻塞**、极简任务也阻塞、详情接口 0.18s 正常，属该页与无头渲染的既有兼容问题（真实浏览器教师正常使用），未盲改。故本轮 UI 验证以「后端 curl + tsc + 生产 bundle 含四功能串」为准。

## 二期迭代 17 · 植景设计案例介绍打字机 + 默认自动语音播报

- **背景**：教师反馈——学生点进植景设计任务后的案例介绍是一次性静态呈现，希望改为**打字机逐字动态呈现**，并配一个**默认自动播报、可关闭、尽量醒目**的语音小喇叭，让学生直接看到。
- **实现**：新建 `src/components/design/CaseIntro.tsx`（"use client"），替换 `DesignCase.tsx` background 相原 `<p>` 案例介绍为 `<CaseIntro text={task.case?.background || task.case?.summary || ""} />`。只动这一处，封面/徽章/按钮等其余结构不变。
- **打字机**：`setInterval` 逐字递增 `shown`，步长 `clamp(24, round(11000/total), 60)`（目标约 11s 读完全文）；光标=主色细条 `animate-pulse`，打完消失。`prefers-reduced-motion: reduce` 时直接全量呈现、无光标。
- **语音播报**：`window.speechSynthesis` + `SpeechSynthesisUtterance`（lang zh-CN，rate 1），复用 `use-chat.ts` speak 范式；挂载即 `startSpeak()` 尝试自动播报，`onstart/onend/onerror` 驱动 `speaking` 态；组件卸载/离开案例页即 `cancel()` 停播。
- **醒目喇叭**：`aria-pressed` 胶囊按钮——开启=主色底 `bg-primary text-on-primary shadow-card` + hover 上浮，关闭=浅底描边；图标 `Volume2/VolumeX`（lucide），播报中图标 `animate-pulse`。文案三态：播报中/点击播报/语音已关闭；未开播时旁注「若未自动播放，点一下喇叭即可」引导学生点击。
- **浏览器 autoplay 边界**：Chrome 等对无用户手势的 `speechSynthesis.speak()` 会拦截，此时 `speaking` 不置位、喇叭显示「点击播报」+旁注，学生点一下喇叭（用户手势）即开播——醒目喇叭即为此兜底，属预期非缺陷。
- **实测（headless CDP + curl）**：案例背景页 `/design/task-chuangzhi-01` 无登录 200；打字机正文长度 155→322→458 逐字增长、光标打完消失；减少动效下全量呈现无光标；喇叭点击切换「语音已关闭/点击播报」正确。tsc 通过，plants.json 未改。
- **注意**：案例背景页 `DesignCase`（学生端）与卡死的任务编辑页 `DesignTaskEdit`（教师端）是不同组件，headless 下本页正常渲染，可 CDP 实测。

## 二期迭代 18 · 设计工作台：S1 评阅后不自动跳 S2 + 修复 S2 表单无法下滑

- **背景**：教师反馈两处——① S1 场地诊断提交并 AI 评阅后，页面**立即自动跳转**到 S2 设计定位，学生来不及看评语，希望改为学生**手动点「进入 S2 设计定位」**才进下一环节；② S2 设计定位表单**无法下滑**，下方内容被裁掉、必须缩小浏览器才能看到，布局有问题。
- **① 去掉自动跳转**：`StageDiagnosis.tsx` 的 `submit()` 原有 `if (data.passed) onUnlocked()`（→`setStage("S2")`）删除。评阅通过后**停在 S1** 展示 ReviewCard（评分+评语+知识卡片），由卡片上既有的「进入 S2 设计定位」手动按钮（`onNext={review.passed ? onUnlocked : undefined}`）触发进入。**注意**：`saveStageRecord` 在 S1 通过后仍会把 `current_stage` 置为 S2（刷新后从 S2 恢复=续做语义，属既有行为，本轮未改）；教师痛点是提交后立刻被跳走看不到评语，已解决。
- **② 修复 S2 无法下滑**：根因——工作台 `lg` 下 `main` 为 `overflow-hidden`、行容器 `lg:h-full`，右侧阶段列 `flex-1 min-h-0` 却**无滚动容器**。S1 自带 `lg:h-full`+内部 `overflow-y-auto` 故能滚；S2 根节点是自然高度 `max-w-3xl space-y-4`，超出视口即被裁。修复=`DesignCase.tsx` 右侧阶段列补 `lg:overflow-y-auto`（S1 恰好占满不受影响，S3-S6 占位 `h-full` 居中也不受影响）。
- **实测（登录态 e2e CDP，1440 宽）**：注册全新学生→进工作台 S1→填 8 项诊断（各含 mustMention 关键词，accuracy=100→score=60 通过）→提交：**评阅后仍停 S1、未跳 S2、出现「进入 S2 设计定位」按钮（ASSERT_noAutoJump PASS）**；点按钮→S2 内容渲染。**短视口 1440×700**：真实 S2 内容 `clientHeight 517 < scrollHeight 722`、`canScroll:true`、滚到底 `scrollTop 205`、原被裁的提交按钮进入视口（ASSERT_s2Scrollable PASS）。tsc 通过、plants.json 未改。
- **测试账号清理**：tmpdesign01/02 已按 run_events→stage_records→student_runs→profiles→auth.users 依赖序删净（无孤儿行）。
- **S1 通过判定要点（⚠️ 已被迭代 26 取代）**：此处的 `accuracy*0.6 + coverage*0.4` 是旧口径。现行口径见「二期迭代 26」：`ruleScoreS1` = keywordAccuracy*0.4 + coverage*0.3 + completeness*0.3，再与 `llmJudgeS1` 语义分各半加权，`passScore=60`。mustMention 关键词在 `chuangzhi-nongyuan.json` 的 `diagnosisForm`（不下发学生端，仅服务端/文件可读）。

## 二期迭代 19 · S2 三栏布局 + 选择理由语音 + 丝滑转场（教师确认方案A/追加/全加）

教师反馈 S2「设计定位与设计原则」布局差（表单+评阅上下堆叠要滑动）、选择理由缺语音、希望把 S1 场地诊断表请进 S2 当参考、且所有切换都要像"案例背景→场地调研"那样丝滑。先罗列理解+方案经教师 `ask_user` 确认：**方案A 保留案例资料列三栏 / 语音追加 / 环节切换+返回案例背景都加转场**。

- **① S2 三栏**（`StagePositioning.tsx` 重写 return）：根 `flex min-h-0 flex-col gap-3 lg:h-full lg:flex-row`。**中栏**（`flex-1 lg:overflow-y-auto`）=紧凑化定位表单（p-6→p-5、间距/按钮缩小、主定位 `sm:grid-cols-2`、原则芯片 `px-2.5 py-1`、理由 `rows=3`）+ 提交后 ReviewCard 显示其中。**右栏**（`lg:w-[34%]` aside）=**S1 场地诊断表参考**：读 `run.stage_payloads.S1.payload`（`s1Answers`），按 `nongyuan.diagnosisForm` 的 key/label 渲染 8 项只读卡片，栏内 `overflow-y-auto`。左栏案例资料（CasePanel）保留不动。
- **② 选择理由语音**：复用 `use-voice-input.ts`（`useVoiceInput`），**追加模式**——`reasonBaseRef` 在点麦克风时快照当前文本，识别结果以换行追加（`base + "\n" + t`）；按钮 `absolute bottom-2 right-2`（textarea `pr-14` 避让），`listening` 时红底脉动，`micSupported` 才渲染。
- **③ 丝滑转场**（`DesignCase.tsx` + globals.css）：
  - **环节切换**：`changeStage(key)` 比较 STAGES 索引定方向，`anim` 态 → 阶段内容外层 `key={stage}` 容器挂 `animate-stage-next`（前进/右滑入）或 `animate-stage-prev`（返回/左滑入）。阶段条按钮、S1→S2、S2→S3 的 `onUnlocked` 全改走 `changeStage`。
  - **返回案例背景**：`exitWorkbench()` 置 `leaving` → shell 挂 `animate-shell-out`（0.24s 淡出+缩 0.98+下移）240ms 后 `setPhase("background")`；背景根加 `animate-bg-in`（0.3s 淡入上浮）遮接续。减少动效时直接切。
  - **globals.css** 新增 `@keyframes stage-next/stage-prev/shell-out/bg-in` + `.animate-*` 类 + `prefers-reduced-motion` 关闭。**注意**：改 globals.css 动画类后需重启 dev（Turbopack CSS 竞态，见常见问题）。
- **实测（CDP 直连 9222，1440×900）**：`/__cdp/json` 桥接端点本轮不可用，改为 `setsid` 直启 `chromium_headless_shell-1161 --remote-debugging-port=9222` 后脚本连 `127.0.0.1:9222/json`。注册 tmpdesign01→API 过 S1（score=60）→进工作台落 S2：**三栏 `flex-direction:row`、诊断参考 8 项含学生真实答案、语音按钮、理由框、右栏宽 363px≈34%（ASSERT_layout PASS）**；动画类+关键帧全编译（ASSERT_cssAnim PASS）；返回案例背景 `animate-shell-out` 中途可见、背景入场+卡片可见；**环节切换** S2→S1 触发 `animate-stage-prev` 且落到 S1（ASSERT_stageSwitch PASS）。tsc 通过、plants.json 未改。
- **测试账号清理**：tmpdesign01 已删净（终检 0 残留 0 孤儿）。
- **CDP 脚本坑（复用注意）**：`eval` 包装成 `(async()=>{${x}})()`，**单值表达式必须写 `return`** 否则 undefined；**不完整三元**（`a?b` 缺 `:else`）会报 "Unexpected token '}'"；多行模板内 `\\n` 才是字面 `\n`。

## 二期迭代 20 · 图鉴搜索合一（去直接搜索框，AI 搜索支持名称/学名/别名 + 放大 + 语音）

教师反馈：植物图鉴筛选卡里"直接搜索名称框"与"AI 辅助搜索"冗余，**只保留 AI 辅助搜索**，且 AI 搜索要能直接搜**名称/学名/别名**、输入框**放大更明显**、并**支持语音输入**。

- **① 移除直接搜索框**（`PlantCatalog.tsx`）：删掉筛选侧栏顶部的 `<input placeholder="搜索名称 / 学名 / 别名">`（含 `Search` 图标，已从 lucide 导入移除）。**`search` 状态与过滤逻辑保留**——AI 解析出的 `keyword` 仍经 `applyAi→setSearch(c.keyword)` 走 `runFilter` 的 name/latin/alias 匹配，激活标签"搜索：xxx"chip 可清除。动态加载占位高度 `h-[92px]→h-[176px]` 匹配放大后面板。
- **② AI 搜索支持名称/学名/别名**（`api/catalog/ai-search/route.ts` SYSTEM_PROMPT）：keyword 字段说明改为"植物名称/学名/别名…"，新增**规则 6**——用户输入具体植物名/学名/别名（如"桂花""Osmanthus fragrans""木樨"）原样放入 keyword 做名称检索；同时描述习性则名称进 keyword、习性映射对应字段。`validateAiConditions`/`matchesConditions` 本就支持 keyword（匹配 name/latin/alias/functionTags），无需改。
- **③ 放大 + 醒目 + 语音**（`catalog/AiSearchPanel.tsx` 重写）：面板 `rounded-lg bg-primary-container/40 p-3 → rounded-xl bg-primary-container/60 p-3.5 shadow-card`；标题下加提示行"可直接搜名称 / 学名 / 别名，也可描述习性"；输入框 `py-1.5 text-fs-label → py-2.5 pl-3.5 pr-11 text-fs-sub rounded-lg`（更大）；搜索按钮改**整行** `w-full py-2.5 text-fs-sub`。**语音**：复用 `design/use-voice-input.ts` `useVoiceInput`，**追加模式**（`voiceBaseRef` 点麦克风时快照、识别结果以空格追加），麦克风按钮 `absolute right-2`（输入框 `pr-11` 避让），`listening` 时 `bg-error` + 话筒脉动（见迭代 21），`micSupported` 才渲染。
- **实测**：API——"桂花"→`{keyword:"桂花",count:1,ids:["p005"]}`、"Michelia figo"→`{keyword,count:1,ids:["p001"]}`、"耐阴耐湿适合水边的灌木"→正确解析 layer/light/water/tagGroups/functionTags。CDP（1440×900，headless_shell 支持 SpeechRecognition）：直接搜索框已移除、副标题在、输入框放大（py-2.5+text-fs-sub）、整行搜索按钮、**语音按钮渲染且点击切换"开始→停止语音输入"**，全 PASS。tsc 通过、plants.json 未改、tmpcatalog01 已清（0 残留）。
- **⚠️ 已知取舍**：直接搜索框移除后，**匿名（未登录）访客失去名称搜索**（AI 搜索需登录，匿名提交提示"登录后可用"）；学生均登录不受影响。若需匿名名称搜索再议。

## 二期迭代 21 · 图鉴语音按钮"录音中"语义修复（去斜杠话筒）

教师反馈：图鉴 AI 搜索的语音按钮一点就"变红 + 带斜杠"，看着像**闭麦**，实际却在录音，误导。正确语义应是：点一下开始说话 → 说完再点一下结束 → 再点搜索。

- **问题根因**：录音中用了 `MicOff`（带斜杠话筒）图标，斜杠传达"已关闭/静音"，与"正在录音"相反。交互（`useVoiceInput.toggle` 点一下开始、再点结束）本身正确，纯视觉语义错。
- **修复**（`catalog/AiSearchPanel.tsx`，仅此一处）：
  - 录音中图标 `MicOff → Mic`（**去掉斜杠**），保留 `animate-pulse`；移除 `MicOff` 导入。
  - 录音中按钮内加 `<span class="absolute inset-0 animate-ping rounded-full bg-error/40">` 扩散波纹，明确"正在收音"。
  - 输入框下方新增录音提示行（`listening` 时）：红点 + "正在聆听，请说话…说完再点一下话筒即可结束"。
  - `title` 补充：录音中="正在录音，说完点击结束"，未录音="点击开始语音输入"。
- **实测（CDP 1440×900）**：点击前 `hasSlash:false`；录音中 `hasSlash:false`（斜杠已除）+ `hasPing:true` + 提示行显示 + `bg-error`；再点后提示消失、aria 回到"开始语音输入"。**ASSERT_micSemantics PASS**。tsc 通过、`@keyframes ping`/`.animate-ping` 已进产物 CSS、catalog 200、plants.json 未改。
- **⚠️ 同款视觉仍存在于其他语音按钮**（本轮按"只改点名处"未动）：`ChatPanel`、`StagePositioning`、`StageDiagnosis`、`InquiryAiModal`、`DesignTaskEdit` 录音中仍是 `animate-pulse bg-error`（未用斜杠图标，语义没图鉴这处严重）。若教师要全站统一"录音中"视觉再一并改。

## 二期迭代 22 · 教师端「植境色谱」辨识度改造（四模块卡片差异化 + 立体感）

教师反馈：教师端卡片辨识度极低——所有卡片同色白底（`bg-surface`）+ 同一个 `shadow-card`，搜索栏/筛选/练习题卡/班级卡全糊在一起。要求：灵动一些、饱和度稍高、结合植物造景配色、立体感强一些。经 ask_user 确认：**清新园艺档（饱和度适中、彩色作点缀）+ 教师端 4 模块统一做**。

- **新增「植境色谱」语义 token**（`globals.css` `@theme`，M3 式 base/container/on-container 三元组，Tailwind 自动生成 `bg-sprout`/`text-on-sun-container` 等工具类）：
  - `sprout` 嫩芽黄绿 #6a9b3a / `blossom` 樱花粉 #c76b8d / `lavender` 薰衣草紫 #8a7bb8 / `sun` 向阳金 #d19a2f / `bark` 树皮棕 #9a6b45 / `water` 水景青 #3f8f96；container 为各色的浅底（#eef5e2 等）。
  - `--shadow-leaf`：带绿调的双层投影（`0 1px 2px + 0 6px 18px rgba(47,122,79,.14)`），比 `shadow-card` 更"托"。
- **统一卡片语言**：白底保留（保可读）+ 顶部 `h-1.5` 强调色带 + 同色细边（`border-{accent}/20~25`）+ `shadow-leaf` + 标题前竖条/彩色图标章；功能色只作点缀，符合清新档。
- **四模块落位**：
  - `/admin` 概览：4 张统计卡各一色（water/sprout/sun/bark，图标章+浅底+顶带）；班级对比=blossom、最近动态=sprout、难点植物=sun；两个入口卡=water/blossom 图标章。
  - `/admin-plants`：工具条=主绿顶带；**左栏植物列表=冷调 water 浅底、右栏练习题=暖调 sun 浅底**（教师点名的"两栏分不开"已解决）；练习题卡本体改白底+sun 细边浮在暖底上。
  - `/admin-students`：班级管理卡=blossom 顶带+竖条；班级掌握对比=water（条形图 `BAR_COLORS` 换植物色）；最近动态=sprout；学生表格卡=主绿顶带。
  - `/admin/design-tasks`：任务卡=lavender 细边+leaf 阴影；设计任务统计板=water 顶带。
- **验证**：tsc 通过；新工具类已进产物 CSS；CDP 教师登录实测 `/admin`（7 色带/23 彩章/11 浅底/9 leaf）、`/admin-students`（7/20/8/5）配色均渲染；`/admin/design-tasks` 新教师无任务显空态属正常（标题竖条已渲染）；`/admin-plants` 因 dev 模式 2.1MB 大页水合重、CDP 截图接口报 Internal error，改用**服务端渲染验证**——200/0.32s 的 HTML 中 `border-primary/20`、`water-container`、`sun-container`、`shadow-leaf` 标记齐全且无 JS 异常（客户端组件 SSR 已带全部配色改动）。
- **环境坑（本轮遇到）**：① 曾同时残留 3 个 `pnpm tsx watch` 实例，仅最新一个绑 5000，旧实例已按 PID 清理（勿用 `pkill -f` 模糊杀）；② headless_shell 页面 target 卡死后 `Network.enable` 会超时，重启浏览器到干净 about:blank 即恢复；③ 超重页面（135 植物两栏）`Runtime.evaluate`/`captureScreenshot` 易超时/报错，验证这类页面优先 curl 服务端 HTML + grep 标记。
- **已知边界**：学生端页面本轮未动（教师说"首先看教师端"）；弹窗/表格行等次级元素仍为白底（保可读，属预期）。

## 二期迭代 23 · 案例背景页移除「场地事实」浅绿小卡片

教师要求：学生端植景设计点进案例后，背景页下方的区位/面积/现状/边界/周边/建设意向/用地性质一排浅绿小卡片不需要，删除，其他不变。
- 只删了 `DesignCase.tsx` 背景页（`phase==="background"`）里渲染 `task.case.facts` 的 `grid` 卡片块；`CaseIntro` 之后直接接「参考来源」。
- **`facts` 数据本身保留**（`chuangzhi-task.json` 未动）：工作台侧栏 `CasePanel` 的「场地事实」列表（DesignCase.tsx 内 `CasePanel`）与 `/api/design/chat` 的 AI 顾问【场地事实】上下文仍在消费，勿因背景页不显示就删数据。
- 验证：tsc 通过；`/design/task-chuangzhi-01` 200；渲染 DOM 中 facts 标签（`>用地性质<` 等）与被删卡片特征类 `px-3.5 py-2.5` 均零命中，剩余命中仅在序列化数据 blob（正常）。

## 二期迭代 24 · 案例顶部媒体支持教师上传图片/视频/3D 模型

教师问：学生端植景设计点进案例后，卡片上方的图片从哪来？理论上应来自教师端上传，且不止图片，还应支持 3D 模型、视频。经 ask_user 确认：**一次到位（图片同步修复 + 视频 + 3D）+ 大小上限图片≤5MB、视频≤50MB、3D 模型≤20MB**。
- **原状**：列表卡与背景页顶部图都指向仓库内置静态 SVG（`/images/tasks/chuangzhi/site-map-full.svg`），非教师上传；且列表用 `cover_url`、背景页用 `task_def.cover`，两字段不同步、只支持图片。
- **数据模型**：媒体存 `task_def.media = {type:"image"|"video"|"model", url, poster?}`（PATCH 整体写 task_def，无需改表）；`cover_url` 同步回填（image 用 url，否则用 poster 回落）。
- **上传接口** `src/app/api/admin/design-tasks/upload-media/route.ts`（新建）：requireTeacher + cloud 校验；formData `file/taskId/kind/slot(main|poster)`；image 走 sharp 压缩 webp、video 透传 mp4/webm、model 透传 glb/gltf；存 Supabase `plant-images` 桶 `task-media/{taskId}/{slot}.{ext}`（upsert）；返回公网 URL。
- **渲染**：`src/components/design/CaseMedia.tsx`（新建）`CaseMediaView` 按类型渲染（video→`<video controls>`、model→`ModelViewer`、image→`<img>`），`mediaThumb(media,cover)` 取静态缩略图；`src/components/design/ModelViewer.tsx`（新建）用 `createElement("model-viewer")` + useEffect 动态 `import("@google/model-viewer"@4.3.1)`（不进首屏 bundle）。
- **接线**：`DesignCase.tsx` 背景页头部用 `CaseMediaView`（无 media 回退 `task.cover` 静态图）、顶栏/CasePanel 用 `mediaThumb`；`src/lib/design.ts` `toLite→thumbFrom` 从 `task_def.media` 推导列表缩略图；`DesignTaskEdit.tsx` 原「封面图」区块换成「案例顶部媒体」编辑器（类型 3 按钮 + 上传 + 视频/模型时的缩略图上传 + `CaseMediaView` 预览）。
- **验证**：tsc 通过；图片上传→保存→学生页→列表缩略图全链路通；`<model-viewer>` CDP 渲染正常无报错；`<video controls>` SSR 渲染正确；类型校验（png 冒充 video/model 被拒、匿名被拦）。测完已还原任务为默认 SVG 封面、清理临时教师 tmpmedia01。

## 二期迭代 25 · 任务库发布后保留任务 + 已发布任务可重复发布到其他班级

教师反馈：任务面向某班发布后，任务库里就没有该任务了，也不能再次对其他班发布。要求任务库保留任务本身，因为教师需在不同时间面向不同班级发布。
- **根因（数据没丢，是 UI 过滤）**：任务行一直在 `design_tasks` 表，`published_classes` 支持随时增删、学生视图即时生效。问题在教师端 UI：①`DesignTasksAdmin.tsx` 任务库 tab 过滤 `status !== "published"`，发布后任务被挪去「已发布的任务」；②「发布」按钮只对未发布任务显示，已发布任务只有撤回/归档/统计/删除，无再次发布入口；③`DesignTaskEdit.tsx`「保存并发布」同样对已发布任务隐藏。唯一曲线是"撤回→变草稿→重发"，撤回期间学生短暂不可见。
- **修复**：①任务库 tab 改为展示**全部任务**（`list = tab==="library" ? tasks : published`，含已发布，带"已发布"徽章）；②「发布」按钮对所有任务常显，已发布任务 title=「编辑发布班级」，点击打开 `PublishClassModal`（`initialCodes` 已勾选当前发布班级），确认后 PATCH `publishedClasses` 增删班级；③`DesignTaskEdit.tsx`「保存并发布」常显，已发布任务文案=「保存并更新发布班级」，成功提示同步区分。撤回/归档/删除逻辑不变。
- **验证**：tsc 通过；临时任务实测"发布到 test01 → 再发布追加 jg2301"成功，`published_classes=[test01,jg2301]` 且 `tasks_student_view` 即时透出；CDP 确认任务库（1）保留已发布任务、卡片同时有「发布」+「撤回」按钮；真实任务 `task-chuangzhi-01` 状态（published/[test01]）未被扰动，临时任务与临时教师 tmppub01 已清理。

## 二期迭代 25 · 案例多媒体画廊（多图/视频/3D + 点击放大）+ 左侧卡片精简

- **媒体模型升级为数组**：`task_def.media` 由单对象改为 `CaseMediaData[]`（`{type:image|video|model, url, poster?}`）。`CaseMedia.tsx` 的 `normalizeMediaList()` 归一化（兼容旧单对象/空值）；`mediaThumb()`、`design.ts thumbFrom()` 均取首项推导列表缩略图。
- **上传接口唯一文件名**：`upload-media` 存储路径由固定 `{slot}.{ext}` 改为 `task-media/{taskId}/{ulid}.{ext}`（ulid 唯一），多文件不互相覆盖；`slot` 参数不再参与命名。
- **学生端画廊组件 `CaseMediaGallery`**（CaseMedia.tsx，variant=hero|panel）：主视图（图片可点击放大）+ 计数徽章「n/N」+ 横向缩略图条（点击切换、激活高亮）+ **灯箱**（fixed z-[70]，全屏放大、左右翻页、Esc/箭头键、点遮罩关闭）。背景页顶部与工作台左侧卡片共用。
- **学生端布局调整（教师要求）**：①背景页顶部媒体换 `CaseMediaGallery variant="hero"`；②工作台左侧 `CasePanel` 顶部静态缩略图换 `variant="panel"` 画廊，并**删除「场地事实」与「参考来源」两段**（不给学生提示，让其问场地顾问 AI；`task.case.facts` 数据仍保留供 `/api/design/chat` AI 上下文），只留案例背景 + 顾问提示；③背景页的「参考来源」行也一并删除。
- **教师端 `DesignTaskEdit` 多资源编辑器**：`mediaList` 数组态；「添加图片（可多选）/添加视频/添加3D模型」三按钮 + 各自隐藏 file input，逐文件上传后追加；资源列表每项=缩略图+类型+（视频/模型可「设封面」存 poster）+删除；保存写 `taskDef.media=mediaList` 并由首项推导 `coverUrl`。
- **验证**：tsc 通过；实测 3 图上传得 3 个唯一 URL、PATCH 存数组、学生页 SSR 出主视图+3 缩略；CDP 实测点击主图开灯箱、灯箱翻页/关闭、缩略图切换主视图均正常；工作台 CasePanel 渲染画廊且无「场地事实/参考来源」、保留「案例背景/顾问提示」。测试媒体/存储对象/临时教师 tmpgal01 已清理，任务还原默认封面。
- **已知边界**：教师端编辑页（DesignTaskEdit）dev 模式过重，CDP `Runtime.evaluate` 会超时（同 admin-plants），验证走 SSR/API/学生端；其加载与学生端共用 `normalizeMediaList`。

## 二期迭代 26 · S1/S2 评阅宽严度与反馈改造（教师确认：规则+AI 各半 / 提交后给参考要点）

- **背景**：教师反馈 S1/S2 AI 评阅太严苛学生闯关过不去，且不知道正确答案、不知道哪里错。`ask_user` 确认两点：①评分改「规则分+AI 语义分各半」，AI 按理解判分不死抠关键词；②提交后逐项指出错误并给出该题参考要点/正确方向。
- **⚠️ 提交契约（易错）**：S1 客户端 `payload` 是**扁平**结构（`payload:{light,soil,...}`，见 StageDiagnosis `payload: form`），**不是** `payload.diagnosisForm`。review 路由一律 `payload[f.key]` 读取；测试 curl 时若误嵌套 `diagnosisForm` 会导致 completeness/accuracy 全 0。
- **S1 评分（`ruleScoreS1` + `llmJudgeS1`）**：rule = keywordAccuracy*0.4 + coverage*0.3 + completeness*0.3（宽口径基线）；`llmJudgeS1` 语义判 8 项诊断是否理解到位（答对意思即给分），返回 `{score, weak[未答到点的 key], feedback, cards}`。final = round(rule*0.5 + llm*0.5)，LLM 挂回退 rule。
- **S2 评分（`ruleScoreS2` + `llmJudgeS2`）**：**修复原则计分缺陷**——界面最多选 4 条原则，旧代码却除以 7 导致原则分天然拿不满；现 `prin=(correctChosen/4)*40 - wrongChosen*8`。主定位不再一票否决：契合(edible/science/eco)=45、次优(leisure)=20、未选=0；理由≥3 条=15。final 同各半加权。
- **反馈给「哪里错 + 正确方向」**：响应新增 `issues[]`（问题清单：哪个诊断项没答到点/哪条原则选错/还差哪几个关键问题没问）与 `keyPoints[]`（参考要点：诊断项=mustMention 要点+hint；S2=推荐定位「可食+科普+生态复合」+ 推荐原则 p1-p7 + 可补充的正确原则）。S1 的 issues 优先用 LLM `weak`，失败回退关键词未命中项。
- **`ReviewCard` 新增两段渲染**：`问题清单`（issues，警示橙）+ `参考要点`（keyPoints，主色浅底）。`StageDiagnosis`/`StagePositioning` 刷新恢复时也带 `issues`/`keyPoints`（savedReview 里已存）。
- **实测（一次性学生 9990002，已清理）**：S1 换说法表述（无原词）→ llm 95 / final 89 通过，且精准抓出真实遗漏「地形高差缺东段低」+ 列出未问的 Q19/Q20；S2 次优（leisure+混入 p8）→ 59 临界但明确指正 + 给推荐定位/原则；S2 正确（edible+4 正确原则）→ 96 通过解锁。三诉求（能过关/知对错/给答案）均满足。
- **旧 `llmFeedback` 已删除**（被 `llmJudgeS1/S2` 取代），勿恢复。

## 二期迭代 27 · S4 植物筛选与合规审查（教师确认：学生标注分区条件 / 居中弹层选择器 / 规则+AI 各半）

- **背景**：学生依据左栏案例卡 + S2 原则 + S3 分区，**从植物图鉴选核心植物清单**（逐区选植），系统做**安全 + 生态合规审查**。教师确认三点：①分区场地条件由**学生给每个分区标注**（光照/水分/使用场景紧凑选择器）；②植物选择器用**居中弹层**（不跳页，严禁跳 `/catalog`）；③评阅=规则结构分+AI 各半加权，沿用 `rubricsByStage.S4`。
- **数据**：`page.tsx` 用 `loadPlantsForServer()` 投影 `toPlantPick()`（`src/lib/plant-compliance.ts`）得 `PlantPick[]`（含 riskType/avoidWaterlog/shadeTolerant/sunTolerant/edible 等合规字段，不含 quiz/笔记），透传 `DesignCase plants` → `StagePlanting`。
- **合规引擎 `src/lib/plant-compliance.ts`（同构纯函数，客户端实时提示 + 服务端评分共用）**：`plantHints(plant, cond)` + `zoneHints(zone)`。①安全：禁植(restriction=forbid)→error；有毒/有刺/致敏按使用场景(儿童/休憩)分级警示；**保守原则——资料未提及毒性不判安全，儿童区只提示"需核实"**。②生态：喜光植物进荫蔽区/耐阴进强光区、不耐积水进低洼区(waterlog)→warn；喜湿进偏干区→info。③其他：重复选、数量过多/为 0、条件未标注→info。
- **分区条件类型**：`ZoneConditions{light:sun/semi/shade/unknown, water:dry/moist/waterlog/unknown, usage:children/resting/ornamental/production/eco/unknown}`。S4 payload = `{zones:[{zoneId,name,color,conditions,plantIds[]}]}`（zoneId/name/color 承自 S3，conditions+plantIds 为 S4 新增）。
- **组件**：`PlantPicker.tsx`（居中弹层：搜索+分类/光照/水分/安全性筛选+可食用开关+卡片网格，每卡「加入」/已选标记）；`StagePlanting.tsx`（中栏上=S2 原则+S3 分区只读回显；中栏主体=逐分区「条件选择器+已选植物缩略+添加植物+就地合规提示条」；右栏=评阅卡）。草稿存 localStorage `zjxj:design:{taskId}:S4:{userId}`。
- **S4 评分（`ruleScoreS4`+`llmScoreS4`）**：rule = coverage*0.30 + conditionsMarked*0.15 + diversity*0.20 + safety*0.35（diversity 按乔灌草层次数，safety 按 error/warn 扣分）。final = round(rule*0.5 + llm*0.5)，LLM 挂回退 rule。`issues`=合规 error/warn 逐条(带分区名)+未选植物/未标注条件的分区；`keyPoints`=选植通用要点。
- **实测（一次性学生 9990003，已清理）**：儿童区放禁植夹竹桃 + 雨水花园放不耐积水垂丝海棠 → 合规精准抓出两条，规则 81 / LLM 58 / final 70 通过，反馈还指出缺灌木层。
- **注意**：S4 依赖 S3 已产出分区（`run.stage_payloads.S3.payload.zones`）；无 S3 分区时清单为空、提交按钮禁用。
- **阶段过渡约定（教师要求，全站强制）**：评阅通过后**不自动跳转**下一阶段——各 Stage 组件提交回调里禁止调 `onUnlocked()`；过渡一律由学生点击 ReviewCard 的「进入 Sx」按钮触发（`onNext={review.passed ? onUnlocked : undefined}` + `nextLabel`）。S1-S5 已统一为此模式（S2/S3/S4 曾误加 `if (data.passed) onUnlocked()` 自动跳转，已移除）。S6 落地时沿用。

## 二期迭代 28 · S5 平面布局与种植设计（教师确认：本轮含 AI 示意图 / 专业层次符号 / 右栏按 S4 分区分组）

- **背景**：学生在中栏画布（自动载入 S3 分区）把右栏（S4 植物清单）的植物**拖拽落位**到分区，画布下方按分区写**建设计划**，点「生成」得**种植设计图**，提交后 AI 评阅。教师确认三点：①AI 手绘示意图本轮一起做（标注「AI 效果示意，非精确种植图」）；②植物用**专业符号**（按乔/灌/草/藤/竹层次不同图形+植物代号+图例）；③右栏清单**按 S4 分区分组**。
- **红线（教师强调）**：主方案=**程序化精确种植图**（SVG，位置与画布严格一致、可核对、可导出），AI 生图只是示意增强；「AI 识别画布」读**结构化数据**（分区多边形+落位坐标+植物 id），**不做图像识别**。
- **数据模型**：S5 payload = `{zones:[{zoneId,name,color,conditions,plan,placements:[{id,plantId,x,y}]}]}`（**不存 points**，几何取自 S3；conditions 承自 S4）。`buildInitial` 以 S3 分区（含 points）为骨架，合并 S4 conditions + 已存 S5 的 plan/placements。meta = `{totalPlants, plansWritten}`。
- **共享符号 `src/components/design/plant-symbols.tsx`**：`LAYER_COLOR/LAYER_LABEL`（tree/shrub/herb/vine/bamboo 五色）、`PlantGlyph`（按层次渲染图形+代号标签，`labelScale` 控字号）、`pointInPolygon`（射线法落区判定）、`assignPlantCodes`（按首次出现分配 A/B/C…，同植物同代号）。
- **画布 `PlantingCanvas.tsx`**：复用 S3 `canvasGeom`/旋转/缩放/`getScreenCTM().inverse()` 坐标换算。分区只读渲染；落位符号**屏幕恒定大小**（`zk=view.w/S` 补偿）。**列表→画布用 HTML5 原生拖拽**（`onDrop` 换算内容坐标+`pointInPolygon` 定区）；**已落位植物用指针事件拖动微调/跨区移动**；点分区聚焦（`selectedZoneId`）、点符号选中（浮层「移除」）。无分区时提示先完成 S3。
- **设计图 `PlantingDiagram.tsx`**：独立 SVG（纸感底 #FBF7EE+feTurbulence 手绘质感），分区色块+植物符号（内容坐标，位置与画布一致）+图例（代号+层次+植物名）+标题+日期。`downloadPlantingDiagram` 导出 SVG。
- **AI 示意图 `/api/design/render-plan`**：`ImageGenerationClient`（同 /api/plant-render），`requireUserToken`+限频 2/分、10/天，内存缓存（summary hash），prompt 强制水彩手绘社区花园种植设计效果图。客户端弹层里**明确标注「AI 效果示意，非精确种植图」**。
- **S5 评分（`ruleScoreS5`+`llmScoreS5`，各半加权）**：rule = fit*0.30（**复用 plant-compliance `zoneHints`** 数 error/warn）+ structure*0.25（层次数 ≥4:100/3:80/2:55/1:30）+ season*0.20（`phenology.seasonInterest` 值域 0-5，阈值 ≥2，每季 ≥2 种记覆盖，4 季满分）+ function*0.25（儿童区安全植物占比/生产区可食用占比/其余有植物即得分，无 plan 打 8 折）。LLM 读「分区+条件+植物+建设计划+S2 定位+案例背景」，prompt 要求先肯定再指正、口语化。
- **实测（一次性学生 9990004，已清理）**：坏方案（儿童区放有毒绣球/玉簪、雨水区放不耐积水垂丝海棠/杜鹃、禁植水仙）→ 合规精准抓出全部 6 条，rule 43/LLM 62/final 53 未过；好方案（乌桕+一串红+旱金莲+爬山虎，乔灌草藤四层、四季有景、无毒）→ rule 94/LLM 62/final 78 通过，LLM 还指出一串红上海冬季无法露地越冬。**宽严校准达标：坏方案挡得住、好方案过得去。**
- **接线**：`DesignCase` S5 路由 `StageLayout`（`onUnlocked→S6`）；占位条件排除 S5；`OPEN_STAGES` 加 S5（stageWeights S5=15 已预置）。
- **依赖**：S5 需 S3 分区（几何）+ S4 植物清单（右栏来源）；缺 S3 或 S4 清单为空时给对应提示、提交禁用。

## 二期迭代 29 · 学生端 UI 鲜亮化（教师要求：鲜艳、灵动；只改学生端，教师端/共享导航不动）

- **机制（关键）**：不动全局 `@theme` 令牌（教师端共用），而是在 `globals.css` 加 **`.student-vivid` scope 类**，覆写 M3 CSS 变量（`--color-primary` #2f7a4f→#1ba65c、primary-container、植境色谱 sprout/blossom/lavender/sun/water/bark 全部提饱和）。因 Tailwind v4 的 `bg-primary` 等编译为 `var(--color-primary)`，scope 内自动生效、scope 外（教师端/导航）保持原样。**已验证**：编译产物含 `.student-vivid{--color-primary:#1ba65c…}`，学生页 HTML 有此类、/admin 无。
- **挂载点（6 处，新增学生页必须挂）**：`catalog/chat/learning/design(列表)/plant-quiz` 各 page 的内容包裹 div + `DesignCase.tsx` 工作台根 div（`student-vivid fixed inset-0…`）。plant-quiz 有两个同样式包裹 div（错误分支+主分支），别漏主分支。
- **新增工具类（globals.css 尾部）**：渐变 `grad-leaf/sprout/blossom/sun/water/lavender`（克制用：统计卡图标块/主 CTA）；`.lift`（悬停上浮 -4px+shadow-float）；`.rise`（入场，**fill-mode 必须 backwards 不能 both**，否则锁住 transform 挡住 hover）。均带 `prefers-reduced-motion` 降级。
- **落地**：学习大屏 5 个 `StatCard` 加 `tone`(渐变)+`index`(stagger 70ms)，图标块从单一 primary-container→多色渐变白图标；图鉴 `PlantCard` 用 `.lift`+标签 chips 循环 `TAG_TONES`(primary/water/blossom/sun container)；设计列表任务卡 `.lift`+`.rise` stagger。chat/quiz 仅靠 scope 提色（交互页不叠加动效）。
- **注意**：向 globals.css 追加类后若遇 Turbopack 竞态（类不进产物）需重启 dev server；本次已确认进产物。新增学生端页面/组件要鲜艳就挂 `.student-vivid` 并用上述工具类，**勿硬编码新色值**。
- **二期 29b · 设计工作台卡片/输入框分色（教师嫌全白太素）**：工作台各卡按阶段上色（容器色 /40–/60）：案例卡&左栏案例面板=primary、S1 对话=water、S1 诊断表=sprout、S2 主卡=lavender、S2 回显=water、S3 画布/工具/要求=sun、S4 选植依据=sprout/分区卡=primary/评阅位=blossom、S5 画布=primary/计划=sprout/清单=water/评阅=blossom、`ReviewCard`=blossom。输入框统一靠 `globals.css` 规则 `.student-vivid input/textarea/select{background:#fff;border-color:rgb(27 166 92/.35)}`（白底+绿描边，与彩色卡片区分）。**坑**：手写 `color-mix(in srgb, var(--x) 32%, …)` 的自定义规则会被 Lightning CSS 整条静默丢弃（不报错、产物无此类），须用字面 `rgb()/hex`；改完 grep 编译产物确认。S2 选项 chips 改白底+`border-lavender/50`+`shadow-card`（hover 上浮）以突出立体；工作台顶栏加低透明度花瓣装饰（`Flower/Flower2`，`text-blossom/40` 等，`pointer-events-none` 不拦交互）。

## 二期迭代 30 · S6 方案评估（收口阶段：五维自评 + AI 评估报告 + 定稿，最终成绩）

- **定位**：S6 是任务收口，只评估学生自己这一套方案（本轮无公众评审、无多方案比选）。学生对照**五维**（生态性/安全性/景观性/运维性/适用性，源自 `stages[5].rubrics` selfEval desc）自评打分 + 写依据（落到具体分区/植物）→ AI 出评估报告 → 定稿。**最终成绩 = S6 分**（一锤定音）。
- **评分标准**：`rubricsByStage.S6` 与 `stages[5].rubrics` 均为两项——`五维自评质量 40` + `方案综合质量 60`（原公众意见落实 35/多方案比选 25 已取消并入）。教师可在任务编辑器调整，以教师端为准。`stageWeights.S6=15` 仍用于 design-stats 的过程加权总分（与最终成绩并存，最终成绩以 S6 为准）。
- **评阅（`/api/design/review` S6 分支）**：`ruleScoreS6`（自评质量 0-100 = 完整性 50% + 依据落地性 50%，落地=依据文本含分区名或植物名，refs 由 `collectS6Context(run)` 从 S3/S4/S5 服务端数据取，不依赖客户端 meta）+ `llmScoreS6`（方案综合质量，注入 rubric/案例背景/S2 定位原则/方案概要/五维自评，返回 score + selfEvalCheck 核验自评 + strengths/issues/suggestions/feedback/cards）。最终 `score = round(rule*0.4 + llm*0.6)`，LLM 挂回退纯规则分。问题清单 = 未落地维度 + LLM issues。
- **定稿落库**：S6 提交后 `patchRun(run.id,{total_score: finalGrade, ...(passed?{status:'completed'}:{})})`，`finalGrade = max(本次分, 历史最佳)`。`saveStageRecord` 的 review 含 strengths/suggestions/selfEvalCheck（存入 stage_reviews.S6 与 stage_records.review，供成绩单还原）。
- **组件 `StageEvaluation.tsx`**：中栏①五维自评表单（每维 0-20 range + 依据 textarea，lavender-container 卡）②终版方案图（复用 `PlantingDiagram`，从 S3 分区几何 + S5 落位重建，只读，primary-container 卡）；右栏 AI 评估报告（blossom-container 卡，展示出分/核验自评/综合评语/优点/问题清单/改进建议，通过显示"已定稿+最终成绩"）。草稿存 localStorage `zjxj:design:{taskId}:S6:{userId}`；守卫=需 S5 通过（`stage_scores.S5>=passScore`）。挂在 `DesignCase` `stage==="S6"`（替换原占位）。
- **提交契约**：`{taskId, stageKey:"S6", payload:{selfEval:[{key,label,score,basis}]}, meta:{}}`。meta 留空（上下文全由服务端从 run 推导）。
- **成绩单/成绩回流**：
  - 学生端：`design.ts getMyDesignTranscripts(userId)`（cloud；各阶段最佳分+AI 评阅 feedback+最终成绩）→ `/learning` 页 `DesignTranscript` 组件（替换原"植景设计成果"占位）。local 模式服务端返回空。
  - 教师端：`design-stats.ts OPEN_STAGES` 加 `S6`；`StudentTaskRow.finalScore = stageBest.S6`；`TaskStatsPanel` 学生表加"最终成绩"列（`text-primary`）。学情看板/任务统计经同一 `design-task-stats` 接口自动带上 S6 列与最终成绩。
- **已实测**：临时学生 seed S1-S5（各 80）→ 提交 S6 五维自评 → 规则 100/LLM 62/最终 77 通过定稿，run.status=completed、total_score=77、selfEvalCheck 落库；/learning 渲染"植景设计成绩"+各阶段最佳分+最终成绩；教师 design-task-stats stageStats 含 S6、row 含 finalScore。测试账号与 seed 行已彻底清理（users/profiles/runs/records=0）。

## 二期迭代 31 · 结束设计（退出案例时选择保留/清空进度）

- 背景：学生每次进案例都基于上次进度，无重置入口、不知内容是何时留下的。教师要求退出时给两个选择。
- **工作台顶栏新增「结束设计」按钮**（`DesignCase.tsx` workbench header，DoorOpen 图标，`ml-auto` 靠右）→ 打开 `EndDesignDialog` 居中弹窗，两个选项：
  - **终止（保留进度）**：`keepAndExit` 直接 `location.href="/design"`，进度不动，下次接着做。
  - **直接退出（不保留）**：`discardAndExit` → `DELETE /api/design/progress?taskId=` 清库 + 逐个 `localStorage.removeItem` 清 S1–S6 草稿（key `zjxj:design:{taskId}:S{n}:{userId}`）→ `location.href="/design"`，下次从头开始。清空中按钮置灰显示"正在清空…"。
- **后端**：`design.ts` `resetRun(taskId,userId)` 按 run_events→stage_records→student_runs 顺序删；`/api/design/progress` 新增 `DELETE`（requireAuth，cloud 才清库，local 直接 ok）。
- 新学生无 run 自然从头开始（原逻辑，未改）。正常「案例背景→返回案例列表」保持默认保留，未动。
- **已实测**：临时学生 seed run+stage_record+run_event → DELETE 后 GET run=null、三表 count=0；账号已清理。

## 二期迭代 32 · 三类问题修复（退出闪现 / 个人中心资料 / 任务管理按钮精简）

- **① 退出登录绿色闪现**：`AppShell` 退出原用 `location.href="/"` 整页重载，冷加载期间首页 HeroMask 的 `primary-container` 绿底先于 hero-bg.webp 出现。改为 `router.push("/")` 软导航——保留当前页直至首页 RSC 就绪再切换，无绿闪。logout 路由清 cookie + `invalidateSessionCache` 未动。**勿改回 location.href**。
- **② 个人中心资料**：显示链路（register→`handle_new_user` 触发器→`profiles.contact_email/class_code/account`→`getSessionUser`→AppShell）经 curl 验证对新注册账号端到端正确。真实缺口在**班级导入**：`importRoster` 建新用户原不带 `account`（→profiles.account 为空），已补 `account: row.studentNo`；「移入已有学生」分支原 `updateUserById({user_metadata:{class_code,class_name}})` 会整体覆盖 metadata，已改先 `getUserById` 取原 metadata 再 spread 合并。存量已回填 `update profiles set account=student_no where role='student' and account is null`。**导入学生的 contact_email 天然为空**（名单只收姓名+学号），学生在个人中心自行补填，属预期非 bug。
- **③ 任务管理按钮精简（取代迭代 6 的「编辑/发布/撤回/归档/删除」描述）**：`DesignTasksAdmin` 卡片操作现为——编辑(常显)/学生统计(仅 published)/发布·管理班级(常显，Send)/删除(仅非 published)。**删除了「撤回」「归档」两个独立按钮**：按班级撤回并入「发布」弹窗（`PublishClassModal`，`initialCodes` 非空=管理模式，取消勾选即撤回该班级，全部取消=撤回全部回草稿，管理模式允许 0 班级确认）；归档功能整体移除。`confirmPublish` 空班级→`{status:"draft",publishedClasses:[]}`。**DELETE 守卫**：`/api/admin/design-tasks/[id]` DELETE 先查 `status`，published 返回 400「请先撤回全部班级」，非 published 才真删。已发布任务按钮数 6→3。
- **已实测**：生产重建后——新师/生登录 RSC 载荷含 account/contactEmail/classCode；logout Set-Cookie 置过期、匿名 / 渲染 HomeHero；DELETE published 任务被拒(400)且任务仍在；临时任务 publish→部分撤回→全部撤回(变 draft)→删除全链路 200；真实任务 task-chuangzhi-01 未受影响(仍 published 4 班)；诊断账号 diagt01/diag90001 及孤儿行已清理(users=0/orphan=0)。

## 二期迭代 33 · AI 学情分析对话框（学情看板内嵌，四段式安全架构）

- **位置/形态**：教师指定不新增路由/导航，直接内嵌进 `/admin-students`，占据原「掌握判定口径」说明块位置（grid 顶部 `lg:col-span-5`）。**该说明块文字已删除**，但 `computeMastery` 判定、`app_settings` 阈值、「植物数据」页 50–100% 设置**一律未动**——只删了本页展示，`admin-students/page.tsx` 不再调 `getMasteryPassRatio/getRebaseReport`（这两函数及 settings 路由、其它页调用仍在）。原统计内容（班级掌握对比/最近练习动态/学生掌握明细/班级管理/设计任务统计）全部保留同页共存。
- **四段式架构（红线：绝不让 AI 自由写查询）**：教师提问 → ① LLM 输出结构化意图 JSON（`intent.ts` 白名单字段）→ ② 服务端白名单校验+实体解析（班级/学生/任务名对齐真实实体，非法即澄清）→ ③ 参数化执行预定义聚合（`metrics.ts`，全部走 supabase-js `.eq/.in/.gte`，**零 SQL 拼接**）→ ④ 查询结果作为事实注入 LLM 仅作自然语言表达（**表格/图数据由服务端从查询行直接构建，LLM 不产数字**）。
- **指标白名单（8 个，复用单一聚合源保证口径一致）**：`overview`/`class_mastery`/`student_ranking`/`practice_trend`/`plant_difficulty`/`task_submission`/`task_stage_scores`/`active_students`，分别复用 `getTeacherStats`/`getClassComparison`/`getStudentRows`/quiz_attempts 按天聚合/`getHardPlants`/`loadPublishedTaskStats`/`loadTaskStatsDetail`。改统计口径只改这些聚合函数，对话框自动同步。
- **关键文件**：`src/lib/analytics/intent.ts`（意图 schema+指标目录+示例问题）、`src/lib/analytics/metrics.ts`（实体解析+8 执行器，返回 `{basis,table,chart,facts}`）、`src/app/api/admin/learning-analytics/route.ts`（SSE 四段管线，`getSessionUser` 校验 role=teacher，事件 `status/result/delta/clarify/error/done`）、`src/components/LearningAnalyticsChat.tsx`（对话 UI：可滚动结果区+底部固定输入+语音+示例问题+复制结论）、`src/components/analytics/AnalyticsChart.tsx`（recharts，`ssr:false` 动态加载）。
- **「依据」回显**：每个结果带 `basis`（指标/过滤条件/命中人数/时间范围），前端渲染在图表上方供教师核对。
- **与植景管家分工**：本页=深度分析（图表+可复制结论），**只读不做操作**（操作类问题如"帮我发布任务"会被意图解析拒绝→澄清）。接收植景管家跳转：`?q=<问题>` 优先，否则用 `?class=&task=&range=4w` 组装问题，mount 时自动执行一次（`questionFromLocation`）。两者数据口径一致（同聚合入口）。
- **已实测（生产）**：8 指标全部返回真实数据且与 DB 一致（overview 2 生/6 练/135 植物/1 任务；class_mastery 出 bar 图；active_students 正确识别未练习者；plant_difficulty 含笑 33%/蒲苇 38%；student_ranking 按"秋千"解析到 20232001027；task_stage_scores 6 阶段；practice_trend 出 line 图）；操作类问题正确澄清；无 cookie 返 401；`/admin-students` 200 且旧说明块 0 次、对话框已渲染。临时教师 aianal01 已清理（profiles/auth.users=0，孤儿=0）。
- **已知边界（教师示例中的两类拉伸能力暂未做）**：①"近 4 周各班提交率趋势对比"——现只有按天练习趋势+任务提交当前快照，无按周×班级的提交率时序；②"哪些学生下滑趋势"——现以 `active_students` 未活跃名单近似，非真正斜率趋势。均为真实数据稀缺（当前 0 条设计 run）下的取舍，后续有数据再增强。

## 二期迭代 34 · 图鉴内嵌问答窄栏（复用第 4 轮对话引擎，外壳常驻+引擎延迟加载）

- **核心=复用，不复制对话 UI**：图鉴页 `/catalog` 右侧常驻窄栏（`xl:` 断点起，340px 第三列），直接复用第 4 轮 `useChat`（`mode:"embedded"`）+ `ChatPanel` + `RecommendPanel`，与 `/chat` 同一套对话/流式/语音/资源逻辑。严禁在图鉴页另写一份对话 UI。
- **外壳常驻 + 引擎延迟加载（性能红线）**：`CatalogChatColumn.tsx`（eager 外壳，含空态/占位输入框/提示）常驻；`CatalogChatEngine.tsx`（真正 `useChat`+ChatPanel+RecommendPanel）经 `dynamic({ssr:false})` 懒加载。**关键坑：外壳不得从引擎模块静态 import 任何符号**（曾把 `CATALOG_CHAT_KEY` 从引擎 import 进外壳，会把引擎打进 eager chunk），改为外壳本地 `const CATALOG_CHAT_KEY="zjxj:catalog-chat"` 字面量，两文件各自定义同名字面量。引擎拆成 `bed3e75c81e2f415.js`(50KB)+`2abcbfdaacd376eb.js`(24KB) 两个懒 chunk，不在首屏清单。
- **卡片「AI 讲解」入口**：`PlantCard` 外层 `<button>` 改 `<div role="button" tabIndex>`（避免嵌套按钮），footer 加 `onExplain` 触发的「AI 讲解」胶囊按钮（`stopPropagation`）。点击 → `PlantCatalog` `setExplainPlant` → 窄栏原地激活该植物上下文，不跳页。
- **切植物策略（已报告）**：每株植物开**新会话**（`CatalogChatEngine key={plant.id}` 强制重挂载，上下文条可清除）。不做跨植物续聊。
- **「展开为完整页」延续同一会话**：引擎头部 `Maximize2` 链接 → `/chat?conv={activeId}`（有会话）或 `?plantId=`（无会话）。为此 `chat/page.tsx` 读 `conv` → `ChatClient initialConvId` → `useChat` 新增 `initialConvId`（page 模式自动打开该会话并跳过自动发送；embedded 模式新增 reopen effect `openConversation(initialConvId)`）。
- **source=catalog 分组（复用第 5 轮机制）**：`useChat` `source = mode==="embedded"?"catalog":"chat"`（use-chat.ts L62），图鉴会话自动归入 `/chat` 历史「图鉴速查」组，无需新代码。
- **刷新不丢**：引擎把 `{plantId,plantName,convId}` 写 localStorage `zjxj:catalog-chat`；外壳 mount 时读回 `restored`，同植物则传 `initialConvId` 还原（消息+资源走 `openConversation` 服务端还原）。
- **ChatPanel 高度按 mode 分支**：`flush` 时 `page`/`embedded` 均 `h-full`（占满父容器）；非 flush 时 `page` 用 `min-h-[540px] lg:h-[calc(100vh-40px)]`、`embedded` 用 `h-[480px]`（实际死分支，图鉴恒传 flush）。
- **图鉴 AI 助教（教师点名，两轮迭代）**：`mode==="embedded"` 仅图鉴使用（/chat 是 `page`）。① 隐藏输入框上方 `quick` 推荐问题 chips；② 话筒挪到输入框上方单独一行、输入框+发送独占一行（textarea 171→223px）；③ **已删 RecommendPanel**（相关推荐/造景效果图/相关链接），只留对话框——ChatPanel flush 由 `h-[480px]` 改 `h-full` 占满 AI 栏（实测消息区 650px），header「展开为完整页」保留。实现=输入区抽成 `textarea/micBtn/sendBtn` 变量，`embedded` 走堆叠 `<form>`、`page` 走原单行。**/chat 页不受影响**：RecommendPanel（ChatClient 右栏）+ 快捷问题 + 单行输入均保留（桌面端有移动/桌面两个 ChatPanel 实例，验证要取可见实例）。
- **植物详情弹窗 footer（教师点名）**：已删「AI 讲解」按钮（原 →`/chat?plantId=`），只保留「开始练习此植物」（→`/plant-quiz?plantId=`）；列表卡片上的「AI 讲解」胶囊（PlantCard `onExplain`，激活右栏 AI 助教）保留。PlantDetailModal 的 `MessageCircleQuestion` 导入随之删除。
- **sticky 修正**：窄栏 `xl:sticky xl:top-20` 必须放在 `<aside>` 本身（grid item，配 `items-start`），不能放内层 div（父=内容高度则 sticky 失效）；对齐左侧筛选栏 `lg:sticky lg:top-20` 的既有可用写法。
- **实测（生产构建）**：BEFORE HTML 134,079B / JS 504,264B(9 chunks)；AFTER HTML 146,846B(143.4KiB ≤150KB) / JS 508,130B(9 chunks, 0.485MB ≤0.5MB)，JS 增量 +3,866B(≤10KiB)。nomodule 排除 1 个（大小写不敏感）。SSR：外壳在(AI 助教×1)、引擎文案 0、`<main>`=1、`max-w-shell` 在、AI 讲解按钮 12+。三列网格 `xl:grid-cols-[280px_minmax(0,1fr)_340px]`，`lg` 两列（窄栏 `hidden xl:block`）。
- **端到端（已清理）**：临时学生 d3tmpx01 登录→POST /api/chat source=catalog 流式 OK→chat-history 返 source=catalog、消息落库 2 条→清理后 users=0/孤儿 chat/profiles/mastery=0。
- **未动**：筛选逻辑/AI 提示词/接口契约/数据字段名、AppShell 宽度与账号下拉、品牌、无 DDL、无新依赖、无 base64、`.gitignore` 无 src 项；移动端本轮不做（未删既有移动样式，未加 <1280 抽屉）。

## 二期迭代 35 · 安全加固第一批（P0-1 教师邀请码 / P1-1 chat 双轨限流 / P1-2 登录限流）

- **P0-1 教师注册邀请码（服务端强制，fail-closed）**：`register()` 教师分支（auth-service.ts）最前读 `process.env.TEACHER_INVITE_CODE`——未配置/空 → 「教师注册暂未开放，请联系管理员」（整体关闭）；不匹配 → 「教师邀请码不正确，请向管理员索取」。比较结果不回显、不落日志。前端 AuthPanel 教师分支加「教师邀请码」必填框（`name="inviteCode"`，仅 role=teacher 显示），路由 `api/auth/register` 透传。**只影响注册**：教师登录、学生注册、既有教师（吴老师，唯一 teacher）均不动。
- **邀请码配置方式（教师待配置）**：代码只读 `process.env.TEACHER_INVITE_CODE`，来源无关。可用通道：① 平台自定义环境变量（若平台设置页提供）；② 项目根 `.env.local`（已验证 Next 16 自定义 server 启动自动加载——base-server 构造函数调 loadEnvConfig；文件已在 .gitignore，不进仓库）。**当前线上无该变量 = 教师注册关闭（安全默认态）**，教师配置后重启生效。值严禁进代码/对话/日志。
- **P1-1 /api/chat 双轨限流（保留游客问答，绝不 401）**：沿用 AI 路由族模式（路由本地 `usage` Map + 分钟/天双窗口 + 429 `{error:"RATE_LIMITED", message:中文}`）。键带前缀区分双轨、互不挤占：登录 `user:{id}` 20 次/分·300 次/天；游客 `ip:{x-forwarded-for 首段||'unknown'}` 5 次/分·30 次/天（游客日限文案带登录提示）。检查在 getSessionUser 之后、LLM 之前。
- **P1-1 截断与体积**：`messages[].content.slice(0, 2000)` 静默截断（保留 `slice(-12)`）；`content-length > 64KB` → 400「请求内容过长」；ChatPanel 共享 textarea 加 `maxLength={2000}`（/chat 与 D3 窄栏同生效）。截断验证口径：登录用户发超长消息后查 chat_messages.content 长度=2000。
- **P1-2 登录限流**：复用 `rateLimited()`（认证族，与 `reset-ip:` 同习惯），键 `login-ip:{ip}` **30 次/分**（任务示例 10 次/分，因全班同教室 NAT 出口集中登录场景上调，防误伤）+ `login-user:{identifier 小写}` 5 次/分；429 带 `Retry-After: 60` + 「尝试过于频繁，请 1 分钟后再试」。成功/失败请求均计数（单账号 5/分是暴破主防线）。
- **已实测（生产构建）**：教师注册三态（无码/错码→拒，对码→成功+可登录）；fail-closed 两次确认；游客第 6 问 429、登录用户 20/分边界（并发 25 打入，窗口余量 8+放行 12=20 后全 429）、游客 429 时登录用户仍 200（互不挤占）；超长 2706 字符落库 2000；登录账号维度第 6 次 429+retry-after:60、IP 维度 30/分并发确认；回归学生注册/登录/问答/D3(source=catalog) 全过；tsc 0 错；体积 /catalog HTML 143.4KiB·JS 0.485MB、/ HTML 8.7KiB·JS 0.472MB（均达标）。测试教师 accept_t01 与临时学生 9999990001 已清理（profiles=0/孤儿=0）。
- **诚实边界**：吴老师密码未知，其本人登录未实测——依据为 login() 逻辑零改动 + 门槛前注册的临时教师登录成功；日额度（300/30）与分钟额度同一 stamps 代码路径，未实打 300 次。
- **本轮明确不做（留后续）**：P1-3 拼接过滤、P1-4 CSRF Origin、P1-5 初始密码、依赖审计、全部 P2、design/review 与 design/chat 限流（两个无鉴权 AI 路由仍无限流，已知风险，教师已确认后置）。

## 二期迭代 36 · 教师邀请码配置（教师注册解锁）

- **配置落地**：教师提供的 `TEACHER_INVITE_CODE` 值已写入项目根 `.env.local`（.gitignore 第 110 行保证不入库；值不进代码/对话/日志，只存在于该文件与运行时进程环境）。无代码改动，仅重启生产预览即生效（环境变量进程启动时由 Next 16 base-server loadEnvConfig 加载，无需重新构建）。
- **已实测（生产构建）**：错码注册 → 「教师邀请码不正确，请向管理员索取」；对码注册 → `ok:true, role:teacher`（临时教师 accept_t02@test.local）；新教师登录 → `ok:true, role:teacher`；学生注册（无邀请码字段）回归通过。
- **清理**：临时教师 accept_t02 与临时学生 9999990002 已删（profiles 级联=0，mastery/quiz_attempts/chat_messages/student_runs 孤儿=0）。
- **运维口径**：改码 = 编辑 `.env.local` 该行后重启；临时关闭教师注册 = 删除该行后重启（回到 fail-closed 默认态）。

## 二期迭代 37 · 左侧导航栏改版 + 用户中心 + 首页三处修复

- **导航改版（顶部白矩形 → 左侧绿色侧栏）**：`AppShell` 重写。lg+ 侧栏 `fixed inset-y-0 left-0` 贴边与内容区连通（右缘分隔条可拖动调宽 200–400px，存 `zjxj:sidebar-w`；品牌区=logo-mark.webp+植景小匠+版本号，中部=胶囊菜单项，底部=用户区）；`<lg` 为悬浮圆角顶栏 + 汉堡抽屉（圆角面板 `drawer-in` 滑入，点遮罩关闭）。内容区 `lg:ml-(--sidebar-w)`，保留 `max-w-shell`。未登录底部显示「登录」回首页。
- **「薄荷绿洲」视觉移植（教师下发原型 `assets/薄荷绿洲-Dashboard原型.html`，只取颜色/卡片/导航效果，内容结构不变）**：@theme 色板换薄荷绿（primary `#31b570`、primary-container `#e7f5ec`、on-primary-container `#2e9e68`、on-surface `#1e2a4a`、on-surface-variant `#3a4a6b`、outline `#e6ecea`）；页底 `#EDF4F0`（layout body + shadcn --background + floral 罩色同步）；`--radius: 1rem`（rounded-lg=16px 卡片圆角）；`--shadow-card/float` 改绿调大模糊负偏移柔影；菜单项胶囊化（`rounded-full h-11`，选中=白底绿字 shadow-float）；`.student-vivid` 主色同步新色板；深色覆写保留。StageZoning 分区 PALETTE 与 PlantingDiagram 文字色属内容配色未动；卡片悬停上浮未做全局化（避免波及输入框/静态面板）。**后续「去灰蒙蒙」微调（教师反馈整页/侧栏发灰）**：侧栏文字提纯白（inactive nav `text-white`、版本 `/85`，禁低透明白字）；阴影收紧 `--shadow-card: 0 12px 28px -16px rgba(31,90,60,.32)`、`--shadow-float: 0 6px 16px -10px rgba(31,90,60,.26)`（原 40px 大模糊显弥散）；容器 token 提亮（surface-container `#f5f9f7`/high `#eef4f1`/highest `#e7efe9`，原 `#edf3ef/#e2ebe5/#d7e2da` 灰阶过重）；边框可见化（outline `#d9e3de`/variant `#e3ebe7`，原 `#e6ecea` 近隐形）。
- **版本号注入**：`next.config.ts` `import pkg from "./package.json"` → `env.NEXT_PUBLIC_APP_VERSION = pkg.version`（当前 0.1.0）。侧栏与「检查更新」共用；改版本号改 package.json 后需重建。
- **用户卡片弹窗**（侧栏底部头像+名称触发，向上弹）：头像+名称+角色/班级 → 设置 / 外观 / 意见反馈 / 检查更新 / 退出登录。
- **设置弹窗** `SettingsModal.tsx`：迁移原下拉里的资料编辑（学号/邮箱/班级码）+ 修改密码，逻辑不变（/api/auth/profile、/api/auth/password）。
- **外观=主题切换**：`<html class="dark">` + `localStorage zjxj:theme` + layout.tsx 内联防 FOUC 脚本。`globals.css` 新增 `.dark` M3 令牌覆写（表面压暗、文字反相、主色保持植物绿）、`.dark body`/`.dark .admin-floral-root` 深底罩、`.dark .student-vivid` 令牌反制 + 输入控件深底。侧栏/品牌主色不翻转。
- **意见反馈**：`feedbacks` 表（exec_sql develop 落地：RLS 仅本人 insert、无 SELECT 策略，教师查看走 service role）+ `POST /api/feedback`（登录+长度校验+进程内限流 5/时 10/天，local 模式明确拒绝）+ `FeedbackModal.tsx`。DDL 已追加 `supabase/schema.sql`。
- **检查更新**：`UpdateModal`（AppShell 内）显示当前版本，模拟检查后提示「已是最新版本」。
- **首页三处修复**：删校徽（badge.png 保留）、聚光半径 200→140px、`AuthPanel` 关闭按钮加底色悬停变红 + 页签 `mt-4` 避让。
- **连通+可拖动布局（教师追加指令）**：侧栏不再悬浮分离——改 `fixed inset-y-0 left-0` 贴边与内容区连通，右缘分隔条可拖动调宽（200–400px）。/chat 桌面端三板块（历史/对话/推荐）并入**单个连通大卡片**，两条分隔条分别拖动左栏（180–400）与右栏（220–420）宽度；ChatPanel/RecommendPanel 新增 `flush` prop（内嵌时去自身卡片外壳），conversationList 拆出 `conversationListInner` 片段复用；窄屏布局不变。**图鉴页同款改造**：筛选/植物库/AI讲解三模块并入单个连通大面板（`lg:h-[calc(100vh-4rem)]` 定高，三栏各自内部滚动，消除原"页面滚+栏内滚"混乱）；筛选栏（220–420）与 AI 讲解栏（280–480，xl+）宽度可拖动；CatalogChatColumn/Engine 增加 `flush` 透传（ChatPanel embedded+flush = 480px 高无外壳）。宽度持久化：`zjxj:sidebar-w` / `zjxj:chat:left-w` / `zjxj:chat:right-w` / `zjxj:catalog:filter-w` / `zjxj:catalog:ai-w`。共享 hook `src/lib/use-drag-width.ts`（pointer 拖动+边界钳制+localStorage）；main 左边距走 `lg:ml-(--sidebar-w)`、图鉴分栏走 `lg:w-(--filter-w)`/`xl:w-(--ai-w)`（根节点 style 下发 CSS 变量）。
- **三页重复大标题移除（教师反馈顶部空间浪费）**：/learning、/design、/catalog（PlantCatalog 内）三处页面左上角重复的 h1（学习管理/植景设计/植物图鉴）+ 副标题已删除；内容区顶部间距统一对齐 /chat 基准：页面 wrapper `py-6`（原 `py-8`），连通面板定高改 `lg:h-[calc(100vh-9rem)]`（与问答页一致，原图鉴为 `100vh-4rem`），PlantCatalog 根 `pb-4`（原 `pb-16`）。图鉴计数信息未丢：移入排序行左侧「共 N 种（全部 M 种）」；design 页任务计数改右对齐小字。**勿恢复这些页的 h1**；侧栏菜单已承载页面标识。（注：此条 `py-6`/`calc(100vh-9rem)` 已被迭代 40 的 `-my-3`/`calc(100vh-40px)` 垂直对齐约定取代，见「左侧导航」条。）
- **已实测（生产构建）**：/、/catalog、/learning、/admin 状态码正常；登录态侧栏渲染用户名；`/api/feedback` 入库成功（feedbacks 表可查）；深色变量/`.dark .student-vivid`/`drawer-in` 均进产物 CSS；侧栏与 /chat 共 3 个拖动分隔条进 SSR、`margin-left:var(--sidebar-w)` 编译正确；三页头部移除后 /catalog、/design 渲染产物 `h1` 计数=0。
- **清理**：临时学生 9999990003 已删（profiles 级联=0，各表孤儿=0），测试反馈行已删。

## 二期迭代 44 · 案例背景页左右双栏定高布局

教师点名：`/design/[taskId]` 案例背景页（`DesignCase` 的 `phase==="background"` 分支）从 880px 单栏卡（素材在上、信息在下、整页滚动）改为左右结构，整页不滚动、各板块内部滚动。
- **布局**：wrapper `student-vivid animate-bg-in -my-3 w-full`（同 /catalog、/chat 垂直对齐约定）+ 双栏行 `lg:h-[var(--size-panel-vh)] lg:overflow-hidden`（**行 div 不带 flex-1**，迭代 39 坑同样适用）。左栏素材卡 `lg:w-[var(--size-case-media-w)]`（新令牌 55%，`bg-surface shadow-card overflow-hidden`）；右栏信息卡 `lg:flex-1 lg:min-w-0`（`bg-primary-container/50`），内部 = 滚动区（`lg:flex-1 lg:min-h-0 overflow-y-auto`：返回链接→难度/课时/阶段数/tags chips→名称+副标题→CaseIntro 播报卡→任务要求列表）+ 吸底操作条（`shrink-0 border-t-neo`：开始/继续设计按钮 + 进度）。`<lg` 双栏堆叠、页面自然滚动（素材 `h-64 md:h-80`）。
- **`CaseMediaGallery` 新增 `variant="fill"`**（CaseMedia.tsx）：根 `lg:flex lg:h-full lg:flex-col`，主视图 `lg:h-auto lg:min-h-0 lg:flex-1` 撑满，缩略图条 `shrink-0 px-3 pb-3` 沉底；移动端退回 `h-64 md:h-80` 定高。hero/panel 变体未动（工作台 `CasePanel` 仍用 panel）。
- **「任务要求」区块已应教师要求删除**（同迭代内）：右栏不再渲染 `task.requirements`；`PAGE_COPY.designCase.requirementsTitle` 一并删除。数据字段本身保留在 task_def，勿再恢复渲染。
- **`cardRef`（FLIP 起点）从单卡移到双栏行容器**——「开始设计」进工作台的缩放动画取双栏整体包围盒。
- **文案**：`PAGE_COPY.designCase`（backToList/hoursPrefix/hoursSuffix/stagesSuffix/requirementsTitle/startDesign/continueDesign/progressPrefix）；`--size-case-media-w` 在 globals.css 布局比例区。
- **已验证（生产构建）**：页面 200；产物 CSS 含 `--size-case-media-w:55%`、`lg\:w-\[var(--size-case-media-w)\]`、`border-t-neo`、`lg:h-[var(--size-panel-vh)]`；渲染 HTML 含左右栏类名、任务要求条目、3D 模型（该任务素材=.glb，ModelViewer 渲染）；脱敏抽查 `"referenceSolution"/"mustMention"/"positioningRule"/"correct"` 带引号序列化全 0（无引号命中为客户端代码标识符，正常）。
- **勿回退**旧的 `max-w-measure` 单栏卡布局。

## 二期迭代 45 · S1 场地顾问语音通话模式（引擎已于迭代 46 换云端，本节保留交互约定）

- **需求**（教师）：S1 场地顾问由「文字输入 + 语音输入按钮」对话改为**纯语音通话**（接打电话体感），移除文字输入，学生直接开口与 AI 对话。
- **通话引擎 `src/components/design/use-voice-call.ts`（新增）**：半双工状态机 `idle→speaking(问候)→listening→thinking→speaking→…`。
  - 识别：SpeechRecognition `continuous + interimResults`，final 结果累积，**停顿 1200ms 判定一句话说完**自动发送（`finalizeUtterance`）；Chrome 连续识别间歇性 onend 时处于聆听态自动 `rec.start()` 重连。
  - 播报：组件把 SSE 流按 `。！？!?；;换行` 分句喂 `speakSentence()`，stripMd 后进 speechSynthesis 队列（zh-CN），`markStreamEnd()` 后队列排空 → **自动重新开麦**。
  - **⚠️ 回声防护**：AI 播报/思考期间麦克风恒关闭，播报完才开麦——勿改成边播边听，TTS 会被识别成学生发言形成死循环。
  - 挂断：停识别 + `speechSynthesis.cancel()` + 计时清零；流未读完的回复继续写入 messages（记录完整），`speakSentence` 在 idle 态自动丢弃。
- **StageDiagnosis 改造**：删除文字输入框/发送按钮/旧录音按钮（`input`/`toggleMic`/`micSupported`/`Send` 图标）；`send()` 改 `ask(text)`（SSE 逻辑不变 + 分句播报 + finally `markStreamEnd`，错误提示也播报）。空闲态 = 消息列表 + 底部「接通顾问语音」大按钮；通话中 = 通话屏（头像呼吸环：聆听绿 `bg-success`/播报蓝 `bg-water`、阶段文案、计时、实时字幕）+ 静音/红色挂断按钮。首次接通问候语写入 messages（随 localStorage 持久化），再次接通问候只播不写。**打分链路零改动**（/api/design/chat + newHits + askedCount 原样）。
- **边界**：半双工轮流，不支持抢话/打断；需 Chrome/Edge + 联网识别；不支持的浏览器接通按钮替换为警示文案；无 TTS 时字幕兜底、流程照常推进。
- **验证口径**：构建/页面渲染/未登录 401 守卫已验；真实麦克风+TTS 通话链路需真机浏览器确认（沙箱无音频设备）。

## 二期迭代 46 · 语音通话上云（自然音色 + 云端识别）+ 每日通话配额

- **需求**（教师）：① 浏览器 speechSynthesis 音色太死板，要拟人有语气（"像豆包一样"）；② Web Speech 识别听不到学生说话、不灵敏（Chrome 识别依赖境外服务，国内不稳定）；③ 担心云端语音成本随通话次数失控 → **加每生每日通话配额，超额降级文字/浏览器语音输入**。
- **技术**：`coze-coding-dev-sdk` TTSClient/ASRClient（技能 /skills/public/prod/audio）。TTS 音色 `zh_female_vv_uranus_bigtts`（薇薇，常量在 tts route 顶部，换音色改一处）。
- **新增 3 路由（均登录守卫）**：
  - `/api/voice/tts` POST {text ≤500 字} → 服务端合成并拉回音频，直接返 `audio/mpeg` 字节。
  - `/api/voice/asr` POST {audio: base64（16kHz 单声道 WAV，≤8MB base64）} → {text}。
  - `/api/voice/session` POST → 配额闸门：`voice_usage(user_id, usage_date, call_count)` 表（PK 复合、RLS 开启无策略仅 service role 可写），北京时间当日计数，`QUOTA_CALLS_PER_DAY = 5`（route 常量）；非 cloud 模式不计数直接放行。先查后写（select→update/insert），双 tab 竞态可接受。
- **use-voice-call.ts 重写为云端引擎**（迭代 45 的 Web Speech 引擎已废弃，`interim` 字段移除）：
  - 播报：分句 → `/api/voice/tts` 逐句合成 **并预取下一句**（播 i 时取 i+1），blob URL + `<audio>` 顺序播放，`onended` 链排空 + `markStreamEnd` → 自动开麦。合成失败的句子跳过不卡队列。
  - **降延迟两板斧（勿回退）**：① 接通即 `primeFiller()` 预合成垫音「嗯，我想一想。」，进入 `thinking` 且队列空时立即播放填补静默（`fillerUrlRef` 复用、挂断才 revoke）；② StageDiagnosis 流式分句除句号问号外，缓冲 ≥24 字遇逗号/顿号也先切出送 TTS，让首句更早开口。
  - 识别：`getUserMedia` 常驻一次通话 + `AnalyserNode` **能量 VAD**（前 600ms 校准环境底噪，阈值 = max(底噪×2.2, 0.012)；出声 300ms 起判说话，**静音 900ms 判一句话说完**，单句 30s 上限）→ `MediaRecorder(webm/opus)` 录音 → `decodeAudioData` → 16kHz WAV → base64 → ASR。识别为空 → 继续聆听不发送。
  - **⚠️ 回声防护不变**：播报/思考期间录音器恒关闭。挂断释放麦克风流（隐私灯灭）、abort 挂起合成请求。
  - 单通 15 分钟上限（`MAX_CALL_SECONDS`）自动挂断并回 `onAutoEnd`（组件写入提示消息）。
- **StageDiagnosis**：`answerCall` 先打 session 闸门——超额 → `quotaBlocked` 态，底部降级为**文字输入 + 浏览器语音输入（useVoiceInput 回填）+ 发送**（`ask(text, false)` 不走 TTS/不 markStreamEnd）；麦克风权限被拒 → 提示文案。`ask(text, speak)` 双模式共用。
- **验证**：`scripts/voice_smoke_test.ts`（注册 @test.local 学生→登录→6 连发验配额 5 允 1 拒→TTS 返音频→TTS 音频回传 ASR 原文识别→删账号+voice_usage/mastery/quiz_attempts 孤儿）已全绿；`pnpm tsx scripts/voice_smoke_test.ts` 可重跑。
- **成本口径**（对教师）：LLM Token 零新增（问答链路与原文字模式等量）；新增仅 TTS 按字数 + ASR 按时长，单次通话约几千字 + 2~5 分钟；配额护栏 = 每生每日 5 通 + 单通 15 分钟 + 请求载荷上限。

## 二期迭代 47 · 植景设计六阶段「演示答案」（指定演示账号一键填充）

- **需求**：每个阶段加演示答案，方便演示人员快速展示。教师端走不了学生设计流程，故入口在**学生端**，且**仅教师指定学号 `20232001027`（学生"秋千"）可见可用**（常量 `DEMO_STUDENT_NO` 在 design-demo-answers.ts；DesignCase 内联同值常量，**勿从注册表模块 import 进客户端**，否则整套答案被打进学生端 JS 泄漏——已验证注册表内容不在任何客户端 chunk）。
- **机制**：`src/lib/design-demo-answers.ts` 代码级注册表（键 `task-chuangzhi-01`，S1–S6 全量 payload+meta，内容取自 referenceSolution：五分区 A 一米菜园/B 诗经花园/C 朴门花园/D 公共活动区/E 雨水收集堆肥区、29 种植物、30 处落位、五维自评 90 分）。`POST /api/design/stage/apply-demo` {taskId, stageKey}：getSessionUser 校验 `studentNo === DEMO_STUDENT_NO`（其他学生/教师均 403）→ `saveStageRecord(run.id, stageKey, {payload, meta}, 演示评阅, 100, passScore)` 写入并解锁下一阶段；S6 额外 patchRun total_score=100 + status=completed。
- **入口**：DesignCase 工作台头部「演示答案」按钮（Presentation 图标，仅该学号学生渲染）。应用成功后拉 `/api/design/progress` 回写 run + `demoNonce++` 使 `<div key={stage:nonce}>` 重挂载，各阶段组件从 stage_payloads/stage_reviews 回显填充结果与评阅卡。
- **⚠️ stage_payloads 嵌套形状**：saveStageRecord 统一存 `{ payload, meta }`，组件回显必须先解包 `.payload`（`rec?.payload ?? rec`）。本轮修复了 StageZoning 的平读（S3 回显空白）；StagePositioning 同病已修（S2）。StagePlanting/StageLayout/StageEvaluation 已是嵌套读法。
- **分区几何**：底图 site-plan-blank.webp（1024×2048 竖向狭长地块，像素分析得出轮廓：左上 (447,10)、右上 (522,26)、右下 (522,1878)、左下 (218,1898)，左缘斜边）。画布坐标系 = 像素 + (643,131)（canvasGeom imgX/imgY，S=2310）。五分区按面积比例纵向切片，落位点已逐一验证在各自多边形内。换底图/画布时需重算注册表坐标。
- **验证**：`scripts/demo_answer_smoke.ts`（直建临时演示学生[学号=20232001027]+普通学生→登录→匿名 401→非演示账号 403→S1–S6 逐阶段 apply 验解锁→S6 收尾验 completed/total_score/分区数/落位数→清理两用户）已全绿，可重跑。profiles.student_no 无唯一约束，临时同号学生不与真实账号冲突。

## 下一步（后续迭代）

1. ~~第 10 轮 · 图鉴内嵌问答栏~~（已在迭代 34 完成：复用 `mode:"embedded"` 引擎 + 外壳常驻/引擎懒加载 + 展开延续会话 + source=catalog 分组 + 刷新还原）。
2. ~~植景设计 S6 阶段表单与评阅~~（已在迭代 30 完成：五维自评 + AI 评估报告 + 定稿，最终成绩回流学生学习管理与教师学情）。
3. ~~AI 学情分析对话框（B 组）~~（已在迭代 33 完成：四段式安全架构 + 8 指标白名单 + 图表/依据回显 + 植景管家跳转契约）。
4. 教师手动调整掌握状态（mastery.manual）的完整 UI。
5. 云端模式图片上传后的 URL 回填编辑流程打磨。
6. ~~推荐面板内容持久化~~（已在迭代 14 完成"存得住+可还原"）；第 10 轮图鉴内嵌问答启用 `source:'catalog'` 分组；AI 问答上下文长度与快捷提问扩展；学情看板通知等增强。
7. 安全加固后续批（评审遗留）：P1-3 拼接过滤、P1-4 CSRF Origin 校验、P1-5 初始密码策略、依赖审计（pnpm audit）、design/review 与 design/chat 两个 AI 路由限流、全部 P2 项。
