/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Frame } from '../types';

/**
 * Detects the background color of a frame by sampling pixels around its corners
 */
export const detectBackgroundColor = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): [number, number, number] => {
  const samplePoints = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
    [Math.floor(width / 2), 2],
  ];

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  for (const [x, y] of samplePoints) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const p = ctx.getImageData(x, y, 1, 1).data;
      totalR += p[0];
      totalG += p[1];
      totalB += p[2];
      count++;
    }
  }

  return count > 0 
    ? [Math.round(totalR / count), Math.round(totalG / count), Math.round(totalB / count)]
    : [255, 255, 255];
};

/**
 * Removes background color by chroma keying with smooth alpha feathering
 */
export const applyChromaKeyTransparency = (
  canvas: HTMLCanvasElement,
  threshold: number = 38,
  feather: number = 18
): void => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const [bgR, bgG, bgB] = detectBackgroundColor(ctx, width, height);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Euclidean color distance
    const dist = Math.sqrt(
      Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2)
    );

    if (dist <= threshold) {
      data[i + 3] = 0;
    } else if (dist < threshold + feather) {
      // Smooth alpha ramp
      const ratio = (dist - threshold) / feather;
      data[i + 3] = Math.round(data[i + 3] * ratio);
    }
  }

  ctx.putImageData(imgData, 0, 0);
};

/**
 * Applies real-time aesthetic filters on a canvas
 */
export const applyCanvasFilter = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  filterId: string
): void => {
  if (filterId === 'none') return;

  if (filterId === 'crt') {
    // Scanline overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let y = 0; y < height; y += 3) {
      ctx.fillRect(0, y, width, 1.2);
    }
    // Subtle phosphor vignette
    const grad = ctx.createRadialGradient(
      width / 2, height / 2, width * 0.35,
      width / 2, height / 2, width * 0.75
    );
    grad.addColorStop(0, 'rgba(0, 255, 128, 0.02)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } else if (filterId === 'warm-film') {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 180, 50, 0.08)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  } else if (filterId === 'cyberpunk') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.06)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
};

/**
 * Record canvas frames into an MP4/WebM video via native MediaRecorder
 */
export const recordCanvasVideo = (
  canvas: HTMLCanvasElement,
  drawFrameFn: (frameIndex: number) => void,
  frameCount: number,
  loopCount: number,
  fps: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const stream = canvas.captureStream(fps);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const videoBlob = new Blob(chunks, { type: mimeType });
        resolve(videoBlob);
      };

      recorder.start();

      let currentLoop = 0;
      let currentFrame = 0;
      const frameInterval = 1000 / fps;

      const intervalId = setInterval(() => {
        drawFrameFn(currentFrame);
        currentFrame++;

        if (currentFrame >= frameCount) {
          currentFrame = 0;
          currentLoop++;
          if (currentLoop >= loopCount) {
            clearInterval(intervalId);
            setTimeout(() => {
              recorder.stop();
            }, 100);
          }
        }
      }, frameInterval);
    } catch (err) {
      reject(err);
    }
  });
};
