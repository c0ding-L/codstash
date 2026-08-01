import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard · Codstash",
};

export default function DashboardPage() {
  return <h2 className="text-sm font-medium text-muted-foreground">Main</h2>;
}
