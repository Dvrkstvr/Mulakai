import { useState } from 'react';
import { useGenerationStore } from './generationStore';
import { useEtaStore } from './etaStore';

/** The shared shape of every Create commit: start the generation, surface a failed submit here
 * (a full queue, say — and clear its card), otherwise hand off to the Library's GeneratingCard
 * and tell the ETA store which bucket this wait belongs to (`etaKey`, see recipeCopy.ts).
 * `start` resolves with the new job's key; the server queues it behind whatever runs. */
export function useCreateSubmit(onBack: () => void, etaKey: string) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (start: () => Promise<string>) => {
    setError('');
    setSubmitting(true);
    try {
      const key = await start();
      const job = useGenerationStore.getState().jobs.find((j) => j.key === key);
      if (job?.stage === 'failed') {
        setError(job.error ?? 'generation failed');
        useGenerationStore.getState().dismiss(key);
        return;
      }
      if (job) useEtaStore.getState().expect(etaKey, job.startedAt);
      onBack(); // the library's GeneratingCard takes it from here
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return { submitting, error, submit };
}
