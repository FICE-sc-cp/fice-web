import Link from 'next/link';

export default function PartnersPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-4">Для партнерів</h1>
      <p>Інформація про співпрацю, наші поточні партнери.</p>
      <Link href="/partners/join" className="text-blue-500 underline mt-4 inline-block">
        Стати партнером
      </Link>
    </main>
  );
}
