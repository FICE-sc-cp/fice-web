import {
  GENERAL_TOPIC_ID,
  matchDepartments,
  messageTopicId,
  normalizeChatRef,
} from './department-chats';

const GROUP = '-1003994384697';

describe('matchDepartments', () => {
  it('returns every department linked to the same group', () => {
    const chats = [
      { departmentId: 'projects', chatId: GROUP },
      { departmentId: 'education', chatId: GROUP },
      { departmentId: 'media', chatId: '-1000000000001' },
    ];
    expect(matchDepartments(chats, Number(GROUP), undefined, false)).toEqual([
      'projects',
      'education',
    ]);
  });

  it('covers every topic when only the group id is set', () => {
    const chats = [{ departmentId: 'education', chatId: GROUP }];
    expect(matchDepartments(chats, GROUP, 7, false)).toEqual(['education']);
    expect(matchDepartments(chats, GROUP, GENERAL_TOPIC_ID, false)).toEqual([
      'education',
    ]);
    expect(matchDepartments(chats, GROUP, undefined, false)).toEqual([
      'education',
    ]);
  });

  it('limits a topic-scoped department to its own topic', () => {
    const chats = [
      { departmentId: 'projects', chatId: GROUP, topicId: 5 },
      { departmentId: 'education', chatId: GROUP, topicId: 7 },
    ];
    expect(matchDepartments(chats, GROUP, 5, false)).toEqual(['projects']);
    expect(matchDepartments(chats, GROUP, 7, false)).toEqual(['education']);
    expect(matchDepartments(chats, GROUP, 9, false)).toEqual([]);
  });

  it('adds joins only to departments that use the whole group', () => {
    const chats = [
      { departmentId: 'projects', chatId: GROUP, topicId: 5 },
      { departmentId: 'education', chatId: GROUP },
    ];
    expect(matchDepartments(chats, GROUP, undefined, true)).toEqual([
      'education',
    ]);
  });

  it('never returns the same department twice', () => {
    const chats = [
      { departmentId: 'education', chatId: GROUP },
      { departmentId: 'education', chatId: GROUP },
    ];
    expect(matchDepartments(chats, GROUP, undefined, false)).toEqual([
      'education',
    ]);
  });

  it('ignores other chats', () => {
    const chats = [{ departmentId: 'education', chatId: GROUP }];
    expect(matchDepartments(chats, -1001, undefined, false)).toEqual([]);
  });
});

describe('messageTopicId', () => {
  it('returns the topic of a topic message', () => {
    expect(
      messageTopicId(
        { is_topic_message: true, message_thread_id: 7 },
        { type: 'supergroup', is_forum: true },
      ),
    ).toBe(7);
  });

  it('treats forum messages outside topics as the General topic', () => {
    expect(messageTopicId({}, { type: 'supergroup', is_forum: true })).toBe(
      GENERAL_TOPIC_ID,
    );
  });

  it('does not mistake reply threads in normal groups for topics', () => {
    expect(
      messageTopicId({ message_thread_id: 42 }, { type: 'supergroup' }),
    ).toBeUndefined();
    expect(messageTopicId({}, { type: 'group' })).toBeUndefined();
  });
});

describe('normalizeChatRef', () => {
  it('removes spaces and turns an empty value into null', () => {
    expect(normalizeChatRef(' -1003994384697 ')).toBe('-1003994384697');
    expect(normalizeChatRef('-1003994384697 / 12')).toBe('-1003994384697/12');
    expect(normalizeChatRef('   ')).toBeNull();
    expect(normalizeChatRef(null)).toBeNull();
    expect(normalizeChatRef(undefined)).toBeUndefined();
  });
});
