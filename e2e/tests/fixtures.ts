/**
 * Specs import `test` and `expect` from here instead of `@playwright/test`, so every test fails
 * when a page raises an uncaught error or an unhandled promise rejection: Playwright reports both
 * as `pageerror`, which nothing otherwise listens for.
 */
import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend<{ failOnPageError: void }>({
  failOnPageError: [
    async ({ context }, use) => {
      const errors: string[] = [];
      const watch = (page: Page) => page.on('pageerror', (err) => errors.push(`${err.name}: ${err.message}`));
      context.pages().forEach(watch);
      context.on('page', watch);
      await use();
      expect(errors, 'the page raised uncaught errors or unhandled rejections').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
