import { FC, SVGProps } from "react";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import {
  TelegramOutlineIcon,
  PhoneIcon,
  MailIcon,
  LinkedinIcon,
  InstagramIcon,
  YoutubeIcon,
  TwitchIcon,
} from "@/components/ui/icons";

type FooterLink = { Icon: FC<SVGProps<SVGSVGElement>>; text: string };

const YEAR = new Date().getFullYear();

const CONTACTS: FooterLink[] = [
  { Icon: TelegramOutlineIcon, text: "Бот звʼязку" },
  { Icon: PhoneIcon, text: "+380 (66) 177 38 74" },
  { Icon: MailIcon, text: "studrada.fice@gmail.com" },
  { Icon: LinkedinIcon, text: "Student council FICE" },
];

const SOCIALS: FooterLink[] = [
  { Icon: TelegramOutlineIcon, text: "FICETime" },
  { Icon: InstagramIcon, text: "insta" },
  { Icon: YoutubeIcon, text: "ютуб" },
  { Icon: TwitchIcon, text: "твіч" },
];

function LinkColumn({ title, items }: { title: string; items: FooterLink[] }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xl font-bold text-white">{title}</h3>
      {items.map(({ Icon, text }) => (
        <a
          key={text}
          href="#"
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
      <Glow
        color="#00E3F3"
        className="left-1/2 top-0 h-[22rem] w-[42rem] -translate-x-1/2 -translate-y-1/2"
      />

      <Container className="pt-16">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[auto_1fr_1fr_1fr_auto] lg:items-start lg:gap-8">
          <Image
            src="/logo_white.png"
            alt="Студрада ФІОТ"
            width={160}
            height={87}
            className="h-auto w-32 lg:w-40"
          />
          <LinkColumn title="Контакти" items={CONTACTS} />
          <LinkColumn title="Наші соцмережі" items={SOCIALS} />
          <LinkColumn title="Абітурієнтам" items={SOCIALS} />
          <div className="flex size-48 items-center justify-center rounded-lg bg-zinc-600 px-10 py-16 text-center text-3xl font-bold text-white">
            типу карта
          </div>
        </div>

        <div className="mt-16 border-t border-white/10 py-8">
          <p className="text-sm text-gray-400">
            © {YEAR} Студентська рада ФІОТ. Всі права захищені.
          </p>
        </div>
      </Container>
    </footer>
  );
}
