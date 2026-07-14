import Link from 'next/link';

const SECTIONS = [
  { href: '/news', label: 'Новини', emoji: '📰' },
  { href: '/events', label: 'Заходи', emoji: '🎉' },
  { href: '/channel', label: 'Публікації', emoji: '📢' },
  { href: '/partners', label: 'Партнери', emoji: '🤝' },
  { href: '/departments', label: 'Департаменти', emoji: '🏛️' },
  { href: '/members', label: 'Президія', emoji: '👥' },
  { href: '/project-participants', label: 'Люди проєктного', emoji: '👤' },
  { href: '/fundraisers', label: 'Збори', emoji: '💛' },
  { href: '/applicants', label: 'Заявки', emoji: '📩' },
  { href: '/facts', label: 'Факти', emoji: '📊' },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">
        Адмінка <span className="text-gradient">FICE</span>
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Керування контентом сайту студради
      </p>

      <div className="grid grid-cols-2 gap-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-brand-cyan"
          >
            <div className="text-2xl">{s.emoji}</div>
            <div className="mt-2 font-semibold">{s.label}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
