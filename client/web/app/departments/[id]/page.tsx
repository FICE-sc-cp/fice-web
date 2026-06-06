export default async function DepartmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-4">Департамент: {id}</h1>
      <p>Інформація про структуру, функції та команду цього конкретного відділу.</p>
    </main>
  );
}
