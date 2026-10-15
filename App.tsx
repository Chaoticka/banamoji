/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, EmojiStyle, EmojiEmotion, PresetEmojiDemo } from './types';
import { generateAnimationAssets, AnimationAssets } from './services/geminiService';
import {
  EMOJI_STYLES,
  EMOJI_EMOTIONS,
  PRESET_EMOJI_DEMOS,
  STARTER_SUBJECTS,
  RANDOM_PROMPTS,
  buildCreativeInstruction,
} from './prompts';
import CameraView, { CameraViewHandles } from './components/CameraView';
import AnimationPlayer from './components/AnimationPlayer';
import LoadingOverlay from './components/LoadingOverlay';
import BanamimatorButton from './components/BanamimatorButton';
import {
  UploadIcon,
  SwitchCameraIcon,
  XCircleIcon,
  CameraIcon,
  SparklesIcon,
  DiceIcon,
  Volume2Icon,
  VolumeXIcon,
} from './components/icons';
import {
  playPopSound,
  playShutterSound,
  playSuccessChime,
  isSoundEnabled,
  setSoundEnabled,
} from './services/soundEffects';

type InputMode = 'camera' | 'upload' | 'presets' | 'prompt-only';

const resizeImage = (dataUrl: string, targetSize: number = 1024): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Could not get canvas context'));

      canvas.width = targetSize;
      canvas.height = targetSize;

      const { width, height } = img;
      let sx = 0, sy = 0, sWidth = width, sHeight = height;

      if (width > height) {
        sWidth = height;
        sHeight = height;
        sx = (width - height) / 2;
        sy = 0;
      } else {
        sWidth = width;
        sHeight = width;
        sx = 0;
        sy = (height - width) / 2;
      }

      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetSize, targetSize);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('Failed to load image for resizing.'));
    img.src = dataUrl;
  });
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Capturing);
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const [storyPrompt, setStoryPrompt] = useState<string>('');
  const [selectedEmotion, setSelectedEmotion] = useState<EmojiEmotion | undefined>(EMOJI_EMOTIONS[0]);
  const [selectedStyle, setSelectedStyle] = useState<EmojiStyle>(EMOJI_STYLES[0]);
  const [animationAssets, setAnimationAssets] = useState<AnimationAssets | null>(null);
  const [activeEmojiTitle, setActiveEmojiTitle] = useState<string>('Party Banana Emoji');

  const [loadingMessage, setLoadingMessage] = useState<string>('Generating 9-frame animated emoji...');
  const [error, setError] = useState<string | null>(null);
  const [isSoundMuted, setIsSoundMuted] = useState(!isSoundEnabled());
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const shouldAnimateAfterCapture = useRef<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraViewRef = useRef<CameraViewHandles>(null);

  // Check camera hardware
  useEffect(() => {
    const checkCameras = async () => {
      if (navigator.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setHasMultipleCameras(videoInputs.length > 1);
        } catch (err) {
          console.log('Media devices check ignored:', err);
        }
      }
    };
    checkCameras();
  }, []);

  const toggleSound = () => {
    const next = !isSoundMuted;
    setIsSoundMuted(next);
    setSoundEnabled(!next);
    if (!next) playPopSound();
  };

  // Roll random prompt
  const handleRollRandomPrompt = () => {
    playPopSound();
    const randomPick = RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)];
    setStoryPrompt(randomPick);
    // Also randomly select an emotion if desired
    const randomEmotion = EMOJI_EMOTIONS[Math.floor(Math.random() * EMOJI_EMOTIONS.length)];
    setSelectedEmotion(randomEmotion);
  };

  // Load a pre-computed demo emoji directly
  const handleLoadPresetDemo = useCallback(async (demo: PresetEmojiDemo) => {
    playPopSound();
    setLoadingMessage(`Loading ${demo.title} demo emoji...`);
    setAppState(AppState.Processing);
    setActiveEmojiTitle(demo.title);

    try {
      // Fetch the generated sprite sheet image as a base64 asset
      const response = await fetch(demo.spriteSheetUrl);
      const blob = await response.blob();
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1];
        setAnimationAssets({
          imageData: {
            data: base64Data,
            mimeType: blob.type || 'image/jpeg',
          },
          frames: [],
          frameDuration: demo.frameDuration,
        });
        playSuccessChime();
        setAppState(AppState.Animating);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Failed to load demo:', err);
      setError('Could not load the demo emoji. Please try again.');
      setAppState(AppState.Capturing);
    }
  }, []);

  // Main generator trigger
  const handleCreateAnimation = useCallback(async () => {
    const promptText = storyPrompt.trim() || (selectedEmotion ? selectedEmotion.label : 'happy dancing emoji');
    const creativeInstruction = buildCreativeInstruction(
      promptText,
      originalImage,
      9,
      selectedStyle,
      selectedEmotion
    );

    setActiveEmojiTitle(
      storyPrompt.trim()
        ? storyPrompt.slice(0, 24) + '...'
        : `${selectedEmotion?.label || 'Animated'} Emoji`
    );

    setAppState(AppState.Processing);
    setError(null);
    setLoadingMessage('Optimizing image & configuring prompt...');

    try {
      let base64Image: string | null = null;
      let mimeType: string | null = null;

      if (originalImage) {
        setLoadingMessage('Processing photo into emoji canvas...');
        const resized = await resizeImage(originalImage, 1024);
        const match = resized.match(/^data:(image\/(?:jpeg|png|webp));base64,(.*)$/);
        if (match) {
          mimeType = match[1];
          base64Image = match[2];
        }
      }

      const generatedAsset = await generateAnimationAssets(
        base64Image,
        mimeType,
        creativeInstruction,
        (msg) => setLoadingMessage(msg)
      );

      if (!generatedAsset || !generatedAsset.imageData.data) {
        throw new Error('Sprite sheet generation returned no image data.');
      }

      playSuccessChime();
      setAnimationAssets(generatedAsset);
      setAppState(AppState.Animating);
    } catch (err) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : 'Unknown generation error';
      setError(
        `Gemini encountered an issue creating the sprite sheet (${errMsg}). You can also explore our pre-made animated emojis below!`
      );
      setAppState(AppState.Capturing);
    }
  }, [storyPrompt, originalImage, selectedStyle, selectedEmotion]);

  // Primary action button click
  const handlePrimaryAction = useCallback(() => {
    if (isCameraOpen && cameraViewRef.current) {
      playShutterSound();
      shouldAnimateAfterCapture.current = true;
      cameraViewRef.current.capture();
    } else {
      playPopSound();
      handleCreateAnimation();
    }
  }, [isCameraOpen, handleCreateAnimation]);

  // Camera capture callback
  const handleCapture = useCallback((imageDataUrl: string) => {
    setOriginalImage(imageDataUrl);
    setIsCameraOpen(false);
    setSelectedSubjectId(null);
  }, []);

  useEffect(() => {
    if (originalImage && shouldAnimateAfterCapture.current) {
      shouldAnimateAfterCapture.current = false;
      handleCreateAnimation();
    }
  }, [originalImage, handleCreateAnimation]);

  // File upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        playPopSound();
        setOriginalImage(reader.result as string);
        setSelectedSubjectId(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // Select starter subject
  const handleSelectStarter = async (subject: typeof STARTER_SUBJECTS[0]) => {
    playPopSound();
    setSelectedSubjectId(subject.id);
    try {
      const res = await fetch(subject.url);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalImage(reader.result as string);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error('Failed to load starter subject', e);
    }
  };

  const handleClearImage = () => {
    playPopSound();
    setOriginalImage(null);
    setSelectedSubjectId(null);
    setIsCameraOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-100 flex flex-col">
      {/* ======================================================== */}
      {/* 1. TOP BAR CONTRACT: 3 Zones separated by gap-8           */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-40 bg-[#090A0F]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-2xl" role="img" aria-label="Banana">🍌</span>
          <span className="text-lg font-extrabold tracking-tight font-display text-white whitespace-nowrap">
            BANANIMATE <span className="text-amber-400 font-semibold text-sm">EMOJI</span>
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          <button
            onClick={() => {
              setAppState(AppState.Capturing);
              playPopSound();
            }}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Studio Workshop
          </button>
          <a
            href="#style-lab"
            onClick={(e) => {
              if (appState !== AppState.Capturing) setAppState(AppState.Capturing);
            }}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Emoji Styles
          </a>
          <a
            href="#presets"
            onClick={(e) => {
              if (appState !== AppState.Capturing) setAppState(AppState.Capturing);
            }}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Preset Gallery
          </a>
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Shortcuts
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action + Sound Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={toggleSound}
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg transition-colors"
            title={isSoundMuted ? 'Unmute Sound FX' : 'Mute Sound FX'}
            aria-label={isSoundMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isSoundMuted ? <VolumeXIcon className="w-4 h-4" /> : <Volume2Icon className="w-4 h-4 text-amber-400" />}
          </button>

          <button
            onClick={() => handleLoadPresetDemo(PRESET_EMOJI_DEMOS[0])}
            className="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-sm flex items-center gap-1.5"
          >
            <span>Instant Demo</span>
            <span role="img" aria-hidden="true">🍌</span>
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. MAIN APPLICATION CONTENT                               */}
      {/* ======================================================== */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col">
        {/* State: PROCESSING */}
        {appState === AppState.Processing && (
          <LoadingOverlay
            statusMessage={loadingMessage}
            onCancel={() => setAppState(AppState.Capturing)}
          />
        )}

        {/* State: ANIMATING (Player & Studio View) */}
        {appState === AppState.Animating && animationAssets && (
          <AnimationPlayer
            assets={animationAssets}
            onRegenerate={() => handleCreateAnimation()}
            onBack={() => setAppState(AppState.Capturing)}
            emojiTitle={activeEmojiTitle}
          />
        )}

        {/* State: ERROR */}
        {appState === AppState.Error && (
          <div className="max-w-md mx-auto my-auto text-center bg-slate-900 border border-red-500/30 p-8 rounded-2xl shadow-xl">
            <span className="text-4xl block mb-3">🍌💥</span>
            <h2 className="text-lg font-bold text-slate-100 mb-2">Bananimate Couldn't Finish That One</h2>
            <p className="text-xs text-slate-400 mb-6">{error || 'An error occurred during generation.'}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setAppState(AppState.Capturing)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-200"
              >
                Back to Studio
              </button>
              <button
                onClick={() => handleLoadPresetDemo(PRESET_EMOJI_DEMOS[0])}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-xs font-bold text-slate-950 rounded-lg"
              >
                Try Preset Demo
              </button>
            </div>
          </div>
        )}

        {/* State: CAPTURING & CREATION WORKBENCH */}
        {appState === AppState.Capturing && (
          <div className="w-full flex flex-col gap-8">
            {/* Studio Workspace Header Banner */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display text-white">
                  Turn Photos & Ideas into <span className="text-amber-400">Animated Emojis</span>
                </h1>
                <p className="text-xs md:text-sm text-slate-400 mt-1">
                  Create custom 9-frame looping stickers with transparent backgrounds for Slack, Discord, and iMessage.
                </p>
              </div>

              {/* Input Mode Selector Bar */}
              <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl shrink-0">
                <button
                  onClick={() => {
                    setInputMode('upload');
                    setIsCameraOpen(false);
                    playPopSound();
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                    inputMode === 'upload' ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UploadIcon className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </button>

                <button
                  onClick={() => {
                    setInputMode('camera');
                    setIsCameraOpen(true);
                    playPopSound();
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                    inputMode === 'camera' || isCameraOpen ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CameraIcon className="w-3.5 h-3.5" />
                  <span>Camera</span>
                </button>

                <button
                  onClick={() => {
                    setInputMode('presets');
                    setIsCameraOpen(false);
                    playPopSound();
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                    inputMode === 'presets' ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <SparklesIcon className="w-3.5 h-3.5" />
                  <span>Starters</span>
                </button>

                <button
                  onClick={() => {
                    setInputMode('prompt-only');
                    setIsCameraOpen(false);
                    playPopSound();
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                    inputMode === 'prompt-only' ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Prompt</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="w-full bg-red-950/70 border border-red-500/40 text-red-200 px-4 py-3 rounded-xl flex items-center justify-between text-xs animate-shake">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 p-1">
                  <XCircleIcon className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Split Screen Studio Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* ==================================================== */}
              {/* LEFT COLUMN: Input Canvas & Primary CTA (6 cols)     */}
              {/* ==================================================== */}
              <div className="lg:col-span-6 flex flex-col items-center">
                {/* Visual Viewport Box */}
                <div className="relative w-full aspect-square max-w-md bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
                  {originalImage ? (
                    <div className="relative w-full h-full">
                      <img src={originalImage} alt="Input Subject" className="w-full h-full object-cover" />
                      <button
                        onClick={handleClearImage}
                        className="absolute top-3 right-3 bg-black/60 hover:bg-black/90 p-2 rounded-full text-white backdrop-blur-sm transition-colors"
                        title="Remove image"
                        aria-label="Remove image"
                      >
                        <XCircleIcon className="w-5 h-5" />
                      </button>
                      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-[11px] text-slate-200 px-2 py-0.5 rounded font-mono">
                        Source Subject Ready
                      </div>
                    </div>
                  ) : isCameraOpen ? (
                    <div className="relative w-full h-full">
                      <CameraView
                        ref={cameraViewRef}
                        onCapture={handleCapture}
                        onError={(msg) => setError(msg)}
                      />
                      <button
                        onClick={() => setIsCameraOpen(false)}
                        className="absolute top-3 left-3 bg-black/60 hover:bg-black/90 p-2 rounded-full text-white backdrop-blur-sm transition-colors"
                        aria-label="Close camera"
                      >
                        <XCircleIcon className="w-5 h-5" />
                      </button>
                      {hasMultipleCameras && (
                        <button
                          onClick={() => cameraViewRef.current?.flipCamera()}
                          className="absolute top-3 right-3 bg-black/60 hover:bg-black/90 p-2 rounded-full text-white backdrop-blur-sm transition-colors"
                          aria-label="Flip camera"
                        >
                          <SwitchCameraIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ) : inputMode === 'presets' ? (
                    <div className="p-6 text-center w-full">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-4">
                        Select a Starter Subject:
                      </span>
                      <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                        {STARTER_SUBJECTS.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => handleSelectStarter(sub)}
                            className={`group relative aspect-square rounded-xl overflow-hidden border p-1 transition-all ${
                              selectedSubjectId === sub.id
                                ? 'border-amber-400 ring-2 ring-amber-400/50'
                                : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'
                            }`}
                          >
                            <img src={sub.url} alt={sub.title} className="w-full h-full object-cover rounded-lg" />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-left">
                              <span className="text-[11px] font-bold text-white block truncate">{sub.title}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : inputMode === 'prompt-only' ? (
                    <div className="p-8 text-center flex flex-col items-center">
                      <div className="w-20 h-20 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-4xl mb-4">
                        {selectedEmotion?.emoji || '🍌'}
                      </div>
                      <h3 className="text-sm font-bold text-slate-200 mb-1">Text-to-Emoji Generator</h3>
                      <p className="text-xs text-slate-400 max-w-xs">
                        No photo needed! Pick an emotion, choose a style, or write any concept.
                      </p>
                    </div>
                  ) : (
                    <div className="p-8 text-center flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-2xl mb-4">
                        📸
                      </div>
                      <p className="text-sm font-semibold text-slate-200 mb-2">Upload a Photo or Take a Selfie</p>
                      <p className="text-xs text-slate-400 max-w-xs mb-5">
                        Turn your face, your pet, or any object into a custom animated looping sticker.
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-white transition-colors flex items-center gap-2"
                        >
                          <UploadIcon className="w-4 h-4" />
                          <span>Choose File</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsCameraOpen(true);
                            setInputMode('camera');
                          }}
                          className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-xs font-bold rounded-lg text-slate-950 transition-colors flex items-center gap-2"
                        >
                          <CameraIcon className="w-4 h-4" />
                          <span>Use Camera</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                  />
                </div>

                {/* Primary Action Button */}
                <div className="mt-5 w-full max-w-md flex justify-center">
                  <BanamimatorButton
                    onClick={handlePrimaryAction}
                    aria-label="Create Animated Emoji"
                    isCameraMode={isCameraOpen}
                    label="Bananimate Emoji!"
                  />
                </div>
              </div>

              {/* ==================================================== */}
              {/* RIGHT COLUMN: Emoji Director Lab (6 cols)            */}
              {/* ==================================================== */}
              <div className="lg:col-span-6 flex flex-col gap-6">
                {/* 1. Emotion & Action Picker */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      1. Pick Emotion / Animation Loop
                    </span>
                    <span className="text-xs text-amber-400 font-medium">
                      {selectedEmotion?.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {EMOJI_EMOTIONS.map((emo) => {
                      const isSelected = selectedEmotion?.id === emo.id;
                      return (
                        <button
                          key={emo.id}
                          onClick={() => {
                            playPopSound();
                            setSelectedEmotion(isSelected ? undefined : emo);
                          }}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-amber-400/15 border-amber-400 text-amber-300 shadow-sm'
                              : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <span className="text-2xl mb-1">{emo.emoji}</span>
                          <span className="text-[10px] font-semibold truncate w-full text-center">
                            {emo.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Style Selector */}
                <div id="style-lab" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      2. Aesthetic Art Style
                    </span>
                    <span className="text-xs text-amber-400 font-medium">{selectedStyle.label}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {EMOJI_STYLES.map((st) => {
                      const isSelected = selectedStyle.id === st.id;
                      return (
                        <button
                          key={st.id}
                          onClick={() => {
                            playPopSound();
                            setSelectedStyle(st);
                          }}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-amber-400/15 border-amber-400 text-amber-300 shadow-sm'
                              : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <span className="text-xl shrink-0">{st.icon}</span>
                          <div className="min-w-0">
                            <span className="text-xs font-bold block truncate">{st.label}</span>
                            <span className="text-[10px] text-slate-400 block truncate">{st.description}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Prompt Composer */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      3. Custom Idea or Mashup
                    </span>
                    <button
                      onClick={handleRollRandomPrompt}
                      className="flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      <DiceIcon className="w-3.5 h-3.5" />
                      <span>Surprise Me</span>
                    </button>
                  </div>

                  <div className="relative">
                    <textarea
                      rows={2}
                      value={storyPrompt}
                      onChange={(e) => setStoryPrompt(e.target.value)}
                      placeholder="e.g. 'Avocado taking off sunglasses with heart eyes' or 'Dancing robot'"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all resize-none"
                    />
                    {storyPrompt && (
                      <button
                        onClick={() => setStoryPrompt('')}
                        className="absolute top-2.5 right-2.5 text-slate-500 hover:text-slate-300 p-1"
                        title="Clear prompt"
                      >
                        <XCircleIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ==================================================== */}
            {/* 3. PRESET EMOJI GALLERY (Instant Try-It Mode)          */}
            {/* ==================================================== */}
            <div id="presets" className="w-full pt-4 pb-8 border-t border-slate-800/80 mt-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-white font-display">
                    Try Pre-Made Animated Emojis
                  </h2>
                  <p className="text-xs text-slate-400">
                    Click any emoji to test the full animation player, transparent chroma key, chat inspector, and GIF/Video exports instantly.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {PRESET_EMOJI_DEMOS.map((demo) => (
                  <button
                    key={demo.id}
                    onClick={() => handleLoadPresetDemo(demo)}
                    className="group bg-slate-900 border border-slate-800 hover:border-amber-400/80 rounded-2xl p-4 text-left transition-all hover:shadow-xl hover:-translate-y-0.5 flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-3xl p-2 rounded-xl bg-slate-950/70 border border-slate-800 group-hover:scale-110 transition-transform">
                        {demo.emoji}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {demo.style}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                        {demo.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">{demo.description}</p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-amber-400 font-semibold">
                      <span>Launch in Studio</span>
                      <span>→</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* 4. FOOTER                                                 */}
      {/* ======================================================== */}
      <footer className="w-full border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-7xl mx-auto">
        <div>
          <span>Bananimate Emoji Studio</span>
          <span aria-hidden="true" className="mx-2">·</span>
          <span>9-Frame Looping Sprite Sheet Generator</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="hover:text-slate-200 underline text-xs"
          >
            Keyboard Shortcuts
          </button>
          <span>Created with Gemini Nano Banana</span>
        </div>
      </footer>

      {/* ======================================================== */}
      {/* 5. SHORTCUTS MODAL                                        */}
      {/* ======================================================== */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-white font-display">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span>Play / Pause Animation</span>
                <kbd className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-amber-400 font-mono">
                  Space
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Step Previous Frame</span>
                <kbd className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-amber-400 font-mono">
                  ←
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Step Next Frame</span>
                <kbd className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-amber-400 font-mono">
                  →
                </kbd>
              </div>
            </div>
            <button
              onClick={() => setShowShortcutsModal(false)}
              className="mt-6 w-full py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;