/** Style vocabularies for turning an ACE-Step caption into YuE2 style tags (PLAN.md "ANALYZE
 * AUDIO on COVER · YUE2"). Seeded from ACE-Step's own caption guide (docs/ace-step-1.5/GUIDE.md,
 * "Common Dimensions for Caption Writing") and the words its example captions use. Data only;
 * all lowercase, multi-word heads written with single spaces. */

const words = (s: string): Set<string> => new Set(s.trim().split(/\s*\|\s*/));

export interface Category {
  /** Words or phrases that name the thing: the end of a tag. */
  heads: Set<string>;
  /** Words allowed directly before a head, as part of the same tag (at most two). */
  modifiers: Set<string>;
}

export const GENRE: Category = {
  heads: words(`pop | rock | indie | punk | metal | grunge | shoegaze | emo | hip hop | trap | drill | r&b | rnb
    | soul | neo soul | funk | disco | house | techno | trance | edm | dubstep | drum and bass | dnb | jungle | garage
    | electronic | electronica | ambient | downtempo | lo-fi | lofi | jazz | swing | bebop | bossa nova | blues | gospel
    | folk | country | bluegrass | americana | classical | orchestral | cinematic | soundtrack | reggae | reggaeton
    | dancehall | afrobeat | afrobeats | latin | salsa | samba | cumbia | flamenco | tango | ballad | power ballad
    | opera | musical theatre | city pop | industrial | new wave | post-punk | idm | breakbeat | big band | eurodance
    | phonk | chiptune | hyperpop | synthwave | vaporwave | chillwave | mandopop | cantopop | singer-songwriter
    | bedroom pop | dream pop | trip hop | grime | ska | motown | doo-wop | anime`),
  modifiers: words(`contemporary | modern | classic | vintage | retro | 60s | 70s | 80s | 90s | 2000s | 2010s | latin
    | brazilian | african | caribbean | celtic | nordic | alternative | indie | experimental | progressive | melodic
    | acoustic | electronic | orchestral | cinematic | lo-fi | chill | dance | soft | hard | deep | heavy | pop | rock
    | folk | jazz | soul | synth | dark | dream | bedroom | power | lounge | gothic | psychedelic | underground
    | atmospheric | minimal | old-school | futuristic`),
};

/** `samba-pop`, `j-rock`, `k-pop`, `nu-metal`, `synthwave`, `metalcore`, `dubstep`… */
export const GENRE_COMPOUND = /^[a-z0-9]+(-[a-z0-9]+)*-(pop|rock|hop|metal|punk|soul|funk|house|jazz|folk|wave|core|step|gaze)$|^[a-z]+(wave|core|step|gaze)$/;

/** The voice itself; `vocalist`, `singer` and the rest normalise to `vocal`, the rap ones to `rap`. */
export const VOICE_HEADS = words('vocal | vocals | vocalist | voice | singer | singing | lead vocal | lead vocals');
export const RAP_HEADS = words('rap | rapper | rapping | rap verses | rap vocals');
export const GENDERS = words('male | female | boy | girl | child | androgynous');
export const VOICE_MODIFIERS = words(`warm | breathy | powerful | clear | soft | gentle | raspy | husky | smooth | emotive
  | emotional | soaring | airy | soulful | sultry | deep | high-pitched | low | bright | ethereal | whispery | whispered
  | gritty | passionate | intimate | confident | theatrical | delicate | youthful | mature | rich | strong | expressive
  | dreamy | haunting | falsetto | operatic | nasal | tender | sweet | melancholic | rough | angelic | crisp | light
  | dark | resonant | velvety | silky | fragile | playful | aggressive | assertive | energetic | lead | layered | processed | auto-tuned | autotuned`);
/** Vocal delivery worth a tag of its own, after the instruments: caption phrase → tag. */
export const VOCAL_TRAITS: Record<string, string> = {
  falsetto: 'falsetto', 'auto-tune': 'auto-tune', autotune: 'auto-tune', vocoder: 'vocoder', choir: 'choir',
  'spoken word': 'spoken word', whispers: 'whispered vocals',
  harmonies: 'harmonies', yodel: 'yodel', growls: 'growled vocals', screams: 'screamed vocals',
  belting: 'belting', 'clear diction': 'clear diction', vibrato: 'vibrato',
};

export const MOODS = words(`melancholic | melancholy | uplifting | energetic | high-energy | dreamy | dark | nostalgic
  | euphoric | intimate | somber | sombre | sad | happy | joyful | cheerful | upbeat | triumphant | epic | dramatic
  | romantic | sentimental | emotional | hopeful | bittersweet | haunting | eerie | mysterious | moody | atmospheric
  | chill | relaxed | laid-back | mellow | calm | peaceful | serene | tender | playful | whimsical | aggressive | angry
  | intense | anthemic | celebratory | festive | adventurous | exhilarating | hypnotic | sensual | groovy | danceable
  | reflective | introspective | wistful | lonely | confident | defiant | rebellious | ethereal | explosive | brooding
  | heartfelt | carefree | lively | vibrant | ominous | tense | soothing | gloomy | longing | yearning | fierce
  | majestic | spiritual | cozy | sultry | quirky | fun | nocturnal | urban | driving | frenetic | raw`);

export const INSTRUMENT: Category = {
  heads: words(`drum machine | drum kit | drum beat | drums | drum | 808 | 808s | sub-bass | sub bass | bassline | bass line
    | bass | double bass | upright bass | hi-hats | hi-hat | hihats | snare | kick | cymbals | percussion | piano
    | keys | rhodes | electric piano | organ | hammond organ | synth | synths | synthesizer | synthesizers | synth pad
    | synth pads | pad | pads | synth lead | synth bass | arpeggios | arpeggiator | guitar | guitars | strings
    | string section | violin | violins | viola | cello | cellos | orchestra | brass | brass section | horns | horn
    | trumpet | trumpets | trombone | trombones | saxophone | sax | flute | clarinet | oboe | bassoon | harp | banjo
    | mandolin | ukulele | accordion | harmonica | marimba | xylophone | glockenspiel | bells | vibraphone | celesta
    | music box | shaker | tambourine | congas | bongos | cajon | tabla | sitar | koto | erhu | guzheng | pipa
    | shamisen | bagpipes | fiddle | steel drums | timpani | turntables | sampler | mellotron | theremin`),
  modifiers: words(`acoustic | electric | nylon-string | steel-string | twelve-string | distorted | overdriven | clean
    | chorused | fuzzy | fuzz | muted | palm-muted | slide | bowed | plucked | pizzicato | upright | grand | felt
    | detuned | analog | vintage | deep | heavy | crisp | punchy | warm | round | rounded | bright | lush | airy
    | shimmering | soft | gentle | driving | rolling | tight | funky | squelchy | gritty | dusty | jangly | twangy
    | lo-fi | muffled | sparse | restrained | steady | booming | thumping | synth | synthesized | orchestral | live
    | rhythmic | melodic | arpeggiated | sustained | layered | chugging | fingerpicked | strummed | sub | 808
    | electronic | programmed | jazz | rock | piano | string | brass | bass | drum | reverb-drenched | reverbed
    | sweeping | swelling | staccato | delicate | fat | thick | wobbly | trap | glitchy | sliding | tape | toy
    | pulsing | throbbing | resonant | walking | slap | fretless | modular | retro | 80s | chiptune`),
};

/** Words that mean the phrase after them is absent. */
export const NEGATIONS = words('no | without | minus | lacking | absent | zero');

/** Tokens a YuE2 cover's style must not carry: the score fixes tempo, key and meter, and VOCAL
 * LANGUAGE is prefixed server-side. Used to filter a caption that was already a tag list. */
export const LANGUAGE_WORDS = words(`english | chinese | mandarin | cantonese | japanese | korean | spanish | french
  | german | italian | portuguese | russian | hindi | arabic | instrumental`);
