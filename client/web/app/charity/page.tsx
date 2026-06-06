import Link from 'next/link';

export default function CharityCatalogPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-4">Благодійність та збори</h1>
      <p>Каталог актуальних та закритих зборів.</p>
      <ul className="mt-4 list-disc pl-5">
        <li><Link href="/charity/1" className="text-blue-500 hover:underline">Збір на дрони (Приклад)</Link></li>
      </ul>
    </main>
  );
}
