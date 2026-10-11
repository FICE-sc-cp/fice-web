import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { SleepingFrog } from "@/components/ui/SleepingFrog";
import { TelegramIcon } from "@/components/ui/icons";

export const FICE_TIME_URL = "https://t.me/fice_time";

export function ApplicationsClosedSection() {
  return (
    <section id="form" className="relative isolate scroll-mt-28 py-16 lg:py-24">
      <Glow
        color="#36DFFF"
        className="left-1/2 top-1/2 h-[26rem] w-[44rem] -translate-x-1/2 -translate-y-1/2"
      />

      <Container>
        <div className="mx-auto flex max-w-3xl flex-col items-center rounded-3xl border border-white/5 bg-surface/40 p-6 text-center sm:p-10 lg:p-12">
          <SleepingFrog className="h-auto w-48 sm:w-56" />
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
            Подачу заявок зараз закрито
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
            Наразі ми не приймаємо нові заявки до Студради ФІОТ. Про початок
            наступного набору оголосимо в Telegram-каналі FICE&nbsp;Time —
            підпишись, щоб не пропустити.
          </p>
          <a
            href={FICE_TIME_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-main px-8 py-4 text-lg font-bold text-black transition-opacity hover:opacity-90"
          >
            <span className="size-5 shrink-0">
              <TelegramIcon />
            </span>
            Підписатись на FICE&nbsp;Time
          </a>
          <Link
            href="/#departments"
            className="mt-5 text-base font-semibold text-subtle underline-offset-4 transition-colors hover:text-brand-cyan hover:underline"
          >
            А поки що — познайомся з департаментами
          </Link>
        </div>
      </Container>
    </section>
  );
}
