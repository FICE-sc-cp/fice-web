import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { readdir, readFile, rename, stat, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { imageDimensions } from '../src/upload/image-dimensions';
import {
  ADMIN_IMAGE_PROFILE,
  isProcessableImage,
  PUBLIC_IMAGE_PROFILE,
  reencodeImage,
} from '../src/upload/image-processing';
import { needsReencode } from '../src/upload/reencode-plan';
import { UPLOAD_DIR } from '../src/upload/upload.constants';

const dryRun = process.argv.includes('--dry-run');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

async function restore(path: string, original: Buffer) {
  const tmp = `${path}.restore`;
  await writeFile(tmp, original);
  await rename(tmp, path);
}

async function main() {
  const publicFiles = new Set(
    (await prisma.publicUpload.findMany({ select: { filename: true } })).map(
      (f) => f.filename,
    ),
  );
  const names = (await readdir(UPLOAD_DIR)).sort();
  let changed = 0;
  let saved = 0;

  for (const name of names) {
    const ext = extname(name).toLowerCase();
    if (!isProcessableImage(ext)) continue;
    const path = join(UPLOAD_DIR, name);
    if (!(await stat(path)).isFile()) continue;

    const original = await readFile(path);
    const size = imageDimensions(original);
    if (!size) continue;
    const profile = publicFiles.has(name)
      ? PUBLIC_IMAGE_PROFILE
      : ADMIN_IMAGE_PROFILE;
    if (!needsReencode({ name, bytes: original.length, ...size }, profile)) {
      continue;
    }

    const label = `${name} ${size.width}x${size.height} ${kb(original.length)}`;
    if (dryRun) {
      console.log(`would re-encode ${label}`);
      continue;
    }
    try {
      const after = await reencodeImage(path, ext, profile);
      if (after >= original.length) {
        await restore(path, original);
        console.log(`kept         ${label}`);
        continue;
      }
      changed++;
      saved += original.length - after;
      console.log(`re-encoded   ${label} -> ${kb(after)}`);
    } catch (err) {
      await restore(path, original);
      console.log(
        `failed       ${label}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(
    dryRun
      ? 'dry run, nothing changed'
      : `re-encoded ${changed} file(s), saved ${kb(saved)}`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
