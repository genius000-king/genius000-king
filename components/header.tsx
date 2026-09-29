import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-8 px-6">
        <Link href="/" className="flex items-center gap-2.5 font-medium tracking-tight">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
          </svg>
          Hub
        </Link>
        <nav aria-label="Main" className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-fg" aria-current="page">
            Projects
          </Link>
        </nav>
      </div>
    </header>
  );
}
