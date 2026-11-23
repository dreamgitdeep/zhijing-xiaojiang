/**
 * 演示数据种子（手动运行入口）：逻辑在 src/lib/demo-seed.ts（服务启动后也会异步自动执行）。
 * 运行（需 Supabase 环境变量）：pnpm tsx scripts/seed_demo_data.ts
 */
import { ensureDemoData } from '../src/lib/demo-seed';

async function main() {
  await ensureDemoData();
  console.log('完成。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
