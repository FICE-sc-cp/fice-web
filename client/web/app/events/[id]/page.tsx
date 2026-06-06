export default async function EventDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-4">Деталі заходу: {id}</h1>
      <p>Тут буде дата, час, місце проведення, опис та кнопка для реєстрації.</p>
    </main>
  );
}
