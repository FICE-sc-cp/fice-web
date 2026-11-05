'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import type { AdminTemplate } from '@/lib/merch-types';
import { cn } from '@/lib/utils';
import { ACTION_CLASS, Banner, CONTROL, DANGER_CLASS, Empty, useSurface } from '../ui';
import { Gate, ICONS, Icon, LIST_CLASS, SECONDARY, ScreenHead, failText, templateLine, useTwoTap } from './kit';
import { useAdminState } from './useAdminState';

export function TemplatesScreen() {
  const { api, base, toast } = useSurface();
  const router = useRouter();
  const { state, error, refresh } = useAdminState();
  const removal = useTwoTap();

  const remove = async (template: AdminTemplate) => {
    try {
      await api.admin.deleteTemplate(template.id);
      toast('Видалено');
      await refresh();
    } catch (err) {
      toast(failText(err));
    }
  };

  return (
    <div className="space-y-4">
      <ScreenHead title="Шаблони" />
      {!state ? (
        <Gate error={error} refresh={refresh} />
      ) : (
        <>
          {error && <Banner tone="error">{error}</Banner>}
          <Button
            className={ACTION_CLASS}
            onClick={() => router.push(`${base}/admin/template`)}
          >
            + Новий шаблон
          </Button>
          {!state.templates.length ? (
            <Empty
              icon="📋"
              title="Шаблонів ще немає"
              text="Створіть шаблон, щоб не вводити ціни щоразу."
            />
          ) : (
            <ul className={LIST_CLASS}>
              {state.templates.map((t) => (
                <li key={t.id} className="p-3">
                  <Link
                    href={`${base}/admin/template?id=${t.id}`}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-1 pb-3 pt-1 transition-opacity active:opacity-70',
                      CONTROL,
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-extrabold leading-snug">
                        {t.name}
                      </span>
                      {t.categoryId !== null && (
                        <span className="block truncate text-xs font-bold text-brand-purple">
                          {state.categories.find((c) => c.id === t.categoryId)?.name}
                        </span>
                      )}
                      <span className="mt-0.5 block truncate text-[13px] font-semibold text-muted">
                        {templateLine(t)}
                      </span>
                    </span>
                    <Icon d={ICONS.chevron} className="size-4 shrink-0 text-subtle" />
                  </Link>
                  <div className="flex items-stretch gap-2">
                    <Link
                      href={`${base}/admin/product?template=${t.id}`}
                      className={cn(SECONDARY, 'flex-1 border-brand-cyan/50 text-brand-cyan')}
                    >
                      Використати
                    </Link>
                    <button
                      type="button"
                      onClick={() => removal.tap(t.id, () => void remove(t))}
                      className={cn(
                        DANGER_CLASS,
                        'min-h-11',
                        removal.armed === t.id && 'flex-1 px-3 leading-tight',
                      )}
                    >
                      {removal.armed === t.id ? 'Натисніть ще раз для підтвердження' : 'Видалити'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
