import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { HomeHero } from "@/components/HomeHero";
import { HOME_COPY } from "@/config/site";

export default async function Home() {
    const user = await getSessionUser();
    if (user) {
        redirect(user.role === "teacher" ? "/admin" : "/learning");
    }

    return <HomeHero copy={HOME_COPY} />;
}
