import { redirect } from "next/navigation";

// 307 rather than a permanent 308: browsers cache 308s hard, and `/` may yet
// become a landing page.
export default function Home() {
  redirect("/dashboard");
}
