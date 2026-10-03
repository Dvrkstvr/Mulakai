import { useState } from 'react';
import { useGenerationStore } from './generationStore';
import { useEtaStore } from './etaStore';

/** The shared shape of every Create commit: start the generation, surface a failed submit here
 * (and clear its card), otherwise hand off to the Library's GeneratingCard and tell the ETA store
 * which bucket this wait belongs to (`etaKey`, see recipeCopy.ts). */
export function useCreateSubmit(onBack: () => void, etaKey: string) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (start: () => Promise<void>) => {
    setError('');
    setSubmitting(true);
    try {
      await start();
      const job = useGenerationStore.getState().job;
      if (job?.stage === 'failed') {
        setError(job.error ?? 'generation failed');
        useGenerationStore.getState().dismiss();
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
