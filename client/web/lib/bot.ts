export const USER_BOT_USERNAME = (process.env.NEXT_PUBLIC_USER_BOT_USERNAME ?? '')
  .trim()
  .replace(/^@/, '');
