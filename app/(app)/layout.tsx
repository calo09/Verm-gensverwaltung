import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-4">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold">Vermögen</span>
          <Link href="/dashboard" className="text-muted hover:text-text">Übersicht</Link>
          <Link href="/positionen" className="text-muted hover:text-text">Positionen</Link>
          <Link href="/kurse" className="text-muted hover:text-text">Kurse</Link>
          <Link href="/import" className="text-muted hover:text-text">Import</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="hidden sm:inline">{user.email}</span>
          <form action={logout}>
            <button className="btn-ghost" type="submit">Abmelden</button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
