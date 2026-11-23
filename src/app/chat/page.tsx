import { loadDataset } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import ChatClient from "@/components/ChatClient";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ plantId?: string; conv?: string }> }) {
  const { plantId, conv } = await searchParams;
  const [dataset, user] = await Promise.all([loadDataset(), getSessionUser()]);
  const plant = plantId ? dataset.plants.find((p) => p.id === plantId) : undefined;

  return (
    <AppShell user={user}>
      <div className="student-vivid -my-3 w-full">
        <ChatClient
          plantsLite={dataset.plants.map((p) => ({ id: p.id, name: p.name, latin: p.latin }))}
          initialConvId={conv}
          plant={
            plant
              ? {
                  id: plant.id,
                  name: plant.name,
                  latin: plant.latin,
                  thumb: plant.images.thumb,
                  isWarning: plant.isWarning,
                  category: plant.category,
                  tags: plant.tagGroups.slice(0, 2),
                }
              : null
          }
          signedIn={Boolean(user)}
        />
      </div>
    </AppShell>
  );
}
