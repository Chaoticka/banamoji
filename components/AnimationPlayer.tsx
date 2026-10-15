/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimationAssets } from '../services/geminiService';
import { Frame, LoopMode, ChatBackgroundTheme, CanvasFilter } from '../types';
import BananaLoader from './BananaLoader';
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  RepeatIcon,
  BoomerangIcon,
  DownloadIcon,
  VideoIcon,
  GridIcon,
  FilmIcon,
  LayersIcon,
  ClipboardIcon,
  CheckIcon,
  ShareIcon,
  ArrowLeftIcon,
  RefreshCwIcon,
  SettingsIcon,
  XCircleIcon,
} from './icons';
import {
  applyChromaKeyTransparency,
  applyCanvasFilter,
  recordCanvasVideo,
} from '../utils/emojiCanvas';
import { playPopSound, playStepClick, playSuccessChime } from '../services/soundEffects';

declare var gifshot: any;

interface AnimationPlayerProps {
  assets: AnimationAssets;
  onRegenerate: () => void;
  onBack: () => void;
  emojiTitle?: string;
}

const CANVAS_FILTERS: CanvasFilter[] = [
  { id: 'none', label: 'Clean' },
  { id: 'crt', label: 'Retro CRT' },
  { id: 'warm-film', label: 'Warm Film' },
  { id: 'cyberpunk', label: 'Cyber Glow' },
];

const AnimationPlayer: React.FC<AnimationPlayerProps> = ({
  assets,
  onRegenerate,
  onBack,
  emojiTitle = 'Animated Emoji',
}) => {
  const [rawFrames, setRawFrames] = useState<HTMLCanvasElement[]>([]);
  const [transparentFrames, setTransparentFrames] = useState<HTMLCanvasElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);

  // Playback options
  const [loopMode, setLoopMode] = useState<LoopMode>('ping-pong');
  const [speedMs, setSpeedMs] = useState<number>(assets.frameDuration || 110);
  const [isTransparent, setIsTransparent] = useState(true);
  const [chromaThreshold, setChromaThreshold] = useState(42);
  const [onionSkinning, setOnionSkinning] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'none' | 'crt' | 'warm-film' | 'cyberpunk'>('none');
  const [chatTheme, setChatTheme] = useState<ChatBackgroundTheme>('discord');
  const [viewMode, setViewMode] = useState<'player' | 'spritesheet' | 'filmstrip'>('player');
  const [showSettings, setShowSettings] = useState(false);

  // Export states
  const [isExportingGif, setIsExportingGif] = useState(false);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // Canvases & DOM
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const spriteSheetImgRef = useRef<HTMLImageElement | null>(null);
  const animationTimerRef = useRef<any>(null);
  const pingPongDirectionRef = useRef<1 | -1>(1);

  const activeFrames = isTransparent ? transparentFrames : rawFrames;

  // Frame sequence based on loop mode
  const sequenceIndices = useMemo(() => {
    const count = activeFrames.length || 9;
    if (loopMode === 'ping-pong') {
      const seq: number[] = [];
      for (let i = 0; i < count; i++) seq.push(i);
      for (let i = count - 2; i > 0; i--) seq.push(i);
      return seq;
    } else if (loopMode === 'reverse') {
      const seq: number[] = [];
      for (let i = count - 1; i >= 0; i--) seq.push(i);
      return seq;
    }
    // forward
    return Array.from({ length: count }, (_, i) => i);
  }, [loopMode, activeFrames.length]);

  const [sequenceStep, setSequenceStep] = useState(0);

  // 1. Slice sprite sheet into 9 distinct frame canvases
  useEffect(() => {
    if (!assets.imageData || !assets.imageData.data) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      spriteSheetImgRef.current = img;
      const { naturalWidth, naturalHeight } = img;
      const cellW = Math.floor(naturalWidth / 3);
      const cellH = Math.floor(naturalHeight / 3);
      const cropMargin = Math.max(4, Math.floor(cellW * 0.03)); // 3% margin crop to eliminate bleed lines

      const newRawCanvases: HTMLCanvasElement[] = [];
      const newTransCanvases: HTMLCanvasElement[] = [];

      for (let i = 0; i < 9; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);

        const sx = col * cellW + cropMargin;
        const sy = row * cellH + cropMargin;
        const sw = cellW - cropMargin * 2;
        const sh = cellH - cropMargin * 2;

        // Raw canvas
        const rawC = document.createElement('canvas');
        rawC.width = sw;
        rawC.height = sh;
        const rawCtx = rawC.getContext('2d');
        if (rawCtx) {
          rawCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        }
        newRawCanvases.push(rawC);

        // Transparent canvas
        const transC = document.createElement('canvas');
        transC.width = sw;
        transC.height = sh;
        const transCtx = transC.getContext('2d');
        if (transCtx) {
          transCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
          applyChromaKeyTransparency(transC, chromaThreshold, 16);
        }
        newTransCanvases.push(transC);
      }

      setRawFrames(newRawCanvases);
      setTransparentFrames(newTransCanvases);
      setIsLoading(false);
      setSpeedMs(assets.frameDuration || 110);
    };

    img.onerror = () => {
      setIsLoading(false);
    };

    img.src = assets.imageData.data.startsWith('data:')
      ? assets.imageData.data
      : `data:${assets.imageData.mimeType};base64,${assets.imageData.data}`;
  }, [assets]);

  // Re-run transparency if threshold changes
  const updateTransparencyThreshold = useCallback((newThreshold: number) => {
    setChromaThreshold(newThreshold);
    if (rawFrames.length === 0) return;

    const updated: HTMLCanvasElement[] = rawFrames.map((rawC) => {
      const transC = document.createElement('canvas');
      transC.width = rawC.width;
      transC.height = rawC.height;
      const ctx = transC.getContext('2d');
      if (ctx) {
        ctx.drawImage(rawC, 0, 0);
        applyChromaKeyTransparency(transC, newThreshold, 16);
      }
      return transC;
    });
    setTransparentFrames(updated);
  }, [rawFrames]);

  // 2. Main animation playback loop
  useEffect(() => {
    if (!isPlaying || activeFrames.length === 0) {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
      return;
    }

    animationTimerRef.current = setInterval(() => {
      setSequenceStep((prev) => {
        const next = (prev + 1) % sequenceIndices.length;
        setCurrentFrameIndex(sequenceIndices[next]);
        return next;
      });
    }, speedMs);

    return () => {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    };
  }, [isPlaying, speedMs, activeFrames.length, sequenceIndices]);

  // 3. Render current frame to main canvas with optional onion skinning & filters
  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas || activeFrames.length === 0 || !activeFrames[currentFrameIndex]) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 512;
    canvas.height = 512;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Optional onion skinning (ghost frames)
    if (onionSkinning && activeFrames.length > 1) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      const prevIdx = (currentFrameIndex - 1 + activeFrames.length) % activeFrames.length;
      ctx.drawImage(activeFrames[prevIdx], 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.15;
      const nextIdx = (currentFrameIndex + 1) % activeFrames.length;
      ctx.drawImage(activeFrames[nextIdx], 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Active frame
    ctx.drawImage(activeFrames[currentFrameIndex], 0, 0, canvas.width, canvas.height);

    // Canvas post-processing filter
    if (activeFilter !== 'none') {
      applyCanvasFilter(ctx, canvas.width, canvas.height, activeFilter);
    }
  }, [currentFrameIndex, activeFrames, onionSkinning, activeFilter]);

  // Step control
  const handleStepBack = () => {
    setIsPlaying(false);
    playStepClick();
    const nextIdx = (currentFrameIndex - 1 + activeFrames.length) % activeFrames.length;
    setCurrentFrameIndex(nextIdx);
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    playStepClick();
    const nextIdx = (currentFrameIndex + 1) % activeFrames.length;
    setCurrentFrameIndex(nextIdx);
  };

  const handleTogglePlay = () => {
    playPopSound();
    setIsPlaying((prev) => !prev);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleStepBack();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleStepForward();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Background style helper
  const getBackgroundClass = () => {
    switch (chatTheme) {
      case 'discord':
        return 'bg-[#313338] text-white';
      case 'slack':
        return 'bg-[#1A1D21] text-white';
      case 'dark':
        return 'bg-[#0B0E14] text-white';
      case 'light':
        return 'bg-[#F8FAFC] text-slate-900 border border-slate-200';
      case 'checker':
      default:
        return 'bg-checker text-white';
    }
  };

  // Export as GIF
  const handleExportGif = useCallback((size: number = 256) => {
    if (activeFrames.length === 0) return;
    setIsExportingGif(true);
    setExportSuccessMessage(null);

    const frameDataUrls = sequenceIndices.map((idx) => {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(activeFrames[idx], 0, 0, size, size);
        if (activeFilter !== 'none') applyCanvasFilter(ctx, size, size, activeFilter);
      }
      return c.toDataURL('image/png');
    });

    const intervalSeconds = speedMs / 1000;

    gifshot.createGIF(
      {
        images: frameDataUrls,
        gifWidth: size,
        gifHeight: size,
        interval: intervalSeconds,
        numWorkers: 2,
      },
      (obj: { error: boolean; image: string; errorMsg: string }) => {
        setIsExportingGif(false);
        if (!obj.error) {
          playSuccessChime();
          const link = document.createElement('a');
          link.href = obj.image;
          link.download = `${emojiTitle.toLowerCase().replace(/\s+/g, '_')}_emoji.gif`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setExportSuccessMessage(`Downloaded ${size}x${size} Animated GIF!`);
          setTimeout(() => setExportSuccessMessage(null), 4000);
        } else {
          console.error('GIF generation failed:', obj.errorMsg);
        }
      }
    );
  }, [activeFrames, sequenceIndices, speedMs, activeFilter, emojiTitle]);

  // Export as MP4/WebM Video
  const handleExportVideo = useCallback(async () => {
    if (activeFrames.length === 0) return;
    setIsExportingVideo(true);
    setExportSuccessMessage(null);

    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = 512;
      exportCanvas.height = 512;
      const ctx = exportCanvas.getContext('2d')!;

      const fps = Math.min(24, Math.max(6, Math.round(1000 / speedMs)));
      const framesInLoop = sequenceIndices.length;
      const totalLoops = 3;

      const videoBlob = await recordCanvasVideo(
        exportCanvas,
        (seqIdx) => {
          const frameIdx = sequenceIndices[seqIdx % framesInLoop];
          ctx.clearRect(0, 0, 512, 512);
          ctx.drawImage(activeFrames[frameIdx], 0, 0, 512, 512);
          if (activeFilter !== 'none') applyCanvasFilter(ctx, 512, 512, activeFilter);
        },
        framesInLoop,
        totalLoops,
        fps
      );

      playSuccessChime();
      const url = URL.createObjectURL(videoBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${emojiTitle.toLowerCase().replace(/\s+/g, '_')}_animation.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportSuccessMessage('Exported crisp HD video animation!');
      setTimeout(() => setExportSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Video export error:', err);
    } finally {
      setIsExportingVideo(false);
    }
  }, [activeFrames, sequenceIndices, speedMs, activeFilter, emojiTitle]);

  // Download Master Sprite Sheet PNG
  const handleDownloadSpriteSheet = useCallback(() => {
    if (!spriteSheetImgRef.current) return;
    playSuccessChime();
    const link = document.createElement('a');
    link.href = spriteSheetImgRef.current.src;
    link.download = `${emojiTitle.toLowerCase().replace(/\s+/g, '_')}_master_spritesheet.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportSuccessMessage('Downloaded 1024x1024 Master Sprite Sheet!');
    setTimeout(() => setExportSuccessMessage(null), 4000);
  }, [emojiTitle]);

  // Download Single Active Frame PNG
  const handleDownloadSingleFrame = useCallback((index: number = currentFrameIndex) => {
    if (!activeFrames[index]) return;
    playSuccessChime();
    const link = document.createElement('a');
    link.href = activeFrames[index].toDataURL('image/png');
    link.download = `${emojiTitle.toLowerCase().replace(/\s+/g, '_')}_frame_${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportSuccessMessage(`Downloaded Frame ${index + 1} PNG!`);
    setTimeout(() => setExportSuccessMessage(null), 4000);
  }, [activeFrames, currentFrameIndex, emojiTitle]);

  // Copy current frame to clipboard
  const handleCopyToClipboard = useCallback(async () => {
    if (!activeFrames[currentFrameIndex]) return;
    try {
      const canvas = activeFrames[currentFrameIndex];
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        playSuccessChime();
        setCopiedSuccess(true);
        setExportSuccessMessage('Copied Frame PNG to Clipboard! Paste directly into Slack or Discord.');
        setTimeout(() => setCopiedSuccess(false), 2500);
        setTimeout(() => setExportSuccessMessage(null), 4000);
      }, 'image/png');
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  }, [activeFrames, currentFrameIndex]);

  // Native Web Share
  const handleShare = useCallback(async () => {
    if (!activeFrames[currentFrameIndex] || !navigator.share) return;
    try {
      activeFrames[currentFrameIndex].toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `${emojiTitle}_emoji.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: emojiTitle,
            text: `Check out my new animated emoji made with Bananimate!`,
            files: [file],
          });
        }
      });
    } catch (err) {
      console.log('Share canceled or not supported');
    }
  }, [activeFrames, currentFrameIndex, emojiTitle]);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center">
      {/* Top Action Bar in Studio */}
      <div className="w-full flex items-center justify-between pb-4 border-b border-slate-800 mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>Studio Workshop</span>
          </button>
          <div className="text-xs text-slate-400">
            <span>{emojiTitle}</span>
            <span aria-hidden="true" className="mx-2">·</span>
            <span className="font-mono tabular-nums">9 Frames</span>
            <span aria-hidden="true" className="mx-2">·</span>
            <span className="font-mono tabular-nums">{Math.round(1000 / speedMs)} FPS</span>
          </div>
        </div>

        {/* View mode switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            onClick={() => setViewMode('player')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              viewMode === 'player' ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Live Player</span>
          </button>
          <button
            onClick={() => setViewMode('spritesheet')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              viewMode === 'spritesheet' ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <GridIcon className="w-3.5 h-3.5" />
            <span>Sprite Grid</span>
          </button>
          <button
            onClick={() => setViewMode('filmstrip')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              viewMode === 'filmstrip' ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FilmIcon className="w-3.5 h-3.5" />
            <span>Filmstrip</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RefreshCwIcon className="w-3.5 h-3.5" />
            <span>Regenerate</span>
          </button>
        </div>
      </div>

      {exportSuccessMessage && (
        <div className="w-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 px-4 py-2.5 rounded-lg mb-6 flex items-center gap-2 text-xs font-medium animate-fade-in">
          <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{exportSuccessMessage}</span>
        </div>
      )}

      {/* Main Studio Viewport */}
      {isLoading ? (
        <div className="w-full h-96 flex flex-col items-center justify-center">
          <BananaLoader className="w-48 h-48 mb-4" />
          <p className="text-sm font-medium text-amber-300">Slicing 9 frames & prepping emoji sticker...</p>
        </div>
      ) : (
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Stage & Scrubber (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-center">
            {/* Stage Canvas Container */}
            <div
              className={`relative w-full max-w-md aspect-square rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center p-6 transition-colors duration-200 ${getBackgroundClass()}`}
            >
              {viewMode === 'player' && (
                <canvas
                  ref={mainCanvasRef}
                  className="w-full h-full object-contain filter drop-shadow-md select-none"
                />
              )}

              {viewMode === 'spritesheet' && spriteSheetImgRef.current && (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={spriteSheetImgRef.current.src}
                    alt="Master Sprite Sheet"
                    className="max-w-full max-h-full object-contain"
                  />
                  {/* Highlight box on active cell */}
                  <div
                    className="absolute border-2 border-amber-400 rounded-sm pointer-events-none shadow-[0_0_12px_rgba(251,191,36,0.6)] transition-all duration-75"
                    style={{
                      width: '33.33%',
                      height: '33.33%',
                      left: `${(currentFrameIndex % 3) * 33.33}%`,
                      top: `${Math.floor(currentFrameIndex / 3) * 33.33}%`,
                    }}
                  />
                </div>
              )}

              {viewMode === 'filmstrip' && (
                <div className="w-full h-full overflow-y-auto grid grid-cols-3 gap-2 p-2">
                  {activeFrames.map((fCanvas, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentFrameIndex(idx);
                        setIsPlaying(false);
                      }}
                      className={`relative aspect-square rounded-lg overflow-hidden border p-1 transition-all ${
                        currentFrameIndex === idx
                          ? 'border-amber-400 ring-2 ring-amber-400/50'
                          : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'
                      }`}
                    >
                      <img
                        src={fCanvas.toDataURL()}
                        alt={`Frame ${idx + 1}`}
                        className="w-full h-full object-contain"
                      />
                      <span className="absolute bottom-1 right-1 text-[10px] font-mono bg-black/70 px-1 rounded text-white">
                        {idx + 1}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Top overlay badges: Frame count and current mode */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded bg-black/60 text-white backdrop-blur-sm">
                  Frame {currentFrameIndex + 1} / 9
                </span>
                {onionSkinning && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 backdrop-blur-sm">
                    Onion Skin On
                  </span>
                )}
              </div>

              {/* Background Theme Switcher inside stage */}
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm p-1 rounded-lg">
                <button
                  onClick={() => setChatTheme('discord')}
                  title="Discord Slate"
                  className={`w-5 h-5 rounded bg-[#313338] border ${
                    chatTheme === 'discord' ? 'border-amber-400 ring-1 ring-amber-400' : 'border-transparent'
                  }`}
                />
                <button
                  onClick={() => setChatTheme('slack')}
                  title="Slack Dark"
                  className={`w-5 h-5 rounded bg-[#1A1D21] border ${
                    chatTheme === 'slack' ? 'border-amber-400 ring-1 ring-amber-400' : 'border-transparent'
                  }`}
                />
                <button
                  onClick={() => setChatTheme('checker')}
                  title="Transparent Checkerboard"
                  className={`w-5 h-5 rounded bg-checker border ${
                    chatTheme === 'checker' ? 'border-amber-400 ring-1 ring-amber-400' : 'border-transparent'
                  }`}
                />
                <button
                  onClick={() => setChatTheme('light')}
                  title="Light Theme"
                  className={`w-5 h-5 rounded bg-white border ${
                    chatTheme === 'light' ? 'border-amber-400 ring-1 ring-amber-400' : 'border-transparent'
                  }`}
                />
              </div>
            </div>

            {/* Playback Scrubber & Transport Controls */}
            <div className="w-full max-w-md mt-4 p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              {/* Frame track with clickable nodes */}
              <div className="flex items-center justify-between gap-1">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentFrameIndex(idx);
                      setIsPlaying(false);
                      playStepClick();
                    }}
                    className={`flex-1 h-2 rounded-full transition-all ${
                      currentFrameIndex === idx
                        ? 'bg-amber-400 ring-2 ring-amber-400/40 h-3'
                        : 'bg-slate-700 hover:bg-slate-500'
                    }`}
                    title={`Go to Frame ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Transport Buttons */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleStepBack}
                    className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Previous Frame (Left Arrow)"
                  >
                    <SkipBackIcon className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleTogglePlay}
                    className="p-2.5 text-slate-950 font-bold bg-amber-400 hover:bg-amber-300 rounded-lg transition-all shadow-md active:scale-95"
                    title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                  >
                    {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={handleStepForward}
                    className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Next Frame (Right Arrow)"
                  >
                    <SkipForwardIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Loop Mode Selector */}
                <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg">
                  <button
                    onClick={() => {
                      setLoopMode('ping-pong');
                      playPopSound();
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                      loopMode === 'ping-pong' ? 'bg-amber-400 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Ping-Pong / Boomerang (Smooth continuous loop)"
                  >
                    <BoomerangIcon className="w-3.5 h-3.5" />
                    <span>Ping-Pong</span>
                  </button>
                  <button
                    onClick={() => {
                      setLoopMode('forward');
                      playPopSound();
                    }}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                      loopMode === 'forward' ? 'bg-amber-400 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Standard Forward Loop"
                  >
                    <RepeatIcon className="w-3.5 h-3.5" />
                    <span>Loop</span>
                  </button>
                </div>

                {/* Settings Toggle */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-2 rounded-lg transition-colors ${
                    showSettings ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="Animation & Transparency Settings"
                >
                  <SettingsIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Expandable Settings Drawer */}
              {showSettings && (
                <div className="pt-3 border-t border-slate-800 space-y-4 animate-fade-in text-xs text-slate-300">
                  {/* Speed / FPS Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-slate-200">Animation Speed</span>
                      <span className="font-mono tabular-nums text-amber-400">
                        {Math.round(1000 / speedMs)} FPS ({speedMs}ms / frame)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={40}
                        max={300}
                        step={10}
                        value={speedMs}
                        onChange={(e) => setSpeedMs(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        onClick={() => setSpeedMs(200)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px]"
                      >
                        5 FPS
                      </button>
                      <button
                        onClick={() => setSpeedMs(120)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px]"
                      >
                        8 FPS (Classic)
                      </button>
                      <button
                        onClick={() => setSpeedMs(80)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px]"
                      >
                        12 FPS
                      </button>
                      <button
                        onClick={() => setSpeedMs(50)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px]"
                      >
                        20 FPS
                      </button>
                    </div>
                  </div>

                  {/* Transparency & Chroma Key */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-200">Transparent Background</span>
                      <button
                        onClick={() => setIsTransparent(!isTransparent)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                          isTransparent ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {isTransparent ? 'Enabled (Chroma Key)' : 'Solid Background'}
                      </button>
                    </div>

                    {isTransparent && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Chroma Tolerance</span>
                          <span className="font-mono tabular-nums">{chromaThreshold}</span>
                        </div>
                        <input
                          type="range"
                          min={15}
                          max={90}
                          step={2}
                          value={chromaThreshold}
                          onChange={(e) => updateTransparencyThreshold(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        />
                      </div>
                    )}
                  </div>

                  {/* Onion Skinning & Canvas Filters */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="font-medium text-slate-200">Onion Skinning (Animators)</span>
                    <button
                      onClick={() => setOnionSkinning(!onionSkinning)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        onionSkinning ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {onionSkinning ? 'On' : 'Off'}
                    </button>
                  </div>

                  {/* Visual Filters */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className="font-medium text-slate-200 block mb-1.5">Aesthetic Filter</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {CANVAS_FILTERS.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setActiveFilter(f.id)}
                          className={`py-1 text-center rounded text-[11px] font-medium transition-colors ${
                            activeFilter === f.id
                              ? 'bg-amber-400 text-slate-950 font-semibold'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Chat Previews & Export Center (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Live Chat Mockup (Multi-Scale Testing) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Live Chat Size Inspector
              </h3>

              {/* Chat Message Bubble Mockup */}
              <div className="bg-[#2B2D31] rounded-lg p-3 text-sm text-slate-200 space-y-3">
                {/* 32px standard message emoji */}
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold shrink-0 text-white">
                    JD
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-slate-100">Jordan</span>
                      <span className="text-[10px] text-slate-400">Today at 4:20 PM</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-300">Wait, look at this new custom emoji:</span>
                      <div className="w-8 h-8 inline-flex items-center justify-center shrink-0">
                        {activeFrames[currentFrameIndex] && (
                          <img
                            src={activeFrames[currentFrameIndex].toDataURL()}
                            alt="32px chat size"
                            className="w-8 h-8 object-contain"
                          />
                        )}
                      </div>
                      <span className="text-xs text-slate-300">it actually loops!</span>
                    </div>
                  </div>
                </div>

                {/* 64px Slack/Discord Reaction Mockup */}
                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-[#1E1F22] rounded-lg p-1 flex items-center justify-center border border-slate-700/60">
                      {activeFrames[currentFrameIndex] && (
                        <img
                          src={activeFrames[currentFrameIndex].toDataURL()}
                          alt="64px sticker"
                          className="w-14 h-14 object-contain"
                        />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">Slack & Discord Emote</span>
                      <span className="text-[11px] text-slate-400">64x64px sticker scale</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyToClipboard}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                      copiedSuccess
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {copiedSuccess ? <CheckIcon className="w-3.5 h-3.5" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
                    <span>{copiedSuccess ? 'Copied!' : 'Copy Frame'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Export Multi-Tool Suite */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Export & Sharing Hub
              </h3>

              <div className="space-y-2.5">
                {/* 1. Animated GIF (Slack/Discord ready) */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportGif(128)}
                    disabled={isExportingGif}
                    className="flex-1 py-2.5 px-3 bg-amber-400 hover:bg-amber-300 disabled:bg-amber-800 disabled:cursor-not-allowed text-slate-950 font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-2 shadow-sm"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    <span>{isExportingGif ? 'Rendering GIF...' : 'Export GIF (128px Slack)'}</span>
                  </button>
                  <button
                    onClick={() => handleExportGif(256)}
                    disabled={isExportingGif}
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs transition-colors"
                    title="Export 256px Discord GIF"
                  >
                    256px
                  </button>
                  <button
                    onClick={() => handleExportGif(512)}
                    disabled={isExportingGif}
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs transition-colors"
                    title="Export 512px HD GIF"
                  >
                    HD
                  </button>
                </div>

                {/* 2. HD Video Loop (WebM/MP4) */}
                <button
                  onClick={handleExportVideo}
                  disabled={isExportingVideo}
                  className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 text-slate-200 font-semibold rounded-lg transition-colors text-xs flex items-center justify-center gap-2"
                >
                  <VideoIcon className="w-4 h-4 text-sky-400" />
                  <span>{isExportingVideo ? 'Recording Canvas Video...' : 'Export 60fps HD Video (WebM)'}</span>
                </button>

                {/* 3. Master 1024x1024 Sprite Sheet */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleDownloadSpriteSheet}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors text-xs flex items-center justify-center gap-1.5"
                  >
                    <GridIcon className="w-3.5 h-3.5" />
                    <span>Master Sheet</span>
                  </button>

                  <button
                    onClick={() => handleDownloadSingleFrame()}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors text-xs flex items-center justify-center gap-1.5"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" />
                    <span>Active Frame PNG</span>
                  </button>
                </div>

                {/* 4. Native Share if supported */}
                {typeof navigator !== 'undefined' && (navigator as any).share && (
                  <button
                    onClick={handleShare}
                    className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors text-xs flex items-center justify-center gap-2"
                  >
                    <ShareIcon className="w-4 h-4" />
                    <span>Share Animated Sticker</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnimationPlayer;