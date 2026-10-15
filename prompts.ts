/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EmojiStyle, EmojiEmotion, PresetEmojiDemo } from './types';

export const EMOJI_STYLES: EmojiStyle[] = [
  {
    id: 'glossy-3d',
    label: '3D Glossy',
    icon: '🟡',
    description: 'Juicy 3D animated emoji with soft reflections and smooth shading',
    promptModifier: 'in modern 3D glossy animated emoji style (like Apple Fluent 3D emoji), with smooth specular highlights, rich vibrant colors, isolated on solid white background.',
  },
  {
    id: 'pixel-art',
    label: 'Pixel Emote',
    icon: '👾',
    description: 'Crisp 16-bit retro video game sprite emote',
    promptModifier: 'in retro 16-bit pixel art emote style, sharp clean pixel outlines, vibrant palette, iconic game sprite animation on solid white background.',
  },
  {
    id: 'claymation',
    label: 'Claymation',
    icon: '🍌',
    description: 'Handmade stop-motion plasticine clay sticker',
    promptModifier: 'in charming stop-motion polymer clay claymation style, tactile finger-pressed clay textures, studio lighting, isolated on solid white background.',
  },
  {
    id: 'kawaii-anime',
    label: 'Kawaii Anime',
    icon: '🎌',
    description: 'Chibi sticker with bold lines and blush cheeks',
    promptModifier: 'in cute Japanese kawaii chibi sticker style, bold cartoon outlines, pastel and bright tones, expressive anime eyes, isolated on solid white background.',
  },
  {
    id: 'cyber-sticker',
    label: 'Cyber Neon',
    icon: '🕶️',
    description: 'Futuristic glowing neon holographic sticker',
    promptModifier: 'in futuristic cyberpunk holographic sticker style, subtle neon rim glow and chromatic edges, isolated on clean solid background.',
  },
  {
    id: 'felt-plush',
    label: 'Felt Plush',
    icon: '🧵',
    description: 'Cozy needle-felted wool craft character',
    promptModifier: 'in adorable needle-felted wool craft stop-motion puppet style, soft fuzzy textures, warm studio macro photography, isolated on solid white background.',
  },
];

export const EMOJI_EMOTIONS: EmojiEmotion[] = [
  {
    id: 'party',
    label: 'Party Dance',
    emoji: '🥳',
    actionPrompt: 'dancing joyfully, waving arms up and down with colorful party confetti falling around',
  },
  {
    id: 'mind-blown',
    label: 'Mind Blown',
    emoji: '🤯',
    actionPrompt: 'eyes widening with jaw dropped, head popping open with a cartoon rainbow explosion and sparkling stars',
  },
  {
    id: 'crying-laughing',
    label: 'Tears of Joy',
    emoji: '😂',
    actionPrompt: 'laughing hysterically, eyes squeezed shut, shaking with laughter and crying shooting streams of joy tears',
  },
  {
    id: 'cool-wink',
    label: 'Cool Sunglasses',
    emoji: '😎',
    actionPrompt: 'wearing cool black sunglasses, tilting head with a confident grin and flashing a bright star sparkle wink',
  },
  {
    id: 'melting',
    label: 'Melting Puddle',
    emoji: '🫠',
    actionPrompt: 'smiling awkwardly as the face slowly melts down into a puddle like liquid butter, then bubbling back up',
  },
  {
    id: 'heart-eyes',
    label: 'Love & Hearts',
    emoji: '😍',
    actionPrompt: 'glowing with heart-shaped eyes beating in and out, blowing animated red hearts toward the viewer',
  },
  {
    id: 'shock-sneeze',
    label: 'Shock / Jolt',
    emoji: '🫨',
    actionPrompt: 'face quivering with buildup, then shaking with an explosive cartoon shockwave jolt and calming down',
  },
  {
    id: 'sleepy-snore',
    label: 'Sleepy Snore',
    emoji: '😴',
    actionPrompt: 'drifting asleep, head nodding down, inhaling a growing snot bubble that pops and wakes it with a startle',
  },
  {
    id: 'fire-powerup',
    label: 'Super Surge',
    emoji: '🔥',
    actionPrompt: 'powering up into super saiyan mode, glowing with golden fiery aura flames and intense determined expression',
  },
];

export const PRESET_EMOJI_DEMOS: PresetEmojiDemo[] = [
  {
    id: 'banana-party',
    title: 'Party Banana',
    emoji: '🍌',
    style: '3D Glossy',
    description: 'Cool shades, bouncy groove & confetti bursts',
    spriteSheetUrl: '/src/assets/images/emoji_banana_party_1792062297362.jpg',
    frameDuration: 110,
    defaultTransparent: true,
  },
  {
    id: 'mind-blown',
    title: 'Mind Blown',
    emoji: '🤯',
    style: '3D Glossy',
    description: 'Explosive rainbow supernova shock',
    spriteSheetUrl: '/src/assets/images/emoji_mind_blown_1792062298589.jpg',
    frameDuration: 130,
    defaultTransparent: true,
  },
  {
    id: 'cat-vibing',
    title: 'Vibing Kitty',
    emoji: '🐱',
    style: 'Pixel Art',
    description: 'Bouncing to the beat with rainbow headphones',
    spriteSheetUrl: '/src/assets/images/emoji_cat_vibing_1792062300071.jpg',
    frameDuration: 120,
    defaultTransparent: true,
  },
  {
    id: 'banana-cheer',
    title: 'Dancing Banana',
    emoji: '🍌',
    style: 'Cartoon Sticker',
    description: 'Classic happy peel shuffle and wave',
    spriteSheetUrl: '/src/assets/images/demo_spritesheet_banana_1792062264415.jpg',
    frameDuration: 100,
    defaultTransparent: true,
  },
];

export const STARTER_SUBJECTS = [
  {
    id: 'banana',
    title: 'Banana Mascot',
    emoji: '🍌',
    url: '/src/assets/images/preset_banana_mascot_1792062232711.jpg',
    prompt: 'Cute banana mascot figurine',
  },
  {
    id: 'knight',
    title: 'Pixel Knight',
    emoji: '🛡️',
    url: '/src/assets/images/preset_pixel_knight_1792062234407.jpg',
    prompt: 'Heroic golden knight sprite',
  },
  {
    id: 'clay-monster',
    title: 'Clay Monster',
    emoji: '👾',
    url: '/src/assets/images/preset_clay_creature_1792062234917.jpg',
    prompt: 'Cute fluffy clay creature',
  },
  {
    id: 'cyber-cat',
    title: 'Cyber Cat',
    emoji: '🐱',
    url: '/src/assets/images/preset_cyber_cat_1792062234912.jpg',
    prompt: 'Robotic cybernetic feline',
  },
];

export const RANDOM_PROMPTS = [
  'A cute golden puppy wearing tiny chef hat tossing pizza dough with big happy smile',
  'An avocado character taking off sunglasses to reveal sparkling heart eyes',
  'A tiny retro coffee cup steaming up cute animated heart vapor clouds and giggling',
  'A little green frog sipping iced matcha tea through a straw while nodding to lo-fi beats',
  'A fluffy cloud emoji sneezing a little thunderbolt and raining tiny confetti drops',
  'A smiling ghost holding a slice of pepperoni pizza and giving a thumbs up',
  'A glowing neon star doing backflips and shooting rainbow comet trails',
  'A chubby red panda eating bamboo shoots with joyful blush cheeks',
];

export const buildCreativeInstruction = (
  storyPrompt: string,
  originalImage: string | null,
  frameCount: number = 9,
  selectedStyle?: EmojiStyle,
  selectedEmotion?: EmojiEmotion
): string => {
  const styleInstruction = selectedStyle 
    ? `ARTISTIC STYLE: ${selectedStyle.promptModifier}`
    : 'ARTISTIC STYLE: Clean 3D glossy animated emoji sticker style, isolated on clean solid white background with no messy borders.';

  const emotionInstruction = selectedEmotion
    ? `ANIMATED ACTION: ${selectedEmotion.actionPrompt}.`
    : '';

  const corePrompt = storyPrompt.trim() 
    ? storyPrompt 
    : (selectedEmotion ? selectedEmotion.label : 'dancing animated emoji');

  let subjectDirective = '';
  if (originalImage) {
    subjectDirective = `
SUBJECT TO ANIMATE: Transform the character or subject from the provided photo into an expressive animated emoji character. Retain key recognizable features, color identity, and personality.
PRIMARY ACTION: ${corePrompt}. ${emotionInstruction}`;
  } else {
    subjectDirective = `
SUBJECT TO ANIMATE: Create an animated emoji character based on: "${corePrompt}". ${emotionInstruction}`;
  }

  return `
PRIMARY OBJECTIVE: Generate an animated emoji sprite sheet.

${subjectDirective}
${styleInstruction}

MANDATORY SPRITE SHEET RULES:
1. OUTPUT: A single, perfectly square image containing a 3x3 grid (3 rows, 3 columns) of sequential animation frames (Frame 1 at top-left to Frame 9 at bottom-right).
2. ISOLATION: The subject character MUST be centered inside each cell, isolated on a uniform, plain solid white background so that it can be cleanly used as a sticker.
3. MOTION: Each frame must show a distinct, fluid stage of the animation. The motion must be clear and expressive when looped.
4. NO LABELS: Do NOT draw numbers, frame borders, grid lines, watermark text, or letters inside the image. Only draw the character frames.
5. SIZING: Exactly 1024x1024 pixels square.

TIMING INSTRUCTION:
Determine the ideal frame duration in milliseconds for this emoji animation (between 80ms and 300ms). Emojis are punchy, lively, and dynamic.

REQUIRED RESPONSE FORMAT:
Your response must provide:
1. A valid JSON snippet containing: {"frameDuration": <number>}
2. The single 3x3 sprite sheet image.
`;
};
