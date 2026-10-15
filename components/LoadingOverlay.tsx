/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import BananaLoader from './BananaLoader';

interface LoadingOverlayProps {
  statusMessage?: string;
  onCancel?: () => void;
}

const EMOJI_TIPS = [
  'Tip: Ping-Pong loop mode makes mouth movements and dancing look buttery smooth!',
  'Tip: Enable Transparent Chroma Key to turn your sprite sheet into a Slack sticker.',
  'Tip: 128x128 GIF is the official custom emoji standard for Slack & Discord.',
  'Tip: Try combining any selfie photo with the "Melting" or "Mind Blown" emotion!',
  'Tip: You can use Spacebar to play/pause and Left/Right arrows to scrub frames.',
];

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  statusMessage = 'Creating your 9-frame animated emoji...',
  onCancel,
}) => {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % EMOJI_TIPS.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6 text-center">
      <div className="relative mb-6">
        <BananaLoader className="w-56 h-56 object-contain" />
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-32 h-3 bg-amber-400/20 blur-md rounded-full pointer-events-none" />
      </div>

      <h2 className="text-xl font-bold text-slate-100 mb-2">
        {statusMessage}
      </h2>

      <p className="text-xs text-amber-300/90 font-mono tracking-wide max-w-md mx-auto mb-6 transition-all duration-300">
        {EMOJI_TIPS[tipIndex]}
      </p>

      {onCancel && (
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
};

export default LoadingOverlay;