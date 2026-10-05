/** What a split stem's REPLACE / ADD LAYER will do (extract-to-layer), stated before the click. Pure. */
import { editConsequence, type EditConsequence } from './scoreEnds';

export const stemClaimLine = (nextVersion: number, scoreOpen: boolean): EditConsequence =>
  editConsequence(`replace will save as v${nextVersion} · add will create a new layer`, scoreOpen);
