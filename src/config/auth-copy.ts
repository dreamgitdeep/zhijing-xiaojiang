/** 登录/注册/找回密码浮层的全部静态文案唯一来源 */
export const AUTH_COPY = {
  closeAria: "关闭",
  networkError: "网络异常，请稍后重试",
  tabs: {
    login: "登录",
    register: "注册"
  },
  agreement: {
    login: "登录即代表同意课程学习公约",
    register: "注册即代表同意课程学习公约"
  },
  login: {
    identifierLabel: "学号 / 教师账号",
    identifierPlaceholder: "请输入学号或教师账号",
    passwordLabel: "密码",
    passwordPlaceholder: "请输入密码",
    showPasswordAria: "显示密码",
    hidePasswordAria: "隐藏密码",
    remember: "记住密码",
    forgot: "忘记密码？",
    submit: "登 录"
  },
  roles: {
    title: "选择角色",
    student: { label: "学生", hint: "按学号登录" },
    teacher: { label: "教师", hint: "管理班级学情" }
  },
  register: {
    nameLabel: "姓名",
    namePlaceholder: "请输入真实姓名",
    studentNoLabel: "学号",
    studentNoPlaceholder: "请输入学号，作为登录账号",
    classCodeLabel: "班级邀请码",
    classCodeOptional: "（选填）",
    classCodePlaceholder: "如 JG2301，由授课教师发放",
    accountLabel: "教师账号",
    accountPlaceholder: "3-20 位字母、数字或下划线",
    inviteCodeLabel: "教师邀请码",
    inviteCodePlaceholder: "由管理员发放",
    emailLabel: "邮箱",
    emailPlaceholder: "用于接收课程通知",
    passwordLabel: "密码",
    passwordPlaceholder: "至少 6 位",
    submit: "注 册"
  },
  reset: {
    title: "找回密码",
    subtitle: "使用教师发放的一次性重置码设置新密码",
    success: "密码已重置，请使用新密码登录",
    identifierLabel: "学号 / 账号",
    identifierPlaceholder: "请输入注册时的学号或账号",
    codeLabel: "重置码",
    codePlaceholder: "请输入教师发放的重置码",
    codeHint: "重置码由教师发放，15 分钟内有效，仅可使用一次；如未获取请联系任课教师。",
    passwordLabel: "新密码",
    passwordPlaceholder: "至少 6 位",
    submit: "重置密码"
  }
};
