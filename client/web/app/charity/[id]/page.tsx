export default async function CharityDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-4">Деталі збору #{id}</h1>
      <p>Тут буде повний опис, реквізити, прогрес-бар та звітність для конкретного збору.</p>
    </main>
  );
}