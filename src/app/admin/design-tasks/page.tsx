import { AppShell } from "@/components/AppShell";
import DesignTasksAdmin from "@/components/design/DesignTasksAdmin";
import { PAGE_COPY } from "@/config/pages";
import { requireTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminDesignTasksPage() {
  const teacher = await requireTeacher();
  return (
    <AppShell user={teacher} floral>
      <div className="w-full space-y-5 py-6">
        <DesignTasksAdmin
          headerTitle={PAGE_COPY.designTasks.title}
          headerDesc={PAGE_COPY.designTasks.description}
          newTaskLabel={PAGE_COPY.designTasks.newTask}
        />
      </div>
    </AppShell>
  );
}
