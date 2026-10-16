import { PartialType, PickType } from '@nestjs/swagger';
import { CreateChannelPostDto } from './create-channel-post.dto';

/** `imageUrl: null` removes the media (also a photo taken from the chat), `buttonUrl: null` the button. */
export class UpdateChannelPostDto extends PartialType(
  PickType(CreateChannelPostDto, [
    'text',
    'publishAt',
    'imageUrl',
    'buttonText',
    'buttonUrl',
  ] as const),
) {}
