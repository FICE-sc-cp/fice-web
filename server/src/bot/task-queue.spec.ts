import { TaskQueue } from './task-queue';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

describe('TaskQueue', () => {
  it('runs at most `concurrency` tasks at a time, in order', async () => {
    const queue = new TaskQueue(2);
    const gates = [deferred(), deferred(), deferred()];
    const started: number[] = [];

    const runs = gates.map((g, i) =>
      queue.run(async () => {
        started.push(i);
        await g.promise;
        return i;
      }),
    );

    await Promise.resolve();
    expect(started).toEqual([0, 1]);
    expect(queue.size).toBe(3);

    gates[0].resolve();
    await runs[0];
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2]);

    gates[1].resolve();
    gates[2].resolve();
    expect(await Promise.all(runs)).toEqual([0, 1, 2]);
    await queue.onIdle();
    expect(queue.size).toBe(0);
  });

  it('keeps going after a task fails', async () => {
    const queue = new TaskQueue(1);
    const failed = queue.run(() => Promise.reject(new Error('boom')));
    const ok = queue.run(() => Promise.resolve('ok'));

    await expect(failed).rejects.toThrow('boom');
    await expect(ok).resolves.toBe('ok');
  });
});
