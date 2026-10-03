import { describe, it, expect } from 'vitest';
import { contextPostflight, contextPreflight, CONTEXT_RESERVE } from './contextGuard.js';

describe('contextPostflight (F-020 #3)', () => {
  it('passes a whole prompt in a 16k context', () => {
    expect(contextPostflight({ promptTokens: 2700, promptChars: 9000, contextLength: 16384 })).toBeNull();
  });

  it('refuses the SP-2 silent truncation: ctx 2048, a long song read as about half the context', () => {
    // A 4,511-token prompt came back as prompt_eval_count 1,027 with HTTP 200 and a normal reply.
    expect(contextPostflight({ promptTokens: 1027, promptChars: 15000, contextLength: 2048 }))
      .toBe('planner context is 2048, needs about 7500: set OLLAMA_CONTEXT_LENGTH=16384');
  });

  it('refuses a short prompt_tokens even when the reported context looks big enough', () => {
    expect(contextPostflight({ promptTokens: 1027, promptChars: 15000, contextLength: 8192 }))
      .toBe('planner context is 8192, needs about 7500: set OLLAMA_CONTEXT_LENGTH=16384');
  });

  it('refuses when the prompt leaves under the reserve for the reply', () => {
    expect(contextPostflight({ promptTokens: 2700, promptChars: 9000, contextLength: 4096 }))
      .toBe(`planner context is 4096, needs about ${2700 + CONTEXT_RESERVE}: set OLLAMA_CONTEXT_LENGTH=16384`);
  });

  it('refuses when the server does not say how much it read', () => {
    expect(contextPostflight({ promptTokens: null, promptChars: 9000, contextLength: 16384 }))
      .toMatch(/did not report usage.prompt_tokens/);
  });

  it('names an unknown context as such', () => {
    expect(contextPostflight({ promptTokens: 1000, promptChars: 15000, contextLength: null }))
      .toBe('planner context is unknown, needs about 7500: set OLLAMA_CONTEXT_LENGTH=16384');
  });
});

describe('contextPreflight', () => {
  it('passes when nothing is loaded yet or the loaded model has room', () => {
    expect(contextPreflight({ promptChars: 15000, contextLength: null })).toBeNull();
    expect(contextPreflight({ promptChars: 15000, contextLength: 16384 })).toBeNull();
  });

  it('refuses a loaded model whose context is too small before calling it', () => {
    expect(contextPreflight({ promptChars: 15000, contextLength: 2048 }))
      .toBe('planner context is 2048, needs about 7500: set OLLAMA_CONTEXT_LENGTH=16384');
  });
});
