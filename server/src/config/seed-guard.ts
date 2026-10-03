export function destructiveSeedRefusal(
  env: Record<string, string | undefined>,
): string | null {
  if (env.APP_ENV?.trim() === 'production') {
    return 'Refusing to run the demo seed: APP_ENV=production. It deletes every table.';
  }
  if (env.ALLOW_DESTRUCTIVE_SEED !== '1') {
    return 'Refusing to run the demo seed: it deletes every table. Set ALLOW_DESTRUCTIVE_SEED=1 to confirm on a dev database.';
  }
  return null;
}
