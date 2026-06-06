import Link from 'next/link';

export default function EventsCatalogPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-4">Заходи</h1>
      <p>Каталог майбутніх та минулих івентів.</p>
      <ul className="mt-4 list-disc pl-5">
        <li><Link href="/events/FICEexpo" className="text-blue-500 hover:underline">FICEexpo</Link></li>
      </ul>
    </main>
  );
}
