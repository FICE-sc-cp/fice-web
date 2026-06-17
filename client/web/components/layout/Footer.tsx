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
          <iframe
            title="Розташування — ФІОТ, корпус 18 КПІ"
            src="https://maps.google.com/maps?q=%D0%9A%D0%9F%D0%86%20%D0%BA%D0%BE%D1%80%D0%BF%D1%83%D1%81%2018%20%D0%A4%D0%86%D0%9E%D0%A2&z=16&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="size-48 rounded-lg border-0"
          />
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
