import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getSupabaseClient } from '../src/storage/database/supabase-client';

interface Plant {
  id: string;
  name: string;
  latin: string;
  category: string;
  layer: string;
}

const raw = readFileSync(resolve(__dirname, '../public/data/plants.json'), 'utf-8');
const dataset = JSON.parse(raw);
const plants: Plant[] = dataset.plants;

if (!Array.isArray(plants) || plants.length === 0) {
  throw new Error('plants.json 中没有植物数据');
}

const rows = plants.map((p) => ({
  id: p.id,
  name: p.name,
  latin: p.latin,
  category: p.category,
  layer: p.layer,
  data: p,
}));

const client = getSupabaseClient();

async function main() {
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await client
      .from('plants')
      .upsert(batch, { onConflict: 'id' });
    if (error) throw new Error(`upsert 批次 ${i} 失败: ${error.message}`);
    upserted += batch.length;
    console.log(`upserted ${upserted}/${rows.length}`);
  }

  const { count, error } = await client
    .from('plants')
    .select('*', { count: 'exact', head: true });
  if (error) throw new Error(`统计失败: ${error.message}`);
  console.log(`DONE: plants 表共 ${count} 行`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
