import { defineJob } from '@/jobs/define';

export const helloWorld = defineJob(
  { id: 'hello-world', name: 'Hello World' },
  { event: 'test/hello.world' },
  async ({ event, step }) => {
    const greeting = await step.run('greet', async () => {
      const { name } = (event.data ?? {}) as { name?: string };
      return `Hello, ${name ?? 'InterioOS'}!`;
    });
    return { greeting };
  }
);
