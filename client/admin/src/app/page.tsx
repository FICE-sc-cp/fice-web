'use client';
import { useTelegram } from '@/hooks/useTelegram';

export default function Home() {
  const { webApp, user } = useTelegram();

  if (!webApp) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Loading Telegram Web App...
      </div>
    );
  }

  return (
    <div className=" flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Admin Panel</h1>
      {user && (
        <p className="text-gray-600">
          Welcome, {user.first_name}
          {user.username ? ` (@${user.username})` : ''}
        </p>
      )}
      <p className="text-sm text-gray-400">
        Platform: {webApp.platform} &middot; v{webApp.version}
      </p>
    </div>
  );
}
