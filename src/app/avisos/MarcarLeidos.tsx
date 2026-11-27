"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MarcarLeidos() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => fetch("/api/avisos/leer", { method: "POST" }).then(() => router.refresh()), 1500);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}
