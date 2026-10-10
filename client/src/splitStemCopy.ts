/** What a split stem's KEEP AS LAYER / USE AS <LAYER> TAKE will do, stated before the click. Pure. */
import { editConsequence, type EditConsequence } from './scoreEnds';

export const stemClaimLine = (layerName: string, nextVersion: number, scoreOpen: boolean): EditConsequence =>
  editConsequence(`keep adds a lane · use saves ${layerName.toLowerCase()} v${nextVersion}`, scoreOpen);
