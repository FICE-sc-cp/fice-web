import Image from 'next/image';
import { Container } from '@/components/ui/Container';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Glow } from '@/components/ui/Glow';
import { cn } from '@/lib/utils';

const DESCRIPTION =
  'Короткий опис події або оновлення для студентів і партнерів. Текст має швидко пояснювати, що відбулося і чому це важливо. Деталі можна знайти за посиланням нижче.';

const FUNDRAISERS = [
  { fill: 'bg-gradient-orange', current: '70 000', goal: '110 000', pct: 64, closed: false, hasImage: false },
  { fill: 'bg-gradient-blue', current: '70 000', goal: '110 000', pct: 64, closed: false, hasImage: true },
  { fill: 'bg-gradient-magenta', current: '100 000', goal: '100 000', pct: 100, closed: true, hasImage: true },
];

export function FundraisersSection() {
  return (
    <section
      id="charity"
      className="relative isolate scroll-mt-28 py-20 lg:py-28"
    >
      <Glow
        color="#FF791B"
        className="bottom-0 left-1/2 h-[24rem] w-[40rem] -translate-x-1/2 translate-y-1/2 ml-[16rem]"
      />
      <Container>
        <SectionHeader
          title="Наші збори"
          subtitle="Донати наближають перемогу"
          gradient="bg-gradient-magenta"
        />

        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {FUNDRAISERS.map((item, i) => (
            <article
              key={i}
              className="flex flex-col gap-6 rounded-lg border border-border p-6"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-stone-300">
                {item.hasImage && (
                  <Image
                    src="/placeholder-for-fundraisers-and-events.png"
                    alt="Збір"
                    fill
                    sizes="(min-width: 1024px) 24rem, 100vw"
                    className="object-cover"
                  />
                )}
                <span
                  className={cn(
                    'absolute right-4 top-4 inline-flex items-center gap-3 rounded-lg px-5 py-2.5 text-lg font-bold text-black',
                    item.closed ? 'bg-brand-red/30' : 'bg-brand-green/30',
                  )}
                >
                  <span
                    className={cn(
                      'size-3 rounded-full',
                      item.closed ? 'bg-brand-red' : 'bg-brand-green',
                    )}
                  />
                  {item.closed ? 'Закритий' : 'Активний'}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-6">
                <div className="flex flex-1 flex-col gap-2">
                  <h3 className="text-xl font-bold text-white">На пікап</h3>
                  <p className="text-xl font-medium leading-6 text-white">
                    {DESCRIPTION}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-700">
                    <div
                      className={cn('h-full rounded-full', item.fill)}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xl text-white">
                    <span>{item.current}</span>
                    <span>{item.goal}</span>
                  </div>
                </div>

                {item.closed ? (
                  <span className="rounded-lg bg-gray-400 px-7 py-3.5 text-center text-xl font-bold text-neutral-600">
                    Збір закритий
                  </span>
                ) : (
                  <a
                    href="#"
                    className={cn(
                      'rounded-lg px-7 py-3.5 text-center text-xl font-bold text-black transition-opacity hover:opacity-90',
                      item.fill,
                    )}
                  >
                    Задонатити
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-14 flex justify-center">
          <button
            type="button"
            className="rounded-2xl bg-neutral-600/40 px-16 py-5 text-2xl font-bold text-white transition-colors hover:bg-neutral-600/60 lg:text-3xl"
          >
            Переглянути всі
          </button>
        </div>
      </Container>
    </section>
  );
}
