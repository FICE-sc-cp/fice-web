export {};

declare global {
  interface TelegramWebApp {
    expand(): void;
    close(): void;
    ready(): void;
    sendData(data: string): void;
    initData: string;
    initDataUnsafe: {
      query_id?: string;
      user?: {
        id: number;
        first_name: string;
        last_name?: string;
        username?: string;
        language_code?: string;
        is_premium?: boolean;
      };
      auth_date: number;
      hash: string;
      [key: string]: unknown;
    };
    themeParams: Record<string, string>;
    colorScheme: 'light' | 'dark';
    headerColor: string;
    backgroundColor: string;
    isExpanded: boolean;
    viewportHeight: number;
    viewportStableHeight: number;
    platform: string;
    version: string;
  }

  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}
