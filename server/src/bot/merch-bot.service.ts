import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MerchConfig, Prisma } from '@prisma/client';
import { Bot, GrammyError } from 'grammy';
import { errorMessage } from '../common/log-safe';
import { isProduction } from '../config/env.validation';
import { PrismaService } from '../database/prisma.service';
import { isUnknownMemberError } from './bot.service';
import { PollingStatus, PollingSupervisor } from './polling';

const CALL_TIMEOUT_S = 60;
const CHECK_TIMEOUT_MS = 5_000;
const ADMIN_CACHE_MS = 5 * 60_000;
const ADMIN_CACHE_MAX = 5_000;

type GrammySignal = Parameters<Bot['api']['getChatMember']>[2];

/**
 * Fourth bot, @merch_ficebot: transport, cached shop config, admin check and
 * kick(). It knows nothing about orders, so every merch service can depend on it
 * and AppService can read its health without importing the merch module.
 */
@Injectable()
export class MerchBotService
  implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(MerchBotService.name);
  readonly telegram?: Bot;
  private polling?: PollingSupervisor;
  private username?: string;
  private shop?: MerchConfig;
  private readonly admins = new Map<number, { yes: boolean; until: number }>();
  private onKick?: () => void;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const token = config.get<string>('MERCH_BOT_TOKEN')?.trim();
    const apiRoot = config.get<string>('MERCH_BOT_API_ROOT')?.trim(); // local fake only, refused in production
    // grammY's default call timeout is 500 s: one hung call would freeze the sync loop for 8 minutes.
    this.telegram = token
      ? new Bot(token, {
          client: {
            timeoutSeconds: CALL_TIMEOUT_S,
            ...(apiRoot ? { apiRoot } : {}),
          },
        })
      : undefined;
  }

  get enabled(): boolean {
    return !!this.telegram;
  }

  getUsername(): string | undefined {
    return this.username;
  }

  /** `${PUBLIC_WEB_URL}/merch-app${path}`, https only, else undefined. */
  appUrl(path = ''): string | undefined {
    const web = this.config
      .get<string>('PUBLIC_WEB_URL')
      ?.trim()
      .replace(/\/$/, '');
    return web?.startsWith('https://') ? `${web}/merch-app${path}` : undefined;
  }

  onModuleInit() {
    if (!this.telegram) {
      this.logger.warn(
        'MERCH_BOT_TOKEN is not set. Merch bot startup is skipped.',
      );
      return;
    }
    this.telegram.catch((err) => {
      this.logger.error(
        'Failed to handle Telegram update: ' + errorMessage(err.error),
      );
    });
  }

  /** After every onModuleInit, so MerchChatService has added its handlers. */
  async onApplicationBootstrap() {
    if (!this.telegram) return;
    // bot.start() deletes the live webhook; a laptop must never do that to the real bot.
    // Plain getMe with a timeout: bot.init() retries network errors forever and would hang the boot.
    if (!isProduction()) {
      const me = await this.telegram.api
        .getMe(AbortSignal.timeout(CHECK_TIMEOUT_MS) as GrammySignal)
        .catch(() => null);
      if (!me || me.username === 'merch_ficebot') {
        this.logger.error(
          'Merch bot polling is skipped outside production: real bot or no API.',
        );
        return;
      }
    }
    this.polling = new PollingSupervisor(this.telegram, this.logger, {
      allowed_updates: ['message', 'callback_query', 'my_chat_member'],
      onStart: async (info) => {
        this.username = info.username;
        this.logger.log(`Merch bot started as @${info.username}`);
        const url = this.appUrl();
        if (!url) return;
        await this.telegram?.api
          .setChatMenuButton({
            menu_button: { type: 'web_app', text: 'Каталог', web_app: { url } },
          })
          .catch((err) => {
            this.logger.warn(
              'Failed to set merch menu button: ' + errorMessage(err),
            );
          });
      },
    });
    this.polling.start();
    this.kick(); // cards that waited through the restart; the sync loop stays off until here
  }

  /** Cached row; only this process changes it. */
  async shopConfig(): Promise<MerchConfig> {
    // ponytail: one process assumed, the import writes the row before the go-live
    // restart. Read it on every call if a second writer ever appears.
    if (this.shop) return this.shop;
    const row = await this.prisma.merchConfig.findUniqueOrThrow({
      where: { id: 1 },
    });
    // An update that finished during this read wins over the older row.
    return (this.shop ??= row);
  }

  async updateShopConfig(
    data: Prisma.MerchConfigUpdateInput,
  ): Promise<MerchConfig> {
    this.shop = await this.prisma.merchConfig.update({
      where: { id: 1 },
      data,
    });
    return this.shop;
  }

  /** administrator or creator of the bound chat. 503 when Telegram fails, never "no". */
  async isShopAdmin(userId: number): Promise<boolean> {
    if (this.config.get<string>('AUTH_DISABLED') === 'true') return true;
    if (!this.telegram) return false;
    const { adminChatId } = await this.shopConfig();
    if (!adminChatId) return false;

    const cached = this.admins.get(userId);
    if (cached && cached.until > Date.now()) return cached.yes;

    let yes = false;
    try {
      const member = await this.telegram.api.getChatMember(
        Number(adminChatId),
        userId,
        AbortSignal.timeout(CHECK_TIMEOUT_MS) as GrammySignal,
      );
      yes = member.status === 'administrator' || member.status === 'creator';
    } catch (err) {
      if (!(err instanceof GrammyError && isUnknownMemberError(err))) {
        this.logger.warn(
          `Failed to check merch admin ${userId}: ${errorMessage(err)}`,
        );
        throw new ServiceUnavailableException(
          'Не вдалося перевірити права через Telegram. Спробуйте ще раз за хвилину.',
        );
      }
    }
    // ponytail: the whole map goes at the cap, which costs one getChatMember per
    // active admin. An LRU if the map ever turns over often.
    if (this.admins.size >= ADMIN_CACHE_MAX) this.admins.clear();
    this.admins.set(userId, { yes, until: Date.now() + ADMIN_CACHE_MS });
    return yes;
  }

  clearAdminCache(): void {
    this.admins.clear();
  }

  /** Wakes the sync loop. Set by MerchSyncService, a no-op until then. */
  kick(): void {
    this.onKick?.();
  }

  setKick(fn: () => void): void {
    this.onKick = fn;
  }

  pollingStatus(): PollingStatus {
    return this.polling?.getStatus() ?? 'disabled';
  }

  async onModuleDestroy() {
    await this.polling?.stop();
  }
}
