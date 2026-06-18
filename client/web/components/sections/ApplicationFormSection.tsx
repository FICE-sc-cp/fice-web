'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Container } from '@/components/ui/Container';
import { Glow } from '@/components/ui/Glow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const DEPARTMENTS = [
  { value: 'project', label: 'Проєктний департамент' },
  { value: 'media', label: 'Департамент медіа' },
  { value: 'partnership', label: 'Департамент партнерств' },
  { value: 'merch', label: 'Департамент мерчу' },
  { value: 'quality', label: 'Департамент якості освіти' },
  { value: 'entrants', label: 'Робота з абітурієнтами' },
];

const schema = z.object({
  pib: z.string().trim().min(1, 'Вкажіть ПІБ'),
  group: z.string().trim().min(1, 'Вкажіть групу'),
  telegram: z.string().trim().min(1, 'Вкажіть Telegram-тег'),
  department: z.string().min(1, 'Оберіть департамент'),
  motivation: z
    .string()
    .trim()
    .min(1, 'Розкажіть про мотивацію')
    .min(10, 'Хоча б кілька речень, будь ласка'),
  skills: z.string().trim().min(1, 'Вкажіть свій досвід та навички'),
  consent: z.boolean().refine((v) => v === true, 'Потрібна згода на обробку даних'),
});

export type ApplicationFormValues = z.infer<typeof schema>;

export function ApplicationFormSection() {
  const [submittedName, setSubmittedName] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      pib: '',
      group: '',
      telegram: '',
      department: '',
      motivation: '',
      skills: '',
      consent: false,
    },
  });

  const onSubmit = handleSubmit((data) => {
    const parts = data.pib.trim().split(/\s+/);
    setSubmittedName(parts[1] || parts[0] || '');
  });

  const handleReset = () => {
    reset();
    setSubmittedName(null);
  };

  useEffect(() => {
    if (submittedName !== null) {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [submittedName]);

  return (
    <section
      ref={sectionRef}
      id="form"
      className="relative isolate scroll-mt-28 py-16 lg:py-24"
    >
      <Glow
        color="#36DFFF"
        className="left-1/2 top-1/2 h-[26rem] w-[44rem] -translate-x-1/2 -translate-y-1/2"
      />

      <Container>
        <div className="relative mx-auto max-w-3xl rounded-3xl border border-white/5 bg-surface/40 p-6 sm:p-10 lg:p-12">
          <div
            className={submittedName !== null ? 'invisible' : undefined}
            aria-hidden={submittedName !== null}
          >
            <SectionHeader
              title="Анкета вступу"
              subtitle="Кілька хвилин — і ми знатимемо про тебе головне."
            />

            <form onSubmit={onSubmit} noValidate className="mt-9 flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Input
                  label="ПІБ"
                  placeholder="Шевченко Тарас Григорович"
                  error={errors.pib?.message}
                  {...register('pib')}
                />
                <Input
                  label="Група"
                  placeholder="ІП-31"
                  error={errors.group?.message}
                  {...register('group')}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="flex w-full flex-col gap-1.5">
                  <label className="text-sm font-semibold text-muted">Telegram-тег</label>
                  <div
                    className={cn(
                      'flex items-center rounded-xl border bg-surface px-4 transition-colors focus-within:border-brand-cyan',
                      errors.telegram ? 'border-brand-red' : 'border-border',
                    )}
                  >
                    <span className="pr-1 font-bold text-subtle">@</span>
                    <input
                      type="text"
                      placeholder="username"
                      className="w-full bg-transparent py-3 text-fg outline-none placeholder:text-subtle"
                      {...register('telegram')}
                    />
                  </div>
                  {errors.telegram && (
                    <span className="text-xs font-medium text-brand-red">
                      {errors.telegram.message}
                    </span>
                  )}
                </div>

                <Select
                  label="Який департамент тобі цікавий?"
                  placeholder="Оберіть департамент…"
                  options={DEPARTMENTS}
                  error={errors.department?.message}
                  {...register('department')}
                />
              </div>

              <Textarea
                label="Чому хочеш долучитись? Що тебе мотивує?"
                placeholder="Розкажи, що тебе надихає, які ідеї хочеш реалізувати та чого очікуєш від Студради…"
                error={errors.motivation?.message}
                {...register('motivation')}
              />

              <Textarea
                label="Досвід та навички"
                placeholder="Дизайн, відеомонтаж, SMM, організація подій, програмування, попередній досвід в активностях…"
                className="min-h-[90px]"
                error={errors.skills?.message}
                {...register('skills')}
              />

              <div className="flex flex-col gap-1.5">
                <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-subtle">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-[18px] shrink-0 accent-brand-green"
                    {...register('consent')}
                  />
                  <span>
                    Погоджуюсь на обробку моїх даних для розгляду заявки та звʼязку зі
                    мною.
                  </span>
                </label>
                {errors.consent && (
                  <span className="text-xs font-medium text-brand-red">
                    {errors.consent.message}
                  </span>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                className="mt-1 w-full rounded-2xl py-4 text-lg"
              >
                Надіслати заявку
              </Button>
            </form>
          </div>

          {submittedName !== null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <span className="flex size-20 items-center justify-center rounded-full bg-gradient-green text-4xl font-bold text-black">
                ✓
              </span>
              <h2 className="text-3xl font-bold sm:text-4xl">Заявку надіслано!</h2>
              <p className="max-w-md text-lg leading-relaxed text-muted">
                Дякуємо, {submittedName}. Ми розглянемо твою заявку та звʼяжемось у
                Telegram найближчим часом.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="mt-2"
              >
                Надіслати ще одну
              </Button>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
