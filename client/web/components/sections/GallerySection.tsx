import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { RevealGroup } from "@/components/ui/Reveal";

const COLUMNS = [
  [
    { src: "/projects-main-photo.jpg", grow: 2 },
    { src: "/merch-main-photo.jpg", grow: 3 },
  ],
  [
    { src: "/photo-3.png", grow: 3 },
    { src: "/photo-4.png", grow: 2 },
  ],
  [
    { src: "/photo-5.png", grow: 1 },
    { src: "/photo-6.png", grow: 1 },
  ],
  [
    { src: "/photo-7.png", grow: 2 },
    { src: "/projects-main-photo.jpg", grow: 3 },
  ],
];

export function GallerySection() {
  return (
    <section className="relative isolate pt-20 pb-40 lg:pt-28 lg:pb-56">
      <Glow
        color="#00E3F3"
        className="left-1/2 bottom-0 h-[28rem] w-[48rem] -translate-x-1/2 translate-y-1/5 -ml-[14rem] rotate-30"
      />
      <Glow
        color="#FF791B"
        className="left-1/2 bottom-0 h-[22rem] w-[34rem] -translate-x-1/5 -translate-y-1/6 ml-[6rem] -rotate-45"
      />

      <Container>
        <RevealGroup className="grid h-[44rem] grid-cols-2 grid-rows-2 gap-3 sm:flex sm:h-[34rem] sm:gap-4 lg:h-[40rem]">
          {COLUMNS.map((column, c) => (
            <div key={c} className="flex flex-1 flex-col gap-3 sm:gap-4">
              {column.map(({ src, grow }) => (
                <div
                  key={src}
                  style={{ flexGrow: grow, flexBasis: 0 }}
                  className="group relative overflow-hidden rounded-lg bg-surface"
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
              ))}
            </div>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}
