import { NewsCategory } from '@prisma/client';

export class NewsEntity {
  id: string;
  title: string;
  publishDate: Date;
  details: string | null;
  image: string | null;
  category: NewsCategory | null;
  eventDate: Date | null;
  eventLocation: string | null;
}
