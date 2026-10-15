/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { Frame } from "../types";

const apiKey = process.env.API_KEY || (typeof window !== 'undefined' && (window as any).GEMINI_API_KEY) || '';
const ai = new GoogleGenAI({ apiKey });
const imageModel = 'gemini-2.5-flash-image';

export interface AnimationAssets {
  imageData: { data: string; mimeType: string };
  frames: Frame[];
  frameDuration: number;
}

const base64ToGenerativePart = (base64: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
};

export const generateAnimationAssets = async (
  base64UserImage: string | null,
  mimeType: string | null,
  imagePrompt: string,
  onProgress: (message: string) => void
): Promise<AnimationAssets | null> => {
  try {
    onProgress('Connecting to Gemini image generator...');
    const imageGenTextPart = { text: imagePrompt };
    const parts: any[] = [];

    if (base64UserImage && mimeType) {
      const userImagePart = base64ToGenerativePart(base64UserImage, mimeType);
      parts.push(userImagePart);
    }
    parts.push(imageGenTextPart);

    onProgress('Synthesizing 9-frame emoji sprite sheet...');

    const imageGenResponse: GenerateContentResponse = await ai.models.generateContent({
      model: imageModel,
      contents: [
        {
          role: 'user',
          parts: parts,
        },
      ],
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    const responseParts = imageGenResponse.candidates?.[0]?.content?.parts;
    if (!responseParts) {
      throw new Error('Invalid response from model. No content parts returned.');
    }

    const imagePart = responseParts.find((p) => p.inlineData);
    if (!imagePart?.inlineData?.data) {
      const text = responseParts.find((p) => p.text)?.text;
      throw new Error(`Model did not return an image. Response: ${text ?? '<no text>'}`);
    }

    const imageData = {
      data: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
    };

    // Extract and parse frame duration from text
    let frameDuration = 110;
    const textPart = responseParts.find((p) => p.text);
    if (textPart?.text) {
      try {
        const jsonStringMatch = textPart.text.match(/{[^}]*frameDuration[^}]*}/);
        if (jsonStringMatch) {
          const parsed = JSON.parse(jsonStringMatch[0]);
          if (parsed.frameDuration && typeof parsed.frameDuration === 'number') {
            frameDuration = Math.max(50, Math.min(parsed.frameDuration, 500));
          }
        }
      } catch (e) {
        console.warn('Could not parse frame duration, using default 110ms');
      }
    }

    return { imageData, frames: [], frameDuration };
  } catch (error) {
    console.error('Error during emoji asset generation:', error);
    throw error;
  }
};
