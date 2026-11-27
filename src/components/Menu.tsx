"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Menu({ enlaces }: { enlaces: { href: string; texto: string }[] }) {
  const p = usePathname();
  return (
    <nav className="menu" aria-label="Principal">
      {enlaces.map((e) => (
        <Link key={e.href} href={e.href} aria-current={(e.href === "/" ? p === "/" : p.startsWith(e.href)) ? "page" : undefined}>
          {e.texto}
        </Link>
      ))}
    </nav>
  );
}
