import type { Metadata } from "next";
import { requireTeacher } from "@/lib/auth";
import { getStudentRows, getClassComparison, getTeacherStats, listPlants } from "@/lib/repo";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PAGE_COPY } from "@/config/pages";
import StudentsClient, { type StudentView } from "@/components/StudentsClient";

export const metadata: Metadata = { title: "学情看板 · 植景小匠" };

export default async function AdminStudentsPage() {
  const teacher = await requireTeacher();
  if (!teacher) return null;

  const [rows, classes, stats, plants] = await Promise.all([
    getStudentRows(),
    getClassComparison(),
    getTeacherStats(),
    listPlants(),
  ]);
  const students: StudentView[] = rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    studentNo: r.studentNo,
    className: r.className,
    mastered: r.mastered,
    attempts: r.attempts,
    avgScore: r.avgScore,
    lastActive: r.lastActiveAt,
  }));

  return (
    <AppShell user={teacher} floral>
      <div className="w-full py-8">
        <PageHeader
          title={PAGE_COPY.adminStudents.title}
          description={PAGE_COPY.adminStudents.description}
        />
        <StudentsClient
          students={students}
          classes={classes}
          recentActivity={stats.recentActivity}
          totalPlants={plants.length}
        />
      </div>
    </AppShell>
  );
}
