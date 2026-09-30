export const GENERAL_TOPIC_ID = 1;

export interface DepartmentChat {
  departmentId: string;
  chatId: string;
  topicId?: number;
}

export function messageTopicId(
  message: { is_topic_message?: boolean; message_thread_id?: number },
  chat: { type: string; is_forum?: boolean },
): number | undefined {
  if (message.is_topic_message) return message.message_thread_id;
  if (chat.type === 'supergroup' && chat.is_forum) return GENERAL_TOPIC_ID;
  return undefined;
}

export function matchDepartments(
  chats: DepartmentChat[],
  chatId: number | string,
  topicId: number | undefined,
  isJoin: boolean,
): string[] {
  const id = String(chatId);
  const ids = chats
    .filter(
      (c) =>
        c.chatId === id &&
        (c.topicId === undefined || (!isJoin && c.topicId === topicId)),
    )
    .map((c) => c.departmentId);
  return [...new Set(ids)];
}

export function normalizeChatRef(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const compact = value.replace(/\s+/g, '');
  return compact === '' ? null : compact;
}
