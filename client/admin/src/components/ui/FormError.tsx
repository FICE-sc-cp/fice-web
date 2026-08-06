import { errorList } from '@/lib/errors';

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const messages = errorList(error);

  return (
    <div
      role="alert"
      className="rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red"
    >
      {messages.length === 1 ? (
        <p className="break-words">{messages[0]}</p>
      ) : (
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {messages.map((m, i) => (
            <li key={i} className="break-words">
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
