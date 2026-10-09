/**
 * The one draft (D-086, F-043): the sidebar's fields, its `rev`, what the person touched and what the assistant
 * just filled (CH-4, CH-6). C6's Guided Create becomes its second reader. Hand edits show at once and are PUT
 * debounced with the `rev` they were made on; a 409 (a reply landed meanwhile) rebases them onto the server's
 * draft, so the hand edit wins. CREATE SONG's rules stay on the server: `blockers` is what it says.
 */
import { create } from 'zustand';
import { chatApi, type ChatDraft, type ChatDraftFields, type ChatDraftKey, type ChatDraftSaved } from './api/chat';
import { chatConvergeApi, type ChatMessageViewC2, type ChatRecipeBodyC2, type UndoResult } from './api/chatConverge';
import { justFilled } from './chatUndo';

export const DRAFT_SAVE_MS = 600;
const MAX_REBASES = 3;

/** How a field reads: just filled by the assistant (sky, ASSISTANT, old value struck), the person's (YOURS), or plain. */
export type FieldMark = 'assistant' | 'yours' | 'plain';
type Filled = Partial<Record<ChatDraftKey, { old: unknown }>>;

interface ChatDraftStore {
  threadId: string | null;
  /** The server's last draft. */
  draft: ChatDraft | null;
  /** Hand edits not saved yet (shown over `draft`). */
  pending: Partial<ChatDraftFields>;
  blockers: string[];
  /** The server's note on the draft when set (an unknown `draft_v` read as empty, …): shown as it is. */
  draftNote: string | null;
  /** Fields the last reply filled, with the value it replaced; cleared on the next SEND or a hand edit of that field. */
  filled: Filled;
  /** The draft `rev` at which a reply last wrote each field (this session), so an older touch no longer reads YOURS. */
  assistantRev: Partial<Record<ChatDraftKey, number>>;
  error: string | null;
  /** A thread (re)loaded or a reply landed: `changed` = the fields that reply filled (its recipe card's list). With the
   * thread's `messages`, the marks come from the latest recipe's undo record (D-221), so a reload keeps them. */
  hydrate: (threadId: string, view: ChatDraftSaved & { messages?: ChatMessageViewC2[] }, changed?: ChatDraftKey[]) => void;
  /** UNDO TURN (F-059): saves the hand edits first, then the server restores what it may; the marks clear. */
  undo: (messageId: string) => Promise<UndoResult>;
  /** `''` is sent as `null`: the server clears the field. */
  edit: <K extends ChatDraftKey>(key: K, value: ChatDraftFields[K]) => void;
  /** Save the pending edits now (before SEND, so the server's `rev` at SEND covers them). */
  flush: () => Promise<void>;
  clearFilled: () => void;
  clear: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<void> | null = null;
const stopTimer = () => { if (timer) clearTimeout(timer); timer = null; };
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

type DraftView = Pick<ChatDraftStore, 'draft' | 'pending' | 'filled' | 'assistantRev'>;

/** What the sidebar shows: the server's draft with the unsaved hand edits over it. */
export const liveFields = (s: DraftView): ChatDraftFields | null => (s.draft ? { ...s.draft.fields, ...s.pending } : null);

export function fieldMark(s: DraftView, key: ChatDraftKey): FieldMark {
  if (s.filled[key]) return 'assistant';
  if (key in s.pending) return 'yours';
  const touched = s.draft?.touched[key];
  return touched !== undefined && touched > (s.assistantRev[key] ?? -1) ? 'yours' : 'plain';
}

/** Will a reply to a message sent at `sentRev` skip this field? (touched after SEND, CH-6) */
export const skipsAtReply = (s: DraftView, key: ChatDraftKey, sentRev: number): boolean =>
  key in s.pending || (s.draft?.touched[key] ?? -1) > sentRev;

/** The collapsed rail's count (CH-3): fields with a value; ENGINE is fixed (YuE2), so it does not count, nor VOCALS (always set). */
export function filledCount(f: ChatDraftFields | null): number {
  if (!f) return 0;
  return (Object.keys(f) as ChatDraftKey[]).filter((k) => {
    const v = f[k];
    return k !== 'engine' && k !== 'vocals' && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
  }).length;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The rev each field was last filled at by a recipe reply still standing (its undo record), so a touch before that
 * reply reads plain after a reload too. */
const recordRevs = (messages: ChatMessageViewC2[]) => messages.reduce<Partial<Record<ChatDraftKey, number>>>((out, m) => {
  const u = m.kind === 'recipe' && !(m.body as ChatRecipeBodyC2 | null)?.undone ? (m.body as ChatRecipeBodyC2 | null)?.undo : undefined;
  for (const k of u?.fields ?? []) out[k] = Math.max(out[k] ?? -1, u!.rev);
  return out;
}, {});

export const useChatDraftStore = create<ChatDraftStore>((set, get) => {
  async function save(): Promise<void> {
    for (let i = 0; i < MAX_REBASES; i++) {
      const { threadId, draft, pending } = get();
      if (!threadId || !draft || Object.keys(pending).length === 0) return;
      const sent = { ...pending };
      try {
        const res = await chatApi.putChatDraft(threadId, sent, draft.rev);
        if (get().threadId !== threadId) return; // another thread opened meanwhile
        const left = Object.fromEntries(Object.entries(get().pending).filter(([k, v]) => !same(v, sent[k as ChatDraftKey])));
        if (res.conflict) { set({ draft: res.draft, blockers: res.blockers ?? get().blockers }); continue; }
        set({ draft: res.draft, blockers: res.blockers, draftNote: res.draftNote ?? null, pending: left, error: null });
        return;
      } catch (err) {
        set({ error: message(err) }); // kept in `pending`; the next edit or flush tries again
        return;
      }
    }
  }

  return {
    threadId: null, draft: null, pending: {}, blockers: [], draftNote: null, filled: {}, assistantRev: {}, error: null,

    hydrate: (threadId, { draft, blockers, draftNote, messages }, changed = []) => set((s) => {
      const kept = s.threadId === threadId;
      const before = kept ? liveFields(s) : null;
      const pending = kept ? s.pending : {};
      const session: Filled = {};
      const assistantRev = { ...(kept ? s.assistantRev : {}), ...(messages ? recordRevs(messages) : {}) };
      for (const k of changed) {
        if (before) session[k] = { old: before[k] };
        assistantRev[k] = Math.max(assistantRev[k] ?? -1, draft.rev);
      }
      // The server's record wins when it has one (reload-proof, D-221); older replies keep the session's marks.
      const recorded = messages ? justFilled(messages, draft) : {};
      const filled = { ...(Object.keys(recorded).length ? recorded : changed.length ? session : kept ? s.filled : {}) };
      for (const k of Object.keys(pending)) delete filled[k as ChatDraftKey]; // an unsaved hand edit reads YOURS
      return { threadId, draft, blockers, draftNote: draftNote ?? null, pending, filled, assistantRev };
    }),

    edit: (key, value) => {
      set((s) => {
        const filled = { ...s.filled };
        delete filled[key];
        return { pending: { ...s.pending, [key]: value === '' ? null : value }, filled };
      });
      stopTimer();
      timer = setTimeout(() => { timer = null; void get().flush(); }, DRAFT_SAVE_MS);
    },

    flush: async () => {
      stopTimer();
      while (inflight) await inflight;
      inflight = save().finally(() => { inflight = null; });
      await inflight;
    },

    undo: async (messageId) => {
      await get().flush();
      const threadId = get().threadId;
      if (!threadId) return { refused: 'no draft is open', code: 'UNDO_REFUSED' };
      const res = await chatConvergeApi.undoTurn(threadId, messageId);
      if ('refused' in res || get().threadId !== threadId) return res;
      // A restored value is whoever's it was before the turn: its assistant rev goes.
      const assistantRev = Object.fromEntries(Object.entries(get().assistantRev).filter(([k]) => !res.restored.includes(k as ChatDraftKey)));
      set({ draft: res.draft, blockers: res.blockers, filled: {}, assistantRev, error: null });
      return res;
    },

    clearFilled: () => set({ filled: {} }),
    clear: () => { stopTimer(); set({ threadId: null, draft: null, pending: {}, blockers: [], draftNote: null, filled: {}, assistantRev: {}, error: null }); },
  };
});
