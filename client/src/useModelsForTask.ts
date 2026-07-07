import { useEffect, useState } from 'react';
import { api, type TaskType } from './api';

/** Model names supporting a given ACE-Step task type, refetched whenever `taskType` changes —
 * same gating pattern RemasterAction.tsx/AddLayerTrigger.tsx use inline. null while loading,
 * [] once loaded if none are downloaded. */
export function useModelsForTask(taskType: TaskType): string[] | null {
  const [models, setModels] = useState<string[] | null>(null);

  useEffect(() => {
    setModels(null);
    api.listModels()
      .then((data) => setModels(data.models.filter((m) => m.supportedTaskTypes.includes(taskType)).map((m) => m.name)))
      .catch(() => setModels([]));
  }, [taskType]);

  return models;
}
