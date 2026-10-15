/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum AppState {
  Capturing = 'Capturing',
  Processing = 'Processing',
  Animating = 'Animating',
  Error = 'Error',
}

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type LoopMode = 'ping-pong' | 'forward' | 'reverse';

export type EmojiStyleId = 
  | 'glossy-3d'
  | 'pixel-art'
  | 'claymation'
  | 'kawaii-anime'
  | 'cyber-sticker'
  | 'vintage-sketch'
  | 'felt-plush';

export interface EmojiStyle {
  id: EmojiStyleId;
  label: string;
  icon: string;
  description: string;
  promptModifier: string;
}

export interface EmojiEmotion {
  id: string;
  label: string;
  emoji: string;
  actionPrompt: string;
}

export interface PresetEmojiDemo {
  id: string;
  title: string;
  emoji: string;
  style: string;
  description: string;
  spriteSheetUrl: string;
  frameDuration: number;
  defaultTransparent: boolean;
}

export type ChatBackgroundTheme = 'dark' | 'discord' | 'slack' | 'light' | 'checker';

export interface CanvasFilter {
  id: 'none' | 'crt' | 'warm-film' | 'cyberpunk' | 'mono' | 'vibrant';
  label: string;
}
