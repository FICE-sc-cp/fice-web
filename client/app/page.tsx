import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="p-8 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold mb-4">Студрада ФІОТ</h1>
      <p className="mb-8 text-gray-600">
        Тут буде загальна інформація, банери, візія та місія
      </p>

      {/* Сітка з кнопками-картками для навігації */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        
        <Link 
          href="/partners" 
          className="p-5 border rounded-xl shadow-sm hover:shadow-md hover:border-blue-400 hover:bg-blue-50 transition-all"
        >
          <h2 className="text-xl font-semibold mb-2">Для партнерів</h2>
        </Link>

        <Link 
          href="/charity" 
          className="p-5 border rounded-xl shadow-sm hover:shadow-md hover:border-blue-400 hover:bg-blue-50 transition-all"
        >
          <h2 className="text-xl font-semibold mb-2">Благодійність</h2>
        </Link>

        <Link 
          href="/events" 
          className="p-5 border rounded-xl shadow-sm hover:shadow-md hover:border-blue-400 hover:bg-blue-50 transition-all"
        >
          <h2 className="text-xl font-semibold mb-2">Заходи</h2>
        </Link>

        <Link 
          href="/departments/media" 
          className="p-5 border rounded-xl shadow-sm hover:shadow-md hover:border-blue-400 hover:bg-blue-50 transition-all"
        >
          <h2 className="text-xl font-semibold mb-2">Відділи (Media)</h2>
        </Link>

        <Link 
          href="/join" 
          className="p-5 border rounded-xl shadow-sm hover:shadow-md hover:border-blue-400 hover:bg-blue-50 transition-all"
        >
          <h2 className="text-xl font-semibold mb-2">Форма для приєднання в СР</h2>
        </Link>

      </div>
    </main>
  );
}