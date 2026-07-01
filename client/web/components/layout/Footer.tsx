import { FC, SVGProps } from "react";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { FooterFrog } from "@/components/ui/FooterFrog";
import {
  TelegramOutlineIcon,
  MailIcon,
  LinkedinIcon,
  InstagramIcon,
  YoutubeIcon,
  TwitchIcon,
  TikTokIcon,
} from "@/components/ui/icons";

type FooterLink = {
  Icon: FC<SVGProps<SVGSVGElement>>;
  text: string;
  link: string;
};

const YEAR = new Date().getFullYear();

const CONTACTS: FooterLink[] = [
  {
    Icon: TelegramOutlineIcon,
    text: "Бот звʼязку",
    link: "https://t.me/fice_robot",
  },
  {
    Icon: MailIcon,
    text: "fiot.studrada@lll.kpi.ua",
    link: "mailto:fiot.studrada@lll.kpi.ua",
  },
  {
    Icon: LinkedinIcon,
    text: "Student council FICE",
    link: "https://www.linkedin.com/company/fice-student-council/",
  },
];

const SOCIALS: FooterLink[] = [
  {
    Icon: TelegramOutlineIcon,
    text: "Telegram",
    link: "https://t.me/fice_time",
  },
  {
    Icon: InstagramIcon,
    text: "Instagram",
    link: "https://www.instagram.com/sr_fiot",
  },
  {
    Icon: YoutubeIcon,
    text: "YouTube",
    link: "https://www.youtube.com/@studentcouncilfice",
  },
  {
    Icon: TwitchIcon,
    text: "Twitch",
    link: "https://www.twitch.tv/studentcouncilfice",
  },
  {
    Icon: TikTokIcon,
    text: "TikTok",
    link: "https://www.tiktok.com/@sr_fiot",
  },
];

const SOCIALS_FOR_APPLICANTS: FooterLink[] = [
  {
    Icon: TelegramOutlineIcon,
    text: "Telegram",
    link: "https://t.me/abit_fiot",
  },
  {
    Icon: InstagramIcon,
    text: "Instagram",
    link: "https://www.instagram.com/abit_fiot",
  },
];

function LinkColumn({ title, items }: { title: string; items: FooterLink[] }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xl font-bold text-white">{title}</h3>
      {items.map(({ Icon, text, link }) => (
        <a
          key={text}
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xl text-white transition-opacity hover:opacity-70"
        >
          <span className="size-6 shrink-0">
            <Icon />
          </span>
          {text}
        </a>
      ))}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="relative isolate overflow-hidden bg-neutral-700/20">
      <Container className="pt-16">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[auto_1fr_1fr_1fr_auto] lg:items-start lg:gap-8">
          <div className="flex max-w-[18rem] flex-col gap-4">
            <Image
              src="/logo_white.png"
              alt="Студрада ФІОТ"
              width={160}
              height={87}
              className="h-auto w-32 lg:w-40"
            />
            <div className="flex flex-col gap-1 text-sm leading-snug">
              <br />
              <p className="font-semibold text-white">
                Факультет інформатики та обчислювальної техніки
              </p>
              <p className="text-gray-400">
                Національний технічний університет України «Київський
                політехнічний інститут імені Ігоря Сікорського»
              </p>
            </div>
          </div>
          <LinkColumn title="Контакти" items={CONTACTS} />
          <LinkColumn title="Наші соцмережі" items={SOCIALS} />
          <LinkColumn title="Абітурієнтам" items={SOCIALS_FOR_APPLICANTS} />
          <iframe
            title="Розташування — ФІОТ, корпус 18 КПІ"
            src="https://maps.google.com/maps?q=%D0%9A%D0%9F%D0%86%20%D0%BA%D0%BE%D1%80%D0%BF%D1%83%D1%81%2018%20%D0%A4%D0%86%D0%9E%D0%A2&z=16&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="size-48 rounded-lg border-0"
          />
        </div>

        <div className="relative mt-16 border-t border-white/10 py-8">
          <FooterFrog />
          <p className="text-sm text-gray-400">
            © {YEAR} Студентська рада ФІОТ. Всі права захищені.
          </p>
        </div>
      </Container>
    </footer>
  );
}
