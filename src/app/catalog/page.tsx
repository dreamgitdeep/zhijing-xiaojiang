import { AppShell } from "@/components/AppShell";
import { PlantCatalog } from "@/components/PlantCatalog";
import { loadPlantsForServer } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { getMastery } from "@/lib/repo";
import { toPlantLite } from "@/lib/types";

export default async function CatalogPage() {
    const dataset = await loadPlantsForServer();
    const user = await getSessionUser();

    let masteredIds: string[] | undefined;
    if (user) {
        const mastery = await getMastery();
        masteredIds = [...mastery.items.entries()]
            .filter(([, info]) => info.mastered)
            .map(([plantId]) => plantId);
    }

    return (
        <AppShell user={user}>
            <div className="student-vivid -my-3 w-full">
                <PlantCatalog plants={dataset.plants.map(toPlantLite)} filters={{ categories: dataset.filters.categories, layers: dataset.filters.layers }} masteredIds={masteredIds} loggedIn={!!user} />
            </div>
        </AppShell>
    );
}
