import type { SongDetail } from './api';
import type { ExportWhat } from './dockRequest';

const WHATS: { id: ExportWhat; label: string }[] = [
  { id: 'mix', label: 'MIX' }, { id: 'stems', label: 'STEMS' }, { id: 'remaster', label: 'REMASTERED MIX' },
  { id: 'midi', label: 'SCORE AS MIDI' },
];

/** EXPORT's WHAT chips. SCORE AS MIDI only for a song YuE2 made: no other engine leaves a score. */
export const exportWhats = (song: Pick<SongDetail, 'engine'>) => WHATS.filter((w) => w.id !== 'midi' || song.engine === 'yue2');
