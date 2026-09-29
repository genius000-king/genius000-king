import { KINDS } from "@/lib/kinds";

export default function ProjectsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
      <p className="mt-2 text-sm text-muted">Sites, bots and tools that run on this hub.</p>

      <section className="mt-10 rounded-lg border border-line bg-surface">
        <div className="px-6 py-14 text-center">
          <p className="font-medium">No projects yet</p>
          <p className="mt-1 text-sm text-muted">Nothing is deployed on this hub.</p>
        </div>
        <ul className="grid divide-y divide-line border-t border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {Object.values(KINDS).map(({ label, blurb }) => (
            <li key={label} className="px-6 py-5">
              <h2 className="text-sm font-medium">{label}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{blurb}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
