/**
 * 认证相关常量（中性模块，不依赖 next/* 运行时）。
 * 自定义 server 入口（src/server.ts）会打包引用这里的模块，勿在此引入 next/headers 等 App Router 依赖。
 */
export const EMAIL_DOMAIN = 'stu.zhijing.edu.cn';

export const CLASS_CODES: Record<string, string> = {
  jg2301: '景观2301',
  jg2302: '景观2302',
  jg2303: '景观2303'
};
