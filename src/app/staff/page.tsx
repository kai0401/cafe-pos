import { Suspense } from "react";
import { StaffAccessForm } from "./staff-access-form";

export const dynamic = "force-dynamic";

export default function StaffAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1ea] px-6">
      <Suspense fallback={null}>
        <StaffAccessForm />
      </Suspense>
    </main>
  );
}
