"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Wordmark } from "./Logo";

export function SiteNav() {
  const path = usePathname();
  const l = (href: string, label: string) => <Link href={href} className={`link ${path === href ? "active" : ""}`}>{label}</Link>;
  return (
    <header className="site-nav">
      <Link href="/" style={{ textDecoration: "none", color: "inherit" }} aria-label="Kinesis Studio home"><Wordmark size={30} /></Link>
      <nav>{l("/about", "About")}{l("/docs", "Docs")}<a className="link" href="https://github.com/demir-sama/kinesis-studio" target="_blank" rel="noreferrer">GitHub</a><Link href="/studio" className="btn primary sm" style={{ marginLeft: 8 }}>Open Studio</Link></nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Kinesis Studio · MIT licensed · built for MozFest Developers Wilding</span>
      <span><Link href="/about">About</Link> · <Link href="/docs">Docs</Link> · <a href="https://otari.ai" target="_blank" rel="noreferrer">Otari</a> · <a href="https://github.com/demir-sama/kinesis-studio" target="_blank" rel="noreferrer">Source</a></span>
    </footer>
  );
}

export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}
export function Reveal() { useReveal(); return null; }
