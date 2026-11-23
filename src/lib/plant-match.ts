export interface PlantNameLite {
  id: string;
  name: string;
  latin: string;
}

export function matchPlantByName(question: string, plants: PlantNameLite[]): PlantNameLite | null {
  const q = question.toLowerCase();
  const byName = [...plants].sort((a, b) => b.name.length - a.name.length);
  for (const p of byName) {
    if (p.name.length >= 2 && q.includes(p.name.toLowerCase())) return p;
  }
  for (const p of plants) {
    if (p.latin && q.includes(p.latin.toLowerCase())) return p;
  }
  return null;
}
