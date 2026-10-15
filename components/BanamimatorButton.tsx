/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SparklesIcon, CameraIcon } from './icons';

interface BanamimatorButtonProps {
  onClick: () => void;
  'aria-label': string;
  disabled?: boolean;
  label?: string;
  isCameraMode?: boolean;
}

const BanamimatorButton: React.FC<BanamimatorButtonProps> = ({
  onClick,
  'aria-label': ariaLabel,
  disabled = false,
  label = 'Bananimate Emoji!',
  isCameraMode = false,
}) => {
  const logoSrc = 'https://www.gstatic.com/aistudio/starter-apps/bananimate/bananimator.jpeg';
  const [processedLogoSrc, setProcessedLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const processImage = async () => {
      try {
        const response = await fetch(logoSrc);
        if (!response.ok) throw new Error('Network error');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
          if (isCancelled) return;
          const canvas = document.createElement('canvas');
          const size = img.width;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            setProcessedLogoSrc(logoSrc);
            return;
          }

          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, size, size);
          const data = imageData.data;
          const radius = size / 2;
          const center = size / 2;
          const blackThreshold = 35;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const x = (i / 4) % size;
            const y = Math.floor(i / 4 / size);
            const dist = Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2));

            if (dist > radius || (r < blackThreshold && g < blackThreshold && b < blackThreshold)) {
              data[i + 3] = 0;
            }
          }

          ctx.putImageData(imageData, 0, 0);
          setProcessedLogoSrc(canvas.toDataURL('image/png'));
          URL.revokeObjectURL(objectUrl);
        };
        img.onerror = () => {
          setProcessedLogoSrc(null);
        };
        img.src = objectUrl;
      } catch {
        setProcessedLogoSrc(null);
      }
    };

    processImage();
    return () => {
      isCancelled = true;
    };
  }, [logoSrc]);

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`group relative flex items-center justify-center gap-3 px-8 py-3.5 rounded-full font-bold transition-all duration-200 select-none ${
        disabled
          ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60 border border-slate-700'
          : 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 text-slate-950 hover:brightness-105 active:scale-95 shadow-xl shadow-amber-500/20 hover:shadow-amber-500/35 cursor-pointer ring-2 ring-amber-300/50'
      }`}
      aria-label={ariaLabel}
      aria-disabled={disabled}
    >
      {/* Icon */}
      {processedLogoSrc ? (
        <img
          src={processedLogoSrc}
          className={`w-9 h-9 rounded-full object-cover transition-transform group-hover:rotate-12 ${
            disabled ? 'grayscale' : ''
          }`}
          alt="Bananimate Logo"
        />
      ) : isCameraMode ? (
        <CameraIcon className="w-6 h-6 text-slate-900" />
      ) : (
        <span className="text-2xl transition-transform group-hover:rotate-12">🍌</span>
      )}

      {/* Button Label */}
      <span className="text-base tracking-wide uppercase font-extrabold whitespace-nowrap">
        {isCameraMode ? 'Snap & Bananimate' : label}
      </span>

      {!disabled && <SparklesIcon className="w-5 h-5 text-slate-950 animate-pulse shrink-0" />}
    </button>
  );
};

export default BanamimatorButton;