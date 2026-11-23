import { getSessionUser } from "./src/lib/auth";
async function main() {
  const u = await getSessionUser();
  console.log("session user:", JSON.stringify(u));
}
main();
