'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Mic, SendHorizontal, SpellCheck, Square } from 'lucide-react';
import { transcribeAudio, correctTranscript } from '@/lib/api';
import { useAssistant, type ProductSelection } from '@/context/AssistantContext';

const GRAMMAR_CHECK_STORAGE_KEY = 'platform:grammarCheckEnabled';

// ---------------------------------------------------------------------------
// Animated audio-level bars shown while the mic is active
// ---------------------------------------------------------------------------
function AudioLevelBars({ levels }: { levels: number[] }) {
  return (
    <span className="inline-flex items-end gap-[2px]" aria-hidden="true">
      {levels.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-accent-500 transition-none"
          style={{ height: `${Math.max(3, Math.round(h * 20))}px` }}
        />
      ))}
    </span>
  );
}

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: {
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string; confidence?: number };
      length: number;
    };
    length: number;
  };
};

type SpeechRecognitionErrorEvent = Event & { error: string; message?: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SensitivityProfile = 'low' | 'medium' | 'high';

type VisualizerTuning = {
  noiseFloor: number;
  gain: number;
  riseAlpha: number;
  fallAlpha: number;
  smoothingTimeConstant: number;
};

const VISUALIZER_TUNING: Record<SensitivityProfile, VisualizerTuning> = {
  low: {
    noiseFloor: 0.09,
    gain: 1.4,
    riseAlpha: 0.36,
    fallAlpha: 0.16,
    smoothingTimeConstant: 0.82,
  },
  medium: {
    noiseFloor: 0.06,
    gain: 1.9,
    riseAlpha: 0.42,
    fallAlpha: 0.2,
    smoothingTimeConstant: 0.78,
  },
  high: {
    noiseFloor: 0.03,
    gain: 2.4,
    riseAlpha: 0.5,
    fallAlpha: 0.24,
    smoothingTimeConstant: 0.72,
  },
};

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;

  const win = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

/**
 * Detect Microsoft Edge. Edge exposes `webkitSpeechRecognition` but, unlike
 * Chrome (which uses Google's cloud speech service), it relies on Windows'
 * "Online speech recognition" setting. When that's off, recognition fails with
 * a `network` error — so we surface Edge-specific guidance for those failures.
 */
function isEdgeBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /\bEdg(?:e|A|iOS)?\//.test(navigator.userAgent);
}

export function ChatInput() {
  const {
    draft,
    setDraft,
    sendMessage,
    status,
    product,
    setProduct,
    availableTenants,
    sessionExpired,
    messages,
  } = useAssistant();
  // The product (Sales / Knowledge Center) may only be chosen at the start of a
  // conversation. Once the first message is sent it is locked for the thread;
  // starting a new chat (or resuming a session with no saved product) allows
  // selecting again.
  const productLocked = messages.length > 0 && !!product;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef(draft);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // Accumulates partial + final results across continuous recognition
  const interimTranscriptRef = useRef('');
  // Web Audio analyser for real-time level visualisation
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const visualizerMonitorStreamRef = useRef<MediaStream | null>(null);
  const smoothedLevelsRef = useRef<number[]>([]);
  const NUM_BARS = 5;
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(NUM_BARS).fill(0));
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceInfo, setVoiceInfo] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityProfile>('medium');
  // Start with true so mic works immediately; flipped to false when the backend
  // reports a reachable server-side STT model (env-driven; see STT_MODEL).
  const [preferBrowserStt, setPreferBrowserStt] = useState(true);
  // Grammar/spelling correction on typed and transcribed input. Persists per
  // user via localStorage; opt-in / defaults to OFF (Phase 22) — it's a full extra
  // LLM round-trip that blocks the send, so the user turns it on when they want it.
  const [grammarCheckEnabled, setGrammarCheckEnabled] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(GRAMMAR_CHECK_STORAGE_KEY);
      if (saved !== null) setGrammarCheckEnabled(saved === 'true');
    } catch { /* ignore storage errors */ }
  }, []);

  const toggleGrammarCheck = () => {
    setGrammarCheckEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(GRAMMAR_CHECK_STORAGE_KEY, String(next));
      } catch { /* ignore storage errors */ }
      return next;
    });
  };

  // Current page path used as correction context
  const currentPage = typeof window !== 'undefined' ? window.location.pathname : undefined;

  // On mount: probe whether the backend has a reachable server-side STT model
  // (env-driven, provider-agnostic). If it does, use it (higher quality);
  // otherwise stay on browser recognition.
  useEffect(() => {
    fetch('/api/chat/transcribe/status')
      .then((r) => r.json())
      .then((data: { available?: boolean }) => {
        if (data.available === true) setPreferBrowserStt(false);
      })
      .catch(() => { /* keep browser STT on network error */ });
  }, []);

  const streaming = status === 'streaming';

  // Auto-grow the textarea to fit its content, capped by the max-h-32 CSS class.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || streaming || isRecording || isTranscribing || isCorrecting) return;
    // A product (Sales / Knowledge Center) is mandatory before sending.
    if (!product) return;

    // Grammar, spelling and context check the typed text before sending so the
    // chatbot receives clean, well-formed input. Falls back to the original
    // text if correction fails — never block the user from sending.
    let toSend = text;
    // Skip when this exact text was already corrected during voice capture so a
    // voice turn never pays for two correction round-trips (Phase 22).
    if (grammarCheckEnabled && text !== lastCorrectedRef.current) {
      setIsCorrecting(true);
      try {
        toSend = await correctTranscript(text, currentPage, product);
      } catch {
        toSend = text;
      } finally {
        setIsCorrecting(false);
      }
    }

    void sendMessage(toSend || text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const stopStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  // Start the audio-level animation loop driven by AnalyserNode frequency data.
  const startAudioVisualiser = (stream: MediaStream, ownsStream = false) => {
    try {
      // Reset any previous visualiser loop/context before starting a new one.
      stopAudioVisualiser();

      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 32; // small = fast
      analyser.smoothingTimeConstant = VISUALIZER_TUNING[sensitivity].smoothingTimeConstant;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      smoothedLevelsRef.current = Array(NUM_BARS).fill(0);
      if (ownsStream) {
        visualizerMonitorStreamRef.current = stream;
      }

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        // Map frequency bins to bars with a noise gate + smoothing:
        // - tiny background noise stays near zero
        // - spoken voice rises quickly and falls naturally
        const {
          noiseFloor: NOISE_FLOOR,
          gain: GAIN,
          riseAlpha: RISE_ALPHA,
          fallAlpha: FALL_ALPHA,
        } = VISUALIZER_TUNING[sensitivity];
        const step = Math.floor(data.length / NUM_BARS);
        const bars = Array.from({ length: NUM_BARS }, (_, i) => {
          const slice = data.slice(i * step, (i + 1) * step);
          const avg = slice.reduce((s, v) => s + v, 0) / slice.length;
          const raw = avg / 255;
          const gated = raw <= NOISE_FLOOR ? 0 : (raw - NOISE_FLOOR) / (1 - NOISE_FLOOR);
          const boosted = Math.min(1, gated * GAIN);
          const prev = smoothedLevelsRef.current[i] ?? 0;
          const alpha = boosted > prev ? RISE_ALPHA : FALL_ALPHA;
          return prev + (boosted - prev) * alpha;
        });
        smoothedLevelsRef.current = bars;
        setAudioLevels(bars);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } catch {
      // visualiser is non-critical — ignore errors silently
    }
  };

  const stopAudioVisualiser = () => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    visualizerMonitorStreamRef.current?.getTracks().forEach((track) => track.stop());
    visualizerMonitorStreamRef.current = null;
    smoothedLevelsRef.current = [];
    setAudioLevels(Array(NUM_BARS).fill(0));
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      speechRecognitionRef.current?.stop();
      stopAudioVisualiser();
      stopStream();
    };
  }, []);

  // Tracks the draft value that has already been grammar-corrected (during voice
  // capture) so submit() doesn't correct the same text a second time (Phase 22:
  // "correct at most once"). Any manual edit diverges from this, so typed changes
  // still get corrected on send.
  const lastCorrectedRef = useRef('');

  const appendTranscript = (transcript: string, corrected = false) => {
    const currentDraft = draftRef.current.trim();
    const next = currentDraft ? `${currentDraft} ${transcript}` : transcript;
    setDraft(next);
    // Mark the whole draft corrected only when the appended text was itself
    // corrected AND nothing uncorrected preceded it; otherwise clear the marker.
    lastCorrectedRef.current = corrected && !currentDraft ? next.trim() : '';
  };

  const startBrowserSpeechRecognition = async () => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setVoiceError('Browser speech recognition is not supported in this browser.');
      return;
    }

    let finalTranscript = '';
    const recognition = new SpeechRecognition();
    // continuous=true: keeps listening until the user clicks stop,
    // capturing full sentences without cutting off mid-speech.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Browser STT doesn't expose its internal audio stream, so open a parallel
    // monitor stream purely for live visualisation.
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const monitorStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        startAudioVisualiser(monitorStream, true);
      } catch {
        // Visualiser is optional; recognition can still continue.
      }
    }

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        // Pick the alternative with the highest confidence score
        let bestText = '';
        let bestConf = -1;
        for (let a = 0; a < result.length; a += 1) {
          const alt = result[a];
          const confidence = alt.confidence ?? 0;
          if (confidence > bestConf) {
            bestConf = confidence;
            bestText = alt.transcript?.trim() ?? '';
          }
        }
        if (result.isFinal) {
          finalTranscript += `${bestText} `;
        } else {
          interim += bestText;
        }
      }
      interimTranscriptRef.current = interim;
    };

    recognition.onerror = (event) => {
      setIsRecording(false);
      speechRecognitionRef.current = null;
      stopAudioVisualiser();

      const code = event.error ?? '';
      const edge = isEdgeBrowser();
      let message: string;
      switch (code) {
        case 'not-allowed':
        case 'permission-denied':
          message = edge
            ? 'Microphone is blocked in Edge. Click the lock/mic icon in the address bar → allow Microphone, and make sure Windows Settings → Privacy & security → Microphone → "Let desktop apps access your microphone" is on. Then reload and try again.'
            : 'Microphone access was denied. Allow microphone permission in your browser and try again.';
          break;
        case 'no-speech':
          message = 'No speech was detected. Please try again.';
          break;
        case 'audio-capture':
          message = 'No microphone was found. Please check your microphone is connected.';
          break;
        case 'language-not-supported':
          message = edge
            ? 'Edge could not start speech recognition. Enable Windows "Online speech recognition" (Settings → Privacy & security → Speech), then try again.'
            : 'The selected language is not supported for speech recognition.';
          break;
        case 'network':
          message = edge
            ? 'Edge speech recognition needs Windows "Online speech recognition" turned on (Settings → Privacy & security → Speech). Enable it, then try again.'
            : 'Speech recognition requires an internet connection. Please check your connection.';
          break;
        case 'service-not-available':
          message = edge
            ? 'Edge\'s speech service is unavailable. Turn on Windows "Online speech recognition" (Settings → Privacy & security → Speech), or use Chrome.'
            : 'Speech recognition service is unavailable. Try again in a moment.';
          break;
        case 'aborted':
          // User or code stopped it — not an error worth surfacing
          return;
        default:
          message = code ? `Speech error: ${code}. Please try again.` : 'Speech recognition failed. Please try again.';
      }
      setVoiceError(message);
    };

    recognition.onend = () => {
      setIsRecording(false);
      speechRecognitionRef.current = null;
      setVoiceInfo(null);
      interimTranscriptRef.current = '';
      stopAudioVisualiser();

      const transcript = finalTranscript.trim();
      if (!transcript) {
        setVoiceInfo('No speech detected — click mic to try again.');
        return;
      }

      if (!grammarCheckEnabled) {
        appendTranscript(transcript);
        return;
      }
      setIsCorrecting(true);
      correctTranscript(transcript, currentPage, product)
        .then((corrected) => { appendTranscript(corrected, true); })
        .catch(() => { appendTranscript(transcript); })
        .finally(() => { setIsCorrecting(false); });
    };

    speechRecognitionRef.current = recognition;
    setIsRecording(true);
    setVoiceInfo('Browser recognition active — speak now.');
    recognition.start();
  };

  const startRecording = async () => {
    if (streaming || isTranscribing || isRecording) return;
    setVoiceError(null);
    setVoiceInfo(null);

    if (preferBrowserStt) {
      void startBrowserSpeechRecognition();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      void startBrowserSpeechRecognition();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const candidateTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
      ];
      const supportedType = candidateTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = supportedType ? new MediaRecorder(stream, { mimeType: supportedType }) : new MediaRecorder(stream);

      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setVoiceError('Microphone recording failed.');
        setIsRecording(false);
        stopStream();
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        stopAudioVisualiser();
        stopStream();

        const mimeType = recorder.mimeType || supportedType || 'audio/webm';
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];

        if (!audioBlob.size) {
          setVoiceError('No audio was captured. Please try again.');
          return;
        }

        setIsTranscribing(true);
        try {
          const transcript = await transcribeAudio(audioBlob, `voice-input.${extension}`, 'en', product);
          if (!transcript) {
            setVoiceError('No speech was detected. Please try again.');
            return;
          }
          setIsTranscribing(false);
          if (!grammarCheckEnabled) {
            appendTranscript(transcript);
            return;
          }
          setIsCorrecting(true);
          const corrected = await correctTranscript(transcript, currentPage, product);
          appendTranscript(corrected, true);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Voice transcription failed.';

          // Provider-agnostic unavailability signals: when the server-side STT
          // model isn't reachable/configured, gracefully fall back to browser
          // recognition instead of surfacing a dead-end error.
          const lowered = message.toLowerCase();
          const sttUnavailable = [
            'not found',
            'not configured',
            'unavailable',
            'unsupported',
          ].some((sig) => lowered.includes(sig));

          if (sttUnavailable) {
            const SpeechRecognition = getSpeechRecognitionConstructor();
            if (SpeechRecognition) {
              setPreferBrowserStt(true);
              // Auto-start browser recognition immediately — no second click needed
              setTimeout(() => void startBrowserSpeechRecognition(), 0);
            } else {
              setVoiceError('Speech-to-text is unavailable in this browser.');
            }
          } else {
            setVoiceError(message);
          }
        } finally {
          setIsTranscribing(false);
          setIsCorrecting(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      startAudioVisualiser(stream);
    } catch (error) {
      stopStream();
      const denied =
        error instanceof DOMException &&
        (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      if (denied && isEdgeBrowser()) {
        setVoiceError(
          'Microphone is blocked in Edge. Click the lock/mic icon in the address bar → allow Microphone, and make sure Windows Settings → Privacy & security → Microphone → "Let desktop apps access your microphone" is on. Then reload and try again.',
        );
      } else {
        setVoiceError(
          error instanceof Error ? error.message : 'Microphone access was denied.',
        );
      }
    }
  };

  const stopRecording = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    recorder.stop();
  };

  return (
    <div className="border-t border-gray-200 bg-white p-3">
      {sessionExpired && (
        <div
          role="alert"
          className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          <span>Session expired — reload to sign in.</span>
          <a
            href="/login"
            className="shrink-0 rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700"
          >
            Sign in
          </a>
        </div>
      )}
      <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-accent-400 focus-within:ring-1 focus-within:ring-accent-400">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Ask the assistant anything..."
          className="block max-h-32 w-full min-w-0 resize-none overflow-y-auto whitespace-pre-wrap break-words bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
        />
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {!productLocked && (
            <>
              <label className="sr-only" htmlFor="product-selection">
                Product (required)
              </label>
              <select
                id="product-selection"
                value={product ?? ''}
                onChange={(e) => setProduct((e.target.value || null) as ProductSelection | null)}
                disabled={streaming || isRecording || isTranscribing || isCorrecting}
                aria-label="Product (required)"
                title="Select tenant"
                className={`h-8 shrink-0 rounded-lg border bg-white px-2 text-xs font-medium outline-none transition-colors hover:border-accent-400 focus:border-accent-400 disabled:cursor-not-allowed disabled:opacity-40 ${
                  product ? 'border-gray-200 text-gray-700' : 'border-rose-300 text-gray-500'
                }`}
              >
                <option value="" disabled>
                  Select tenant…
                </option>
                {availableTenants.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </>
          )}
        <button
          type="button"
          onClick={toggleGrammarCheck}
          disabled={isCorrecting}
          aria-pressed={grammarCheckEnabled}
          aria-label={grammarCheckEnabled ? 'Disable grammar check' : 'Enable grammar check'}
          title={grammarCheckEnabled ? 'Grammar check: on (click to disable)' : 'Grammar check: off (click to enable)'}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            grammarCheckEnabled
              ? 'border-accent-400 bg-accent-50 text-accent-600'
              : 'border-gray-200 bg-white text-gray-400 hover:border-accent-400 hover:text-accent-700'
          }`}
        >
          <SpellCheck className="h-4 w-4" />
        </button>
        <button
          onClick={isRecording ? stopRecording : () => void startRecording()}
          disabled={streaming || isTranscribing || isCorrecting}
          aria-label={isRecording ? 'Stop voice recording' : 'Start voice recording'}
          title={isRecording ? 'Stop recording' : 'Start voice input'}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            isRecording
              ? 'animate-pulse border-accent-400 bg-accent-50 text-accent-600'
              : 'border-gray-200 bg-white text-gray-600 hover:border-accent-400 hover:text-accent-700'
          }`}
        >
          {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <label className="sr-only" htmlFor="voice-visualizer-sensitivity">
          Voice visualizer sensitivity
        </label>
        <select
          id="voice-visualizer-sensitivity"
          value={sensitivity}
          onChange={(e) => setSensitivity(e.target.value as SensitivityProfile)}
          disabled={isRecording || isTranscribing || isCorrecting || streaming}
          className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-600 outline-none transition-colors hover:border-accent-400 focus:border-accent-400 disabled:cursor-not-allowed disabled:opacity-40"
          title="Visualizer sensitivity"
          aria-label="Visualizer sensitivity"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button
          onClick={() => void submit()}
          disabled={!draft.trim() || !product || streaming || isRecording || isTranscribing || isCorrecting}
          aria-label="Send message"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-white transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
        </div>
      </div>
      {(voiceError || voiceInfo || isRecording || isTranscribing || isCorrecting) && (
        <div className={`mt-2 flex items-center gap-2 text-xs ${voiceError ? 'text-red-500' : 'text-gray-400'}`}>
          {isRecording && <AudioLevelBars levels={audioLevels} />}
          <span>
            {voiceError ??
              voiceInfo ??
              (isCorrecting
                ? 'Correcting grammar…'
                : isRecording
                  ? preferBrowserStt
                    ? 'Listening… click stop when done.'
                    : 'Recording… click stop when done.'
                  : 'Transcribing…')}
          </span>
        </div>
      )}
    </div>
  );
}
