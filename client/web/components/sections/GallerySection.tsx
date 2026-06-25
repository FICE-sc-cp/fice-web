import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Glow } from "@/components/ui/Glow";
import { RevealGroup } from "@/components/ui/Reveal";

const COLUMNS = [
  [2, 3],
  [3, 2],
  [1, 1],
  [2, 3],
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
        <RevealGroup className="flex h-[26rem] gap-3 sm:h-[34rem] sm:gap-4 lg:h-[40rem]">
          {COLUMNS.map((column, c) => (
            <div key={c} className="flex flex-1 flex-col gap-3 sm:gap-4">
              {column.map((grow, r) => (
                <div
                  key={r}
                  style={{ flexGrow: grow, flexBasis: 0 }}
                  className="group relative overflow-hidden rounded-lg bg-stone-300"
                >
                  <Image
                    src="/placeholder-for-fundraisers-and-events.png"
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
