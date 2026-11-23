# -*- coding: utf-8 -*-
"""把两份 Excel 植物库合并、规范化，输出前端可直接消费的 plants.json，并同步整理图片资源。"""
import json, os, re, shutil, glob, collections
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.dirname(ROOT)
OUT_DATA = os.path.join(ROOT, 'public', 'data', 'plants.json')
OUT_IMG = os.path.join(ROOT, 'public', 'images', 'plants')
OUT_THUMB = os.path.join(OUT_IMG, 'thumbs')

MAIN_XLSX = glob.glob(os.path.join(SRC, '**', '社区花园植物库100种.xlsx'), recursive=True)[0]
WARN_XLSX = glob.glob(os.path.join(SRC, '**', '有毒有刺植物警示名录.xlsx'), recursive=True)[0]
MAIN_IMG = glob.glob(os.path.join(SRC, '**', '植物图片'), recursive=True)
MAIN_IMG = [d for d in MAIN_IMG if '有毒' not in d][0]
WARN_IMG = [d for d in glob.glob(os.path.join(SRC, '**', '植物图片'), recursive=True) if '有毒' in d][0]

# ---------- 24 种警示植物待补字段（毒性表现 / 误食后果 / 识别要点 / 教学用途） ----------
WARN_EXTRA = {
    '夹竹桃': ('误食后恶心呕吐、心律紊乱、瞳孔散大，严重者心跳骤停；汁液接触皮肤红肿发炎，焚烧枝叶的烟雾亦可致中毒',
             '儿童误食1-2片叶即可致命，修剪时汁液入眼可致严重刺激，须立即就医',
             '叶3-4枚轮生、革质线状披针形；花漏斗状5裂，红/粉/白色；折断枝叶流出白色乳汁',
             '作为社区花园“必须清除植物”的典型案例，训练学生识别剧毒植物并建立禁植清单'),
    '南天竹': ('误食果实后恶心呕吐、痉挛、昏迷，严重者呼吸麻痹',
             '红果艳丽且经冬不落，对儿童吸引力极强，误食多颗可致中枢神经抑制',
             '二三回羽状复叶，秋冬叶色转红；圆锥花序白花；鲜红球形小果成串经冬不落',
             '讲解“观赏价值高但风险高”植物的取舍原则：宜远观、宜高处、忌儿童动线'),
    '常春藤': ('误食叶果致口腔灼痛、恶心呕吐、腹泻；汁液接触皮肤红肿瘙痒',
             '常攀援于墙面花架，儿童攀爬摘叶风险高，过敏体质接触即发作',
             '常绿木质藤本，叶三角状卵形或掌状裂，具气生根攀附，伞形花序淡绿白色',
             '垂直绿化与儿童安全冲突的典型案例，讨论替代藤本（扶芳藤、络石等）'),
    '杜鹃': ('误食花叶致流涎、恶心呕吐、血压下降、呼吸困难；花蜜所制蜜亦可致“醉蜜”中毒',
           '花色艳丽易吸引儿童采食，蜜源亦有风险',
           '落叶或半常绿灌木，叶两面被糙伏毛，漏斗形花冠4-5月盛放，蒴果卵形',
           '酸性土指示花卉，讲解土壤pH与适地适树，同时强调儿童活动区禁用'),
    '水仙': ('误食鳞茎后剧烈呕吐、腹痛腹泻、心律失常，量大可致呼吸衰竭',
           '鳞茎外形酷似洋葱大蒜，极易被误作食材，是冬春社区最高风险球根',
           '鳞茎卵圆形、外包棕褐色膜质皮；叶扁平带状粉绿；花被片6枚白色，副花冠黄色杯状',
           '球根花卉与水培景观安全案例，训练识别“酷似食材”的有毒器官'),
    '玉簪': ('全株含皂苷类，误食致口腔刺痛、呕吐腹泻；汁液接触可致皮肤过敏',
           '花洁白芳香且房前屋后常见，儿童采摘花朵风险高',
           '多年生宿根草本，叶基生成丛、宽卵形具长柄、弧形脉；总状花序白花芳香',
           '经典耐阴地被，讲林下配置，同时强调全株有毒、不宜布置儿童活动区'),
    '紫藤': ('误食种子或豆荚后剧烈呕吐、腹痛腹泻、头晕，严重者脱水休克',
           '秋季豆荚悬挂易被儿童打开取食，花架下活动区风险集中',
           '落叶木质大藤本，奇数羽状复叶；下垂总状花序紫白色；荚果长条形被绒毛',
           '花架廊架绿化典型案例，讨论“可远观不可近玩”的种植距离控制'),
    '绣球': ('全株含氰苷，误食花叶致恶心呕吐、腹痛，量大可致呼吸困难',
           '花球巨大色彩丰富，儿童采摘把玩风险高，花色随pH变化易被误认为可食',
           '落叶灌木，叶对生倒卵形具粗齿；顶生伞房状聚伞花序呈球形；花色随土壤酸碱变蓝或粉',
           '土壤pH调色的经典素材，同时作为“高吸引力高危植物”管控案例'),
    '菖蒲': ('全株有毒、根茎毒性最大，误食致恶心呕吐、抽搐；汁液接触可致皮肤瘙痒',
           '水景边儿童可近距离接触，根茎与果实存在误食风险',
           '多年生挺水草本，根茎横走粗壮有香气；叶剑形二列基生；肉穗花序圆柱形黄绿色',
           '水景植物配置代表种，讨论水岸安全与可替代挺水植物'),
    '萱草': ('鲜花蕾含秋水仙碱类毒素，误食致恶心呕吐、腹痛腹泻、血尿',
           '鲜花与可食干黄花菜极易混淆，儿童误食风险极高',
           '多年生宿根草本，叶基生线形两列；花葶高大，漏斗形花橙黄，单朵仅开一日',
           '食用与观赏混淆的警示案例，讲社区可食地景的物种准入'),
    '郁金香': ('误食球根致恶心呕吐、腹痛；球根与花粉接触可引起接触性皮炎',
            '球根秋季种植期暴露地表，易被儿童挖掘误食',
            '球根花卉，鳞茎褐色膜质；叶3-5枚带状披针形被白粉；杯状花单生枝顶',
            '球根花坛与季相设计素材，讨论集中种植区的位置选择与儿童隔离'),
    '金边黄杨': ('误食果实种子致恶心呕吐、腹痛腹泻，量大可致心律异常',
             '常见绿篱、种植密度大，儿童采摘果实与误食机会多',
             '常绿灌木，叶对生椭圆形革质、叶缘金黄；聚伞花序小花绿白；蒴果近球形',
             '常见绿篱风险评估案例，讨论儿童活动区绿篱的替代配置'),
    '风信子': ('误食球根致恶心呕吐腹痛；鳞茎接触皮肤瘙痒，花粉致敏性强',
            '密植花坛气味浓郁，过敏体质儿童及居民易出现喷嚏、眼痒、皮疹',
            '球根花卉，鳞茎球形外皮紫蓝或白色；叶带状肉质；顶生总状花序密生钟状小花，香气浓烈',
            '芳香植物双面性案例，讨论密集芳香植物与过敏人群的距离控制'),
    '鸢尾': ('根茎毒性最强，误食致恶心呕吐、腹痛腹泻；汁液接触可致皮肤过敏',
           '根茎浅表粗壮，儿童挖掘玩土时易接触误食',
           '多年生宿根草本，叶剑形扁平两列互相套叠；花被片6枚，外轮垂瓣具鸡冠状附属物',
           '花境与湿生配置经典材料，讨论根茎类植物的安全隔离设计'),
    '凤仙花': ('有小毒，误食种子或茎叶致恶心呕吐、腹痛；汁液接触部分人群可致皮肤瘙痒',
            '果实成熟一触即弹，趣味性强易被儿童把玩；花可染指甲吸引儿童',
            '一年生草本，茎肉质多汁；叶互生披针形具锐齿；花单生或簇生叶腋、具距；蒴果纺锤形一触即裂',
            '低毒植物分级管理案例，讨论“有小毒”与“剧毒”的管控强度差异'),
    '益母草': ('有小毒，过量食用致乏力、汗出、血压下降；孕妇接触或误食可致流产',
            '常野生自生，易被居民误认为可食野菜采食',
            '一二年生草本，茎四棱形；叶对生、下部叶掌状3裂；轮伞花序淡紫红，萼具5刺尖',
            '野生自生植物风险评估案例，讲社区花园杂草管理与科普告知'),
    '月季': ('皮刺扎伤致皮肤破损出血，伤口易继发感染',
           '花丛旁儿童奔跑、跌倒时扎伤风险极高，修剪养护亦易伤手',
           '落叶或半常绿灌木，茎枝散生钩状皮刺；奇数羽状复叶；花单生或伞房状，重瓣多色、四季可开',
           '经典花灌木，讲有刺植物的位置控制与人流路径关系'),
    '枸杞': ('枝条棘刺扎伤皮肤、存在划伤眼睛风险；果实可食但采摘时易被刺伤',
           '红果对儿童吸引力强，自行采摘时扎伤风险高',
           '落叶灌木，枝条细长拱垂具棘刺；叶互生或簇生披针形；花紫色漏斗状；浆果长卵形红色',
           '可食与有刺并存案例，讨论果实诱人植物的安全采摘设计'),
    '树莓': ('茎枝皮刺和刺毛扎伤皮肤致划伤刺痛，部分人群出现刺毛性皮炎',
           '果实可食但采摘过程扎伤风险高，儿童自行采摘危险',
           '落叶半灌木，茎直立或拱形密生皮刺与腺毛；奇数羽状复叶；聚合果空心柔软',
           '可食地景热门物种，讨论采摘区安全管理与无刺品种选择'),
    '石榴': ('小枝先端棘刺扎伤致皮肤划伤；树皮根皮大量服用有毒',
           '枝条带刺，儿童穿行时易划伤面部与手臂',
           '落叶灌木或小乔木，小枝顶端常成棘刺；叶对生或簇生长椭圆形光亮；花橙红钟状；浆果球形厚皮多籽',
           '观果树种应用案例，讨论有刺果树的修剪整形与活动区距离'),
    '胡颓子': ('枝端硬刺划伤皮肤；果实可食但采摘时易被刺伤',
            '儿童奔跑靠近时划伤风险高，果实诱人增加接触',
            '常绿灌木，小枝褐色具棘刺；叶背密被银白色鳞片；花银白色下垂芳香；果椭圆形红色',
            '常绿有刺灌木案例，讨论儿童活动区周边绿篱的隔离与安全距离'),
    '醋栗': ('枝条棘刺与果面刺毛扎伤皮肤，引起刺痒不适',
           '果实诱人，儿童自行采摘时扎伤和皮肤刺激风险高',
           '落叶灌木，枝条具节刺；叶掌状3-5裂；花绿白色单生；浆果球形具刺毛',
           '浆果类有刺植物案例，讨论采摘园的品种选择与作业安全'),
    '凌霄': ('花粉量大易引起过敏性结膜炎、鼻痒喷嚏，过敏体质人群反应明显',
           '花架下儿童抬头看花时花粉易入眼，密植区域过敏风险叠加',
           '落叶木质藤本，借气生根攀附；奇数羽状复叶对生；顶生圆锥花序，花冠漏斗状钟形橙红色',
           '垂直绿化花架致敏风险评估案例，讨论花架位置与儿童视线关系'),
    '蒲苇': ('叶缘锋利锯齿可割伤皮肤，伤口细长易出血',
           '儿童奔跑穿越时面部与手臂割伤风险高，高大植株形成视线盲区',
           '多年生高大丛生草本，叶狭长线形、边缘具细密锐齿；圆锥花序大型羽毛状银白色',
           '观赏草应用案例，讨论观赏草与园路、活动场地的安全退距'),
}

RISK_LEVEL = {'全株剧毒': 'severe', '有毒': 'high', '有小毒': 'medium', '致敏': 'medium',
              '有刺': 'low', '物理伤害': 'low'}
FORBID = {'夹竹桃', '水仙'}  # 明确要求彻底清除/最高风险


def split_tags(s):
    if not s:
        return []
    return [x.strip() for x in re.split(r'[、,，/;；]', str(s)) if x.strip()]


def parse_height(text):
    """'2-5米' -> (2,5); '20-40厘米' -> (0.2,0.4); '茎长可达3-20米' -> (3,20)"""
    t = str(text or '')
    m = re.search(r'(\d+(?:\.\d+)?)\s*[-–~至]\s*(\d+(?:\.\d+)?)', t)
    unit_m = '厘米' in t or 'cm' in t
    if m:
        a, b = float(m.group(1)), float(m.group(2))
        if unit_m:
            a, b = a / 100, b / 100
        return round(a, 2), round(b, 2)
    m2 = re.search(r'(\d+(?:\.\d+)?)\s*(米|厘米)', t)
    if m2:
        v = float(m2.group(1))
        if m2.group(2) == '厘米':
            v /= 100
        return round(v * 0.6, 2), round(v, 2)
    return None, None


def parse_layer(category, life):
    s = f'{category}{life}'
    if '藤' in s or '攀援' in s:
        return 'vine'
    if '竹' in s:
        return 'bamboo'
    if '乔木' in s:
        return 'tree'
    if '灌木' in s or '绿篱' in s:
        return 'shrub'
    return 'herb'


CANOPY_FACTOR = {'tree': 0.65, 'shrub': 0.8, 'herb': 0.5, 'vine': 0.35, 'bamboo': 0.45}


def parse_light(text):
    t = str(text or '')
    shade_tol = any(k in t for k in ('耐阴', '半阴', '散射光', '耐半阴'))
    sun_need = any(k in t for k in ('喜光', '全日照', '阳光充足'))
    sun_avoid = any(k in t for k in ('忌强光', '忌烈日', '忌暴晒', '忌西晒'))
    if sun_need and not shade_tol:
        need = 'sun'
    elif sun_need and shade_tol:
        need = 'sun_to_semi'
    elif shade_tol:
        need = 'semi'
    else:
        need = 'sun'
    return {'text': t, 'need': need, 'shadeTolerant': shade_tol, 'sunTolerant': not sun_avoid}


def parse_water(text):
    t = str(text or '')
    if any(k in t for k in ('水生', '湿生', '喜水湿', '水培')):
        lv = 'wet'
    elif '喜湿润' in t or '不耐旱' in t:
        lv = 'moist'
    elif '耐旱' in t and '不耐旱' not in t:
        lv = 'dry'
    else:
        lv = 'medium'
    return {'text': t, 'need': lv,
            'avoidWaterlog': any(k in t for k in ('忌积水', '不耐积水', '不耐水湿', '忌水涝'))}


def parse_soil(text):
    t = str(text or '')
    if '酸性' in t and '中性' in t:
        ph = 'acid_to_neutral'
    elif '酸性' in t:
        ph = 'acid'
    elif '碱性' in t or '盐碱' in t:
        ph = 'alkaline'
    elif '中性' in t:
        ph = 'neutral'
    else:
        ph = 'any'
    return {'text': t, 'ph': ph,
            'drainage': 'well' if '排水良好' in t else ('tolerant' if any(k in t for k in ('耐湿', '耐水湿', '水湿')) else 'any'),
            'tolerant': any(k in t for k in ('耐瘠薄', '适应性', '要求不严', '不择土壤'))}


def parse_hardiness(text):
    t = str(text or '')
    m = re.search(r'耐寒\s*(-?\d+)\s*℃', t)
    z = re.search(r'(\d+)\s*[-–~]\s*(\d+)\s*区', t)
    z1 = re.search(r'USDA\s*(\d+)\s*[-–~]\s*(\d+)', t)
    if z1:
        z = z1
    return {'text': t,
            'minTempC': int(m.group(1)) if m else None,
            'zoneMin': int(z.group(1)) if z else None,
            'zoneMax': int(z.group(2)) if z else None,
            'evergreenSouthOnly': '北方盆栽' in t or '北方需保护' in t}


def parse_months(text):
    """解析 '花期3-5月、果期7-8月' / '花期几乎全年' / '果期翌年5-6月'"""
    t = str(text or '')
    out = {'flower': [], 'fruit': []}
    if '全年' in t:
        out['flower'] = list(range(1, 13))
    for part in re.split(r'[、，,；;]', t):
        key = 'flower' if '花期' in part else ('fruit' if '果期' in part else None)
        if not key:
            continue
        m = re.search(r'(\d{1,2})\s*[-–~至]\s*(\d{1,2})\s*月', part)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            months = list(range(a, b + 1)) if a <= b else list(range(a, 13)) + list(range(1, b + 1))
        else:
            m2 = re.search(r'(\d{1,2})\s*月', part)
            months = [int(m2.group(1))] if m2 else []
        out[key] = sorted(set(out[key] + [x for x in months if 1 <= x <= 12]))
    return out


SEASON_MONTHS = {'spring': [3, 4, 5], 'summer': [6, 7, 8], 'autumn': [9, 10, 11], 'winter': [12, 1, 2]}


def parse_phenology(flower_fruit_text, life, color_text):
    p = parse_months(flower_fruit_text)
    evergreen = '常绿' in str(life)
    deciduous = '落叶' in str(life)
    autumn_color = bool(re.search(r'秋[季天]?.{0,4}(变)?(红|黄|橙)', str(color_text))) or '秋色叶' in str(color_text)
    interest = {}
    for s, ms in SEASON_MONTHS.items():
        v = 0.0
        if any(m in p['flower'] for m in ms):
            v += 2.0
        if any(m in p['fruit'] for m in ms):
            v += 1.0
        if evergreen:
            v += 0.5
        if s == 'autumn' and autumn_color:
            v += 1.5
        if s == 'winter' and deciduous:
            v -= 0.3
        interest[s] = round(max(v, 0.0), 1)
    return {'flowerMonths': p['flower'], 'fruitMonths': p['fruit'], 'text': str(flower_fruit_text or ''),
            'evergreen': evergreen, 'deciduous': deciduous, 'autumnColor': autumn_color,
            'seasonInterest': interest,
            'peakSeason': max(interest, key=interest.get)}


def load_sheet(path, sheet):
    import openpyxl
    ws = openpyxl.load_workbook(path, data_only=True)[sheet]
    head = [c.value for c in ws[1]]
    rows = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        d = dict(zip(head, r))
        if d.get('中文名'):
            rows.append(d)
    return rows


# ---------- 归一化：设计分类 / 功能标签分组 / 适生区 ----------
def parse_design_category(is_warn, category, life):
    """警示库原用分类学(科属)，统一映射为与主库一致的设计分类"""
    if not is_warn:
        return str(category or '')
    s = str(life or '')
    if '藤本' in s:
        return '藤本攀援'
    if '乔木' in s:
        return '小乔木/亚乔木'
    if '球根' in s:
        return '球根'
    if '宿根' in s:
        return '宿根/多年生草本'
    if '一年生' in s or '二年生' in s:
        return '一二年生花卉'
    if '挺水' in s or '水生' in s:
        return '水生/湿生'
    if '高大草本' in s or '观赏草' in s:
        return '观赏草'
    if '灌木' in s:
        return '花灌木/绿篱'
    return '宿根/多年生草本'


TAG_GROUP_MAP = [
    ('观赏', ['观赏', '观花', '观果', '观叶', '观叶观果', '观花观果', '观赏（草坪）', '观赏草',
            '花境', '花坛', '花篱', '绿篱', '造型', '切花', '干花', '年宵花卉', '野花',
            '庭院', '庭院树', '花境背景', '盆栽', '盆景', '球根花卉']),
    ('芳香', ['芳香']),
    ('食用', ['食用', '食用浆果', '食用（干制后）', '果园菜圃', '食用（牧草）']),
    ('药用', ['药用']),
    ('蜜源食源', ['蜜源食源', '蜜源植物']),
    ('生态防护', ['固土低维护', '低维护', '水土保持', '抗污染', '净化空气']),
    ('科普互动', ['科普', '互动', '染甲']),
    ('垂直绿化', ['垂直绿化', '棚架']),
    ('耐阴地被', ['地被', '耐阴地被', '耐阴']),
    ('水生湿生', ['水生植物', '湿地绿化', '水边绿化', '水培观赏']),
]
_TAG2GROUP = {t: g for g, ts in TAG_GROUP_MAP for t in ts}

REGION_KEYS = ['全国', '华东', '华北', '华中', '华南', '西南', '西北', '东北', '长江流域', '上海', '长三角']


def parse_region_tags(text):
    t = str(text or '')
    return [k for k in REGION_KEYS if k in t]


# ---------- 自动生成练习题（每株 6 题，干扰项取自同层级植物） ----------
import random

QUIZ_TPL = [
    ('light', '光照习性', '在社区花园中选择【{n}】的种植位置时，下列哪一项符合它的光照习性？', 'text'),
    ('water', '水分习性', '关于【{n}】的水分需求，下列说法正确的是？', 'text'),
    ('soil', '土壤要求', '关于【{n}】的土壤要求，下列说法正确的是？', 'text'),
    ('pheno', '观赏与季相', '【{n}】的观赏期（花期/果期）是下列哪一项？', 'text'),
    ('usage', '配置方式', '下列哪一组配置方式最适合【{n}】？', 'text'),
    ('safety', '安全应用', '在社区花园设计中，对【{n}】的安全应用处理，下列哪一项是正确的？', 'text'),
]


def safety_answer(p):
    if p['isWarning']:
        if p['warning']['restriction'] == 'forbid':
            return '列入禁植清单，社区花园内不得种植'
        return '限制使用：远离儿童活动区，并设置警示提示牌'
    if p['safeForChildren']:
        return '可正常使用，无明显毒刺风险，可用于儿童活动区周边'
    return '需谨慎使用：存在刺、刺激性汁液等风险，应远离儿童活动区主要动线'


def field_text(p, key):
    if key == 'light':
        return p['light']['text']
    if key == 'water':
        return p['water']['text']
    if key == 'soil':
        return p['soil']['text']
    if key == 'pheno':
        return p['phenology']['text']
    if key == 'usage':
        return '、'.join(p['usage'])
    return safety_answer(p)


SAFETY_DISTRACT = {
    'forbid': ['限制使用：远离儿童活动区并设警示牌即可', '可正常使用，无明显毒刺风险',
             '适合作为儿童活动区主景植物'],
    'caution': ['可任意区域成片密植，无需提示', '可正常使用，无明显毒刺风险，适合儿童采摘园',
              '适合布置在儿童活动区出入口'],
    'safe': ['列入禁植清单，社区花园内不得种植', '限制使用：远离儿童活动区并设警示提示牌',
            '只能在封闭苗圃内栽培，不可用于社区'],
    'careful': ['可正常使用，无明显毒刺风险，适合儿童活动区', '适合作为儿童采摘园主栽品种',
              '可成片密植于主入口人流密集处'],
}


def safety_kind(p):
    if p['isWarning']:
        return 'forbid' if p['warning']['restriction'] == 'forbid' else 'caution'
    return 'safe' if p['safeForChildren'] else 'careful'


def build_quiz(plants):
    rnd = random.Random(20260914)
    by_layer = collections.defaultdict(list)
    for p in plants:
        by_layer[p['layer']].append(p)
    for p in plants:
        pool = [q for q in by_layer[p['layer']] if q['id'] != p['id']] or [q for q in plants if q['id'] != p['id']]
        items = []
        for key, dim, tpl, _ in QUIZ_TPL:
            right = field_text(p, key)
            if not right:
                continue
            if key == 'safety':
                distract = SAFETY_DISTRACT[safety_kind(p)]
            else:
                distract, seen = [], {right}
                cand = rnd.sample(pool, min(len(pool), 12))
                for q in cand:
                    t = field_text(q, key)
                    if t and t not in seen and len(t) <= len(right) + 14:
                        seen.add(t)
                        distract.append(t)
                    if len(distract) == 3:
                        break
            while len(distract) < 3:
                distract.append(f'以上均不符合（干扰项{len(distract)}）')
            opts = distract + [right]
            rnd.shuffle(opts)
            items.append({
                'q': tpl.format(n=p['name']),
                'dimension': dim,
                'options': opts,
                'answerIndex': opts.index(right),
                'explain': f"依据植物库资料：{p['name']}（{p['latin']}）的{dim}为「{right}」。",
            })
        p['quiz'] = items
    return plants


def build():
    main = load_sheet(MAIN_XLSX, '社区花园植物库100种')
    warn = load_sheet(WARN_XLSX, '有毒有刺植物警示名录')
    plants, idx = [], 0
    for src, rows, imgdir, is_warn in ((False, main, MAIN_IMG, False), (True, warn, WARN_IMG, True)):
        for r in rows:
            idx += 1
            pid = f'p{idx:03d}'
            name = str(r['中文名']).strip()
            layer = parse_layer(r.get('植物类别'), r.get('生活型'))
            hmin, hmax = parse_height(r.get('株高范围'))
            f = CANOPY_FACTOR[layer]
            notes = str(r.get('社区花园应用与安全要点') or '')
            warn_block = None
            if is_warn:
                extra = WARN_EXTRA.get(name)
                risk = str(r.get('风险类型') or '')
                warn_block = {
                    'riskType': risk,
                    'riskLevel': RISK_LEVEL.get(risk, 'medium'),
                    'riskPart': str(r.get('危险部位') or ''),
                    'symptom': extra[0] if extra else '',
                    'consequence': extra[1] if extra else '',
                    'identify': extra[2] if extra else '',
                    'teachUse': extra[3] if extra else '',
                    'banReason': str(r.get('社区花园禁用原因') or ''),
                    'restriction': 'forbid' if name in FORBID else 'caution',
                }
            unsafe_kw = any(k in notes for k in ('剧毒', '有毒', '有刺', '刺毛', '致敏', '扎伤', '割伤', '划伤', '过敏性'))
            plants.append({
                'id': pid,
                'seq': int(r.get('序号') or idx),
                'name': name,
                'latin': str(r.get('拉丁学名') or ''),
                'alias': split_tags(r.get('别名')),
                'category': parse_design_category(is_warn, r.get('植物类别'), r.get('生活型')),
                'taxon': str(r.get('植物类别') or '') if is_warn else '',
                'lifeForm': str(r.get('生活型') or ''),
                'layer': layer,
                'functionTags': split_tags(r.get('功能标签')),
                'tagGroups': sorted({_TAG2GROUP.get(t, '其他') for t in split_tags(r.get('功能标签'))}),
                'regionTags': parse_region_tags(r.get('适用地区')),
                'light': parse_light(r.get('光照需求')),
                'water': parse_water(r.get('水分需求')),
                'soil': parse_soil(r.get('土壤要求')),
                'hardiness': parse_hardiness(r.get('耐寒性/适生区')),
                'height': {'text': str(r.get('株高范围') or ''), 'min': hmin, 'max': hmax},
                'canopy': {'min': round(hmin * f, 2) if hmin else None,
                           'max': round(hmax * f, 2) if hmax else None, 'estimated': True},
                'ornamentalPart': str(r.get('观赏部位') or ''),
                'color': str(r.get('花色叶色果色') or ''),
                'phenology': parse_phenology(r.get('花期果期'), r.get('生活型'), r.get('花色叶色果色')),
                'usage': split_tags(r.get('配置方式')),
                'region': str(r.get('适用地区') or ''),
                'notes': notes,
                'images': {'full': f'/images/plants/{pid}_full.webp',
                           'close': f'/images/plants/{pid}_close.webp',
                           'thumb': f'/images/plants/thumbs/{pid}.webp'},
                'source': str(r.get('资料来源') or ''),
                'isWarning': is_warn,
                'warning': warn_block,
                'safeForChildren': (not is_warn) and (not unsafe_kw),
            })
    return build_quiz(plants)


def copy_images(plants):
    """按 中文名全貌/特写 找到原图，复制为 id_full/id_close 并生成缩略图"""
    by_name = {p['name']: p for p in plants}
    missing = []
    for name, p in by_name.items():
        d = WARN_IMG if p['isWarning'] else MAIN_IMG
        for suffix, key in (('全貌', 'full'), ('特写', 'close')):
            src = os.path.join(d, f'{name}{suffix}.jpg')
            if not os.path.exists(src):
                missing.append(f'{name}{suffix}')
                continue
            im = Image.open(src).convert('RGB')
            im.thumbnail((900, 900), Image.LANCZOS)
            im.save(os.path.join(OUT_IMG, f'{p["id"]}_{key}.webp'), 'WEBP', quality=78)
        thumb = os.path.join(OUT_THUMB, f'{p["id"]}.webp')
        src_full = os.path.join(OUT_IMG, f'{p["id"]}_full.webp')
        if os.path.exists(src_full):
            im = Image.open(src_full).convert('RGB')
            im.thumbnail((400, 400), Image.LANCZOS)
            im.save(thumb, 'WEBP', quality=72)
    return missing


def write_payload(plants):
    cats = sorted({p['category'] for p in plants if p['category']})
    payload = {
        'version': '1.0',
        'generatedAt': '2026-09-14',
        'total': len(plants),
        'filters': {
            'categories': cats,
            'layers': [{'key': 'tree', 'label': '乔木'}, {'key': 'shrub', 'label': '灌木'},
                       {'key': 'herb', 'label': '草本'}, {'key': 'vine', 'label': '藤本'},
                       {'key': 'bamboo', 'label': '竹类'}],
            'tagGroups': [g for g, _ in TAG_GROUP_MAP],
            'regions': REGION_KEYS,
            'safety': ['all', 'warning', 'safeForChildren', 'forbid'],
        },
        'quizDimensions': [d for _, d, _, _ in QUIZ_TPL],
        'plants': plants,
    }
    with open(OUT_DATA, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print('植物总数:', len(plants), '| 警示植物:', sum(1 for p in plants if p['isWarning']))
    print('题目总数:', sum(len(p['quiz']) for p in plants))
    print('层级分布:', dict(collections.Counter(p['layer'] for p in plants)))
    print('设计分类:', len(cats), cats)
    print('功能分组:', dict(collections.Counter(g for p in plants for g in p['tagGroups'])))
    print('儿童区可种:', sum(1 for p in plants if p['safeForChildren']),
          '| 禁植:', sum(1 for p in plants if p['warning'] and p['warning']['restriction'] == 'forbid'))
    print('输出:', OUT_DATA, round(os.path.getsize(OUT_DATA) / 1024, 1), 'KB')


if __name__ == '__main__':
    ps = build()
    miss = copy_images(ps)
    write_payload(ps)
    print('缺图:', miss or '无')
