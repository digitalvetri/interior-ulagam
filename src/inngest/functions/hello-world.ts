import { inngest } from '@/inngest/client';

export const helloWorld = inngest.createFunction(
  { id: 'hello-world', name: 'Hello World' },
  { event: 'test/hello.world' },
  async ({ event, step }) => {
    const greeting = await step.run('greet', async () => {
      return `Hello, ${event.data.name ?? 'InterioOS'}!`;
    });
    return { greeting };
  }
);
