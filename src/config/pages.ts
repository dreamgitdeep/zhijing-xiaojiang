/** 页面级静态文案：各页面标题/说明唯一来源，页面组件通过 PageHeader 引用 */
export const PAGE_COPY = {
  admin: {
    title: "管理后台",
    descriptionCloud: "教师专属 · 数据实时同步云端",
    descriptionLocal: "教师专属 · 本地模式：数据存于浏览器，不联网"
  },
  adminStudents: {
    title: "学情看板",
    description: "学生掌握进度、练习表现与活跃情况总览"
  },
  adminPlants: {
    title: "植物数据管理",
    descriptionTemplate: "共 {count} 种植物 · 左侧选择植物，右侧直接增删改练习题，保存后同步至学生端"
  },
  designTasks: {
    title: "任务管理",
    description: "任务发布后仍保留在任务库，可随时再发布到其他班级；「已发布的任务」查看当前发布状态与学生统计",
    newTask: "新建任务"
  },
  notifications: {
    title: "消息通知",
    unreadSuffix: "条未读",
    allRead: "全部已读",
    markAllRead: "全部已读",
    empty: "暂无消息",
    emptyHint: "教师的任务提醒会出现在这里",
    retry: "重试",
    loadFailedPrefix: "加载失败：",
    loadFailed: "加载失败",
    authRequired: "请先登录后查看消息",
    viewTask: "查看任务 →"
  },
  designCase: {
    backToList: "返回案例列表",
    hoursPrefix: "约",
    hoursSuffix: "课时",
    stagesSuffix: "个阶段",
    startDesign: "开始设计",
    continueDesign: "继续设计",
    progressPrefix: "当前进度："
  },
  designList: {
    empty: "教师尚未发布新任务，请稍后再来。",
    totalPrefix: "共",
    totalSuffix: "个案例",
    statusCompleted: "已完成",
    statusProgressPrefix: "进行到",
    estMinutesPrefix: "约",
    estMinutesSuffix: "分钟",
    enterCase: "进入案例 →"
  }
};
