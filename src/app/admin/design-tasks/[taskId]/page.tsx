import { AppShell } from "@/components/AppShell";
import DesignTaskEdit from "@/components/design/DesignTaskEdit";
import { requireTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminDesignTaskEditPage({ params }: { params: Promise<{ taskId: string }> }) {
  const teacher = await requireTeacher();
  const { taskId } = await params;
  return (
    <AppShell user={teacher} floral>
      <div className="w-full space-y-5 py-6">
        <DesignTaskEdit taskId={taskId} />
      </div>
    </AppShell>
  );
}
