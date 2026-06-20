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
  const confettiRef = useRef<HTMLCanvasElement>(null);

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

  // Святковий вибух конфеті після успішного надсилання заявки.
  useEffect(() => {
    if (submittedName === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = confettiRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width: W, height: H } = canvas.getBoundingClientRect();
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const colors = ['#2eff97', '#36dfff', '#ad46ff', '#f6339a', '#ff8904', '#00e3c5'];
    const cx = W / 2;
    const cy = H * 0.34;
    const parts = Array.from({ length: 130 }, (_, i) => {
      const ang = (Math.PI * 2 * i) / 130 + (Math.random() - 0.5) * 0.5;
      const sp = 5 + Math.random() * 9;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(ang) * sp * (0.6 + Math.random() * 0.8),
        vy: Math.sin(ang) * sp - (3 + Math.random() * 4),
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        color: colors[(Math.random() * colors.length) | 0],
        circle: Math.random() < 0.35,
      };
    });

    let raf = 0;
    let stopped = false;
    const grav = 0.22;
    const drag = 0.992;
    const start = performance.now();
    const tick = (now: number) => {
      if (stopped) return;
      const t = now - start;
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of parts) {
        p.vx *= drag;
        p.vy = p.vy * drag + grav;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        const fade = t > 1400 ? Math.max(0, 1 - (t - 1400) / 1100) : 1;
        if (p.y < H + 30 && fade > 0) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        if (p.circle) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      if (alive && t < 3200) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
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
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-white/5 bg-surface/40 p-6 sm:p-10 lg:p-12">
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
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center">
              <canvas
                ref={confettiRef}
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[3] h-full w-full"
              />

              <div className="relative z-[2] flex size-[120px] items-center justify-center">
                <span
                  aria-hidden
                  className="absolute size-[120px] rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(46,255,151,0.55), rgba(0,0,0,0) 70%)',
                    filter: 'blur(6px)',
                    animation: 'su-glow 2.4s ease-in-out infinite',
                  }}
                />
                <span
                  aria-hidden
                  className="absolute size-24 rounded-full border-2 border-brand-green"
                  style={{ animation: 'su-ring 1.6s ease-out 0.25s infinite' }}
                />
                <span
                  aria-hidden
                  className="absolute size-24 rounded-full border-2 border-brand-cyan"
                  style={{ animation: 'su-ring 1.6s ease-out 0.7s infinite' }}
                />
                <span
                  className="relative inline-flex size-[92px] items-center justify-center rounded-full text-black"
                  style={{
                    backgroundImage:
                      'linear-gradient(135deg, var(--color-brand-green) 0%, var(--color-brand-teal) 100%)',
                    boxShadow: '0 14px 40px rgba(46,255,151,0.35)',
                    animation: 'su-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) both',
                  }}
                >
                  <svg width="50" height="50" viewBox="0 0 52 52" fill="none" aria-hidden>
                    <path
                      d="M14 27 L23 36 L39 18"
                      stroke="#0a0a0a"
                      strokeWidth={5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={60}
                      strokeDashoffset={60}
                      style={{
                        animation:
                          'su-draw 0.45s cubic-bezier(0.65,0,0.45,1) 0.55s forwards',
                      }}
                    />
                  </svg>
                </span>
              </div>

              <h2
                className="z-[2] text-3xl font-bold sm:text-4xl"
                style={{ animation: 'su-rise 0.6s ease-out 0.5s both' }}
              >
                Заявку надіслано!
              </h2>
              <p
                className="z-[2] max-w-md text-lg leading-relaxed text-muted"
                style={{ animation: 'su-rise 0.6s ease-out 0.66s both' }}
              >
                Дякуємо, {submittedName}. Ми розглянемо твою заявку та звʼяжемось у
                Telegram найближчим часом.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="z-[2] mt-2"
                style={{ animation: 'su-rise 0.6s ease-out 0.82s both' }}
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
