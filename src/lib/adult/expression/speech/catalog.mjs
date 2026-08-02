import { PRESETS as soft } from './soft.mjs';
import { PRESETS as command } from './command.mjs';
import { PRESETS as praise } from './praise.mjs';
import { PRESETS as shame } from './shame.mjs';
import { PRESETS as dirty } from './dirty.mjs';
import { PRESETS as poetic } from './poetic.mjs';
import { PRESETS as sparse } from './sparse.mjs';
import { PRESETS as aftercare } from './aftercare.mjs';
import { PRESETS as roleplay } from './roleplay.mjs';
import { PRESETS as clinical } from './clinical.mjs';
import { PRESETS as coax } from './coax.mjs';
import { PRESETS as tease } from './tease.mjs';
import { PRESETS as situation } from './situation.mjs';
import { PRESETS as powerVoice } from './powerVoice.mjs';
import { PRESETS as toneExtra } from './toneExtra.mjs';
import { PRESETS as playLink } from './playLink.mjs';
import { PRESETS as culture } from './culture.mjs';
import { PRESETS as voice } from './voice.mjs';
import { PRESETS as emotionTone } from './emotionTone.mjs';
import { PRESETS as characterVoice } from './characterVoice.mjs';
import { PRESETS as bilingual } from './bilingual.mjs';
import { PRESETS as moanStyle } from './moanStyle.mjs';

export var EROTIC_SPEECH_PRESETS = Object.assign(
  {},
  soft, command, praise, shame, dirty, poetic,
  sparse, aftercare, roleplay, clinical, coax, tease,
  situation, powerVoice, toneExtra, playLink, culture, voice,
  emotionTone, characterVoice, bilingual, moanStyle
);

export var EROTIC_SPEECH_IDS = Object.keys(EROTIC_SPEECH_PRESETS);
