"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/despesas", label: "Despesas" },
  { href: "/faturamento", label: "Faturamento" },
  { href: "/categorias", label: "Categorias" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-slate-900 text-sm sm:text-base shrink-0">
            Contas Michael & Jamille
          </span>
          <button onClick={handleLogout} className="btn-secondary text-xs shrink-0">
            Sair
          </button>
        </div>
        <nav className="flex items-center gap-1 mt-2 -mx-1 px-1 overflow-x-auto">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 ${
                pathname === link.href
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
