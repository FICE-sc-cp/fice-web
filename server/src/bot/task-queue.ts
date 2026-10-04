export class TaskQueue {
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  private readonly idleWaiters: (() => void)[] = [];

  constructor(private readonly concurrency: number) {}

  get size(): number {
    return this.active + this.waiting.length;
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.active++;
        task()
          .then(resolve, reject)
          .finally(() => {
            this.active--;
            const next = this.waiting.shift();
            if (next) next();
            else if (this.active === 0) {
              this.idleWaiters.splice(0).forEach((done) => done());
            }
          });
      };
      if (this.active < this.concurrency) start();
      else this.waiting.push(start);
    });
  }

  onIdle(): Promise<void> {
    if (this.size === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }
}
