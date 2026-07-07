import { AdminNav } from "@/components/admin/admin-nav";
import { CloudStatusBanner } from "@/components/admin/cloud-status-banner";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell flex min-h-screen flex-col md:flex-row">
      <AdminNav />
      <main className="admin-main flex-1 px-5 py-8 md:px-10 md:py-10 lg:px-12">
        <CloudStatusBanner />
        {children}
      </main>
    </div>
  );
}
