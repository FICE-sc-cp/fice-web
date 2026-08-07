import { errorList } from '@/lib/errors';

export function FormError({
  error,
  messages,
}: {
  error?: unknown;
  messages?: string[];
}) {
  const list = messages ?? (error ? errorList(error) : []);
  if (list.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-brand-red"
    >
      {list.length === 1 ? (
        <p className="break-words">{list[0]}</p>
      ) : (
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {list.map((m, i) => (
            <li key={i} className="break-words">
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
