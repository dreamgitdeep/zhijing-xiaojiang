# 植景小匠 · 开发提示词（直接粘给扣子编程）

> 使用方式：把本文件全文复制到扣子编程对话框，并把 `植景小匠/` 整个文件夹作为项目上传（内含 `public/data/plants.json` 种子数据、`public/images/plants/` 图片、`supabase/schema.sql` 建表脚本）。**不需要你再生成或爬取任何植物数据。**

---

## 0. 一句话目标

为上海农林职业学院《植物造景》课程开发教学网页应用 **植景小匠**，支持学生账号学习、进度云端留存、教师后台管理数据与查看学情。本期交付：**账号体系 + 植物图鉴 + 练习 + AI 讲解 + 智能问答 + 教师管理后台**。二期再接「植景设计」专题任务（本次只留导航入口与数据接口，不实现）。

---

## 1. 范围界定（严格遵守）

**本期必须交付**
1. **登录 / 注册**：邮箱+密码，学生 / 教师两种角色；未登录可浏览图鉴，练习与 AI 讲解需登录（或提示登录）
2. **云端数据**：Supabase（Auth + Postgres + Storage），学习进度、练习记录、AI 对话跨设备留存
3. **植物图鉴**：筛选栏 + 卡片网格 + 详情弹窗 + 掌握状态
4. **练习**：每株 6 题（数据已内置），自动判分 + 解析 + 掌握判定
5. **AI 讲解 / 智能问答**：跳转问答页并预填问题，流式回答；无模型 Key 时本地兜底
6. **教师管理后台 `/admin`**：植物数据录入与编辑、图片上传、批量导入导出、**学生学情看板**

**本期不做**
- 植景设计任务、场地平面图、拖拽、SVG 渲染、双轨评分（二期，只留 `/design` 占位页）
- 第三方社交登录、找回密码之外的复杂账号流程

---

## 2. 技术栈与工程约束

- **Next.js（App Router）+ React + TypeScript + Tailwind CSS**
- **Supabase**：`@supabase/supabase-js` 做 Auth(邮箱密码)、Postgres 读写、Storage 存图片；全部在前端调用，配好 RLS 即可，无需自建后端服务
- 环境变量写入 `.env.local`；**服务角色 Key 只用于脚本，不得出现在前端**
- **双模式开关** `NEXT_PUBLIC_DATA_MODE=cloud|local`：
  - `cloud`（默认）→ 数据读 Supabase `plants` 表，进度写 Supabase
  - `local` → 读 `public/data/plants.json`，进度写 localStorage（便于无网络演示）
  - 两种模式共用同一套数据访问层 `lib/repo.ts`，前端组件不感知差异
- 全站简体中文，桌面 + 移动端自适应；关键逻辑写中文注释

---

## 3. 已提供的数据资产（**禁止修改、禁止重新生成**）

```
植景小匠/
├─ public/data/plants.json       # 124 种植物 + 744 道练习题 + filters 元数据（种子数据）
├─ public/images/plants/         # 248 张主图/特写 + 124 张缩略图（WebP，24MB）
├─ supabase/schema.sql           # 建表 + RLS + 存储桶，整段粘到 Supabase SQL Editor 执行
├─ scripts/build_plants.py       # 从课程组 Excel 重建 JSON 与图片（改数据改这里，不要手改 JSON）
└─ scripts/seed_supabase.py      # 可选：把 plants.json 批量导入 Supabase
```

数据来源：课程组《社区花园植物库100种》+《有毒有刺植物警示名录》（24 种），两库零重叠，合计 **124 种**（乔木 12 / 灌木 31 / 草本 67 / 藤本 9 / 竹类 5）。

### 3.1 植物对象字段字典（`plants.json → plants[]`，入库后原样存进 `plants.data`）

| 字段 | 类型 | 说明 | 用途 |
|---|---|---|---|
| `id` | string | `p001`…`p124` | 主键、路由、图片命名 |
| `name` / `latin` / `alias[]` | string / string[] | 中文名 / 拉丁学名 / 别名 | 卡片标题、搜索 |
| `category` | string | 设计分类（14 类） | **筛选维度①** |
| `layer` | `tree\|shrub\|herb\|vine\|bamboo` | 层级 | **筛选维度②** + 二期 SVG 符号 |
| `taxon` / `lifeForm` | string | 科属（仅警示植物）/ 生活型 | 详情 |
| `functionTags[]` | string[] | 原始功能标签 | 详情 chips |
| `tagGroups[]` | string[] | 归一化功能分组（10 类：观赏/芳香/食用/药用/蜜源食源/生态防护/科普互动/垂直绿化/耐阴地被/水生湿生） | **筛选维度③** |
| `regionTags[]` | string[] | 适生区 | 详情 + 可选筛选 |
| `light` | `{text, need, shadeTolerant, sunTolerant}` | 光照（need: `sun\|sun_to_semi\|semi`） | 详情 + 二期评分 |
| `water` | `{text, need, avoidWaterlog}` | 水分（`dry\|medium\|moist\|wet`） | 同上 |
| `soil` | `{text, ph, drainage, tolerant}` | 土壤（ph: `acid\|acid_to_neutral\|neutral\|alkaline\|any`） | 同上 |
| `hardiness` | `{text, minTempC, zoneMin, zoneMax, evergreenSouthOnly}` | 耐寒性与适生区 | 同上 |
| `height` / `canopy` | `{text,min,max}` / `{min,max,estimated}` | 株高（米）/ 冠幅（推算值） | 二期间距与图例比例 |
| `ornamentalPart` / `color` | string | 观赏部位 / 花色叶色果色 | 详情 |
| `phenology` | `{flowerMonths[], fruitMonths[], text, evergreen, deciduous, autumnColor, seasonInterest{spring,summer,autumn,winter}, peakSeason}` | 物候与季相 | **四季季相条** + 二期季相评分 |
| `usage[]` | string[] | 配置方式 | 详情 |
| `region` / `notes` / `source` | string | 适用地区 / 应用与安全要点 / 资料来源（教材对应依据） | 详情 |
| `images` | `{full, close, thumb}` | 图片路径 | 卡片与详情 |
| `isWarning` | boolean | 是否有毒有刺警示植物（24 种） | **筛选维度④** + 警示徽章 |
| `warning` | object \| null | `{riskType, riskLevel, riskPart, symptom, consequence, identify, teachUse, banReason, restriction}`；restriction: `forbid`（禁植：夹竹桃、水仙）/ `caution`（限制使用） | 详情警示区块 |
| `safeForChildren` | boolean | 可用于儿童活动区周边 | 详情 + 筛选 |
| `quiz[]` | 6 题 | `{q, dimension, options[4], answerIndex, explain}` | 练习 |

顶层元数据 `filters`：`categories`(14) / `layers`(5，含中文 label) / `tagGroups`(10) / `regions` / `safety`。**筛选芯片用这些数组渲染，不要硬编码。**

> 应用面向植物造景，卡片主标题用 `name`（中文名）；若教师坚持"药材名称"字样，只改标签文案，不改字段。

---

## 4. 数据层设计（Supabase）

### 4.1 建表
直接执行 `supabase/schema.sql`，包含 5 张表 + RLS + 存储桶 + 注册自动建档触发器：

| 表 | 作用 | 关键字段 |
|---|---|---|
| `profiles` | 用户档案 | `id`(→auth.users)、`role`(`student`/`teacher`)、`name`、`student_no`、`class_name` |
| `plants` | 植物库（权威，教师可改） | `id`、`name`、`latin`、`category`、`layer`、`is_warning`、`restriction`、`data jsonb`（完整对象）、`sort_order` |
| `mastery` | 掌握状态 | `user_id`+`plant_id` 复合主键、`mastered`、`best_score`、`attempts`、`manual` |
| `quiz_attempts` | 每次练习记录 | `user_id`、`plant_id`、`score`、`total`、`answers jsonb`、`created_at` |
| `chat_messages` | AI 对话 | `user_id`、`plant_id`、`role`、`content` |

存储桶 `plant-images`（公开读，教师写）。

### 4.2 权限（已在 SQL 中配好，前端不要绕过）
- `plants`：所有人可读；**仅教师**可增改删
- `mastery` / `quiz_attempts` / `chat_messages`：本人可读写；教师只读（学情看板）
- `profiles`：本人读写；教师可读全部

### 4.3 初始化
教师后台「批量导入」上传 `public/data/plants.json` 逐条 upsert（推荐）；或 `python scripts/seed_supabase.py`。

### 4.4 同步策略（学生端）
- 未登录：进度写 localStorage，正常可用
- 登录时：把本地进度与云端 `mastery` **按 `best_score` 取大值合并**后回写云端，并清空本地残留
- 云端不可用时自动降级为本地模式，顶部提示「离线模式，进度仅保存在本机」

---

## 5. 目录结构建议

```
app/
  layout.tsx              导航 + AuthProvider + 数据模式 Provider
  page.tsx                植物图鉴
  login/page.tsx          登录 / 注册（切换 Tab）
  chat/page.tsx           智能问答
  design/page.tsx         二期占位「植景设计 敬请期待」
  admin/layout.tsx        教师守卫（role≠teacher 跳转首页）
  admin/page.tsx          后台首页：概览
  admin/plants/page.tsx   植物数据管理（列表 / 编辑 / 新增 / 删除 / 导入导出）
  admin/students/page.tsx 学情看板
  api/chat/route.ts       大模型代理（有 Key 走模型，无 Key 走兜底）
components/
  AuthForm.tsx  FilterBar.tsx  PlantCard.tsx  PlantDetailModal.tsx
  QuizModal.tsx  SeasonBar.tsx  WarningBadge.tsx  MasteryBadge.tsx  ProgressBar.tsx
  admin/PlantEditor.tsx  admin/ImportPanel.tsx  admin/StatsTable.tsx
lib/
  supabase.ts  types.ts  repo.ts（统一数据访问：cloud/local 双实现）  auth.ts  quiz.ts  storage.ts
public/data/plants.json
public/images/plants/
supabase/schema.sql
```

---

## 6. 页面与交互规格

### 6.1 全局导航
- 左：Logo「植景小匠」+ 副标题「上海农林职业学院 · 植物造景」
- 中：植物图鉴 / 植景设计（占位）/ 智能问答；**教师登录后额外出现「管理后台」**
- 右：学习进度 `已掌握 12 / 124`（展开显示 已掌握/未掌握/未练习，提供「重置进度」二次确认）+ 用户头像菜单（姓名·班级 / 退出登录）
- 未登录时右侧显示「登录 / 注册」

### 6.2 登录 / 注册 `/login`
- Tab 切换，邮箱 + 密码（≥6 位）
- **学生注册**：姓名、学号、班级（写入 `profiles`）
- **教师注册**：姓名 + 教师邀请码（教师邀请码做成环境变量 `NEXT_PUBLIC_TEACHER_CODE`，输入匹配才置 `role='teacher'`；不匹配一律注册为学生）
- 邮箱未验证时允许登录（Supabase 可关闭邮箱验证）；错误提示用中文（邮箱已注册、密码错误…）
- 登录后回跳来源页

### 6.3 植物图鉴页
顶部筛选区（吸顶）：
1. **搜索**：匹配 `name` / `latin` / `alias` / `functionTags`
2. **设计分类 chips**：全部 + 14 项（单选）
3. **层级 chips**：全部 + 乔木/灌木/草本/藤本/竹类（单选）
4. **功能分组 chips**：全部 + 10 组（**多选**）
5. **掌握状态**：全部 / 未掌握 / 已掌握（未登录时置灰提示"登录后可用"）
6. **安全筛选**：全部 / 仅警示植物 / 仅儿童区可用 / 仅禁植清单
7. 右侧：结果计数 + 排序（默认 / 名称 / 未掌握优先）

网格 4 / 3 / 2 列响应式，图片懒加载，首屏骨架屏，空状态带清空筛选按钮。

### 6.4 植物卡片
- 缩略图（4:3，`images.thumb`）
- 右上角绿色「已掌握」徽章（未掌握不显示）
- 警示植物：图片左上角徽章——红色「禁植」（`restriction==='forbid'`）/ 橙色「慎用」（`caution`），卡片描边同色
- 中文名（18px 加粗）+ 拉丁学名（12px 斜体灰）
- 标签行最多 3 个 chip：`category` + `layer` 中文 + 首个 `tagGroups`，超出 `+n`
- 底部：**开始练习此植物**（已掌握显示"再练一次"）/ **AI 讲解**
- 整卡点击开详情（按钮 `stopPropagation`）

### 6.5 详情弹窗
左右分栏（移动端全屏）：
- 图：`images.full`，下方小图切换 `full` ↔ `close`
- 信息分组（**字段名与内容用数据原文，不要改写**）：
  1. 基础信息：中文名 / 拉丁学名 / 别名 / 科属 / 生活型 / 株高 / 冠幅（标注"推算值"）
  2. 生态习性：光照 / 水分 / 土壤 / 耐寒性与适生区（各一行，显示 `text` 原文）
  3. 观赏特性：观赏部位 / 花色叶色果色 / 花期果期 + **四季季相条**（`phenology.seasonInterest`，0–4 四段条形，标注「最佳观赏季：春」）
  4. 应用配置：配置方式 chips / 功能标签 chips / 适用地区 / 应用与安全要点全文
  5. **安全警示**（`isWarning` 时红/橙区块）：风险类型、等级、危险部位、毒性或伤害表现、误食接触后果、识别要点、社区禁用原因、教学用途、处置建议
  6. 资料来源（小字灰，体现教材对应）
- 关闭：ESC / 遮罩 / 按钮；底部固定栏：开始练习 / AI 讲解 / 上一种·下一种（在当前筛选结果内切换）

### 6.6 练习
- 读 `quiz[]`（6 题 × 4 选项），**单题模式**，进度 `3/6` + 维度标签
- 选中即锁定：正确绿色 / 错误红色并标出正确项，**两种都显示 `explain` 解析**
- 结果页：得分、逐题回顾、重做错题 / 再来一次 / 去问 AI
- **掌握判定**：答对 ≥5 题（≥83%）→ `mastered=true`；每次提交写 `quiz_attempts`，更新 `mastery.best_score` 与 `attempts`
- 允许手动切换"已掌握 / 取消掌握"（`manual=true`）

### 6.7 AI 讲解 → 智能问答
跳 `/chat?plantId=p001&auto=1`，**预填但不自动发送**，顶部提示「已为你生成问题，点击发送即可获得讲解」：

```
请结合《植物造景》课程，系统讲解【{name}】（{latin}）：
1) 形态特征与生活型；
2) 生态习性：光照、水分、土壤、耐寒性与适生区；
3) 观赏特性：观赏部位、花色叶色果色、花期果期与四季季相；
4) 在社区花园中的配置方式与典型应用场景；
5) 安全与维护要点。
请给出条理清晰的要点提纲，并说明它与易混淆种类的区别。
```
`isWarning` 时第 5 条后追加：`并说明其毒性/致敏/带刺风险、危险部位、误食或接触后果，以及在社区花园中的处置原则。`

`/chat` 页：对话区（流式打字机）+ 右侧「当前讲解植物」小卡；输入框（Enter 发送 / Shift+Enter 换行）/ 停止生成；快捷提问 chips；对话写入 `chat_messages`；无 Key 时用 `plants.json` 字段拼装结构化兜底答案（末尾注明"本答案依据课程植物库资料生成"）。

### 6.8 教师管理后台 `/admin`

**A. 植物数据管理**
- 表格：缩略图 / 名称 / 分类 / 层级 / 警示 / 题量 / 更新时间；搜索 + 分类筛选 + 分页（50/页）
- 编辑抽屉：所有字段可编辑（生态习性四项用文本框、`phenology` 提供月份多选、警示区块独立分组）
- 新增植物（自动生成 `p125`…）、删除（二次确认）
- **图片上传**：全貌 / 特写传至 `plant-images` 桶，命名 `{id}_full.webp` / `{id}_close.webp`，自动生成缩略图存 `thumbs/{id}.webp`
- **批量导入**：上传 `plants.json` 或课程组 Excel → 预览差异（新增 / 更新 / 跳过）→ 确认后 upsert
- **导出**：导出当前库为 `plants.json`（与种子数据结构一致，便于回灌脚本）
- 修改后写入 `updated_at`、`updated_by`

**B. 学情看板**
- 概览卡：学生总数、活跃人数（7 日）、平均掌握数、练习总次数
- 学生表：姓名 / 学号 / 班级 / 已掌握数 / 练习次数 / 平均正确率 / 最近活跃；支持按班级筛选、按掌握数排序、导出 CSV
- 点击学生 → 明细：逐植物的掌握状态与最高分、最近 10 次练习记录
- 难点分析：按植物统计正确率（升序），标出正确率 <60% 的植物，供课堂讲评
- 班级维度：各班平均掌握数对比条形图

---

## 7. AI 接口约定

- `POST /api/chat`，body `{ messages, plantId? }`，SSE 流式返回纯文本
- 系统提示词固定：
  > 你是《植物造景》课程的植物学助教，面向高职院校学生。只依据课程植物库提供的资料回答；资料未涉及的，明确说明"课程资料中未涉及"，不要编造。回答用中文、分条结构、每条不超过 3 行；结尾给出 2 个延伸思考问题。不得替学生做设计决策（如"这里应该种什么"），应引导其依据已获得的场地信息自行判断。
- 上下文只注入**当前植物**的完整字段，不要把 124 种全塞进 prompt
- 模型 Key 从环境变量读；未配置走兜底

---

## 8. 视觉规范

- 主色植物绿 `#2F7A4F`，浅底 `#F7FAF8`，卡片纯白 + `rounded-2xl` + 极浅阴影
- 语义色：掌握绿 `#2F7A4F`；禁植红 `#C0392B`；慎用橙 `#D97706`；信息蓝 `#2563EB`
- 中文字体栈（PingFang SC / Microsoft YaHei / Noto Sans SC），正文 14px，卡片标题 18px
- 圆角 12–16px，间距用 Tailwind 4 的倍数，hover 过渡 150ms
- 功能性图标用内联 SVG，不用 emoji

---

## 9. 二期接口预留（**只留位置，不实现**）

- `/design` 占位页「植景设计 · 敬请期待」
- 已预留评分所需字段：`layer`（乔灌草符号）、`canopy`（图例比例与间距）、`light/water/soil` 枚举 + `hardiness`（适地适树）、`phenology.seasonInterest`（季相）、`warning.restriction` + `safeForChildren`（儿童区安全）、`height`（空间层次）。**前端可展示，但不要生成任何评分逻辑。**
- 后续会提供社区造景任务的场地分区数据，届时扩展 `/design`

---

## 10. 验收清单（逐条自检，全部打勾再交付）

**图鉴与学习**
- [ ] 124 张卡片渲染正常，图片无 404
- [ ] 六个筛选维度任意组合生效，计数正确，可清空
- [ ] 24 种警示植物显示红/橙警示区块与徽章，夹竹桃、水仙标"禁植"
- [ ] 四季季相条按 `seasonInterest` 渲染并标注最佳观赏季
- [ ] 练习 6 题流程完整：判分、解析、结果页；≥5 题后卡片出现已掌握徽章
- [ ] AI 讲解跳转并预填（不自动发送）；无 Key 时兜底答案可用

**账号与数据**
- [ ] 学生注册写入姓名/学号/班级；教师邀请码正确则 `role=teacher`
- [ ] 未登录可浏览图鉴；练习/AI 提示登录
- [ ] 登录后本地进度与云端按最高分合并；退出再登录进度仍在
- [ ] 换浏览器/设备登录后进度一致（云端模式）
- [ ] 断网或 Supabase 未配置时降级为本地模式并提示

**教师后台**
- [ ] 非教师账号访问 `/admin` 被拦截
- [ ] 植物列表可搜索/筛选/分页；编辑保存后前端图鉴立即生效
- [ ] 图片上传成功并更新显示；缩略图自动生成
- [ ] 导入 `plants.json` 有差异预览并可 upsert；导出文件结构与种子一致
- [ ] 学情看板：学生掌握数、练习次数、正确率正确；可按班级筛选；正确率 <60% 植物可列出

**通用**
- [ ] 移动端 375px 布局正常（2 列卡片、筛选横向滚动、详情全屏、后台表格可横向滚动）
- [ ] 无控制台报错；首屏 3 秒内可交互；图片懒加载生效
- [ ] 未修改 `public/data/plants.json`、`public/images/`、`supabase/schema.sql` 的原始内容

---

## 11. 明确禁止

1. 不要修改或"优化" `public/data/plants.json`（数据由课程组审定；需要变更走后台编辑或改 Excel 后重跑脚本）
2. 不要把 `SUPABASE_SERVICE_ROLE_KEY` 或模型 Key 暴露到前端代码
3. 不要用中文文件名或中文路由
4. 不要让 AI 替学生做设计决策或给出"标准答案式"布局方案
5. 不要把 124 种植物全部塞进 AI 上下文
6. 不要绕过 RLS：教师写权限必须靠数据库策略保证，不能只在前端隐藏按钮
