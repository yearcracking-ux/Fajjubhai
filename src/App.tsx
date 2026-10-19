import React, { useState, useEffect, useRef } from "react";
import { 
  Mic, 
  MicOff, 
  Power, 
  Volume2, 
  VolumeX, 
  Settings, 
  Sparkles, 
  ExternalLink, 
  Palette, 
  Heart, 
  RefreshCw,
  Clock,
  User,
  Check,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import AudioVisualizer from "./components/AudioVisualizer";

// Types
interface Atmosphere {
  id: string;
  name: string;
  colorName: string;
  bgGradient: string;
  coreGlow: string;
  waveColor: string;
  secondaryColor: string;
  badgeBg: string;
  accentText: string;
  borderGlow: string;
}

const ATMOSPHERES: Record<string, Atmosphere> = {
  indigo: {
    id: "indigo",
    name: "Midnight Nebula",
    colorName: "Ultraviolet Purple",
    bgGradient: "from-slate-950 via-indigo-950/40 to-slate-950",
    coreGlow: "shadow-[0_0_60px_rgba(168,85,247,0.5)] border-purple-500",
    waveColor: "#c084fc",
    secondaryColor: "#818cf8",
    badgeBg: "bg-purple-500/10 border-purple-500/30 text-purple-300",
    accentText: "text-purple-400",
    borderGlow: "rgba(168,85,247,0.2)"
  },
  emerald: {
    id: "emerald",
    name: "Emerald Matrix",
    colorName: "Cyberpunk Green",
    bgGradient: "from-zinc-950 via-emerald-950/30 to-zinc-950",
    coreGlow: "shadow-[0_0_60px_rgba(16,185,129,0.5)] border-emerald-500",
    waveColor: "#34d399",
    secondaryColor: "#2dd4bf",
    badgeBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    accentText: "text-emerald-400",
    borderGlow: "rgba(16,185,129,0.2)"
  },
  crimson: {
    id: "crimson",
    name: "Cosmic Seduction",
    colorName: "Passion Scarlet",
    bgGradient: "from-stone-950 via-rose-950/40 to-stone-950",
    coreGlow: "shadow-[0_0_60px_rgba(244,63,94,0.5)] border-rose-500",
    waveColor: "#fb7185",
    secondaryColor: "#f43f5e",
    badgeBg: "bg-rose-500/10 border-rose-500/30 text-rose-300",
    accentText: "text-rose-400",
    borderGlow: "rgba(244,63,94,0.2)"
  },
  amber: {
    id: "amber",
    name: "Golden Eclipse",
    colorName: "Solar Flare",
    bgGradient: "from-neutral-950 via-amber-950/30 to-neutral-950",
    coreGlow: "shadow-[0_0_60px_rgba(245,158,11,0.5)] border-amber-500",
    waveColor: "#fbbf24",
    secondaryColor: "#f59e0b",
    badgeBg: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    accentText: "text-amber-400",
    borderGlow: "rgba(245,158,11,0.2)"
  },
  cyan: {
    id: "cyan",
    name: "Cyber Sunset",
    colorName: "Electric Ocean",
    bgGradient: "from-gray-950 via-cyan-950/40 to-gray-950",
    coreGlow: "shadow-[0_0_60px_rgba(6,182,212,0.5)] border-cyan-500",
    waveColor: "#22d3ee",
    secondaryColor: "#3b82f6",
    badgeBg: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
    accentText: "text-cyan-400",
    borderGlow: "rgba(6,182,212,0.2)"
  }
};

const VOICES = [
  { id: "Zephyr", name: "Sassy Zephyr", mode: "Teasing & Playful", desc: "Shararat se bhari chill girlfriend vibe", color: "text-rose-400 shadow-rose-500/20" },
  { id: "Aoede", name: "Sweet Aoede", mode: "Warm & Caring", desc: "Pyaari romantic and bohot pyaari shona vibe", color: "text-emerald-400 shadow-emerald-500/20" },
  { id: "Kore", name: "Cool Kore", mode: "Smart & Bold", desc: "Tez dimaag aur bindass baatein karne wali", color: "text-cyan-400 shadow-cyan-500/20" }
];

const SUGGESTIONS = [
  { label: "Mujhse thodi shararat bhari baatein karo na! 😉", type: "flirt" },
  { label: "Mera naam kya hai baby? ❤️", type: "flirt" },
  { label: "Mera mood sahi karne ke liye ek gana gao! 🎵", type: "cmd" },
  { label: "Aap mere liye YouTube par love music kholo! 🎶", type: "cmd" },
  { label: "Mujhe ek cute sa nickname de do babu! 🥰", type: "flirt" },
  { label: "Apna look change karke Matrix Green kar do! 💚", type: "cmd" }
];

export default function App() {
  // Application states
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [currentAtmosphere, setCurrentAtmosphere] = useState<Atmosphere>(ATMOSPHERES.indigo);
  const [currentVoice, setCurrentVoice] = useState<string>("Zephyr");
  const [subtitles, setSubtitles] = useState<string>("");
  const [userTranscript, setUserTranscript] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [timeUtc, setTimeUtc] = useState<string>("");

  // Visual state flags
  const [isNovaSpeaking, setIsNovaSpeaking] = useState<boolean>(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState<boolean>(false);

  // Tools floating notifications
  const [pendingTool, setPendingTool] = useState<{ url: string; name: string; id: string } | null>(null);

  // Audio References for persistent stream control
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const playAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Analyser nodes for visualization
  const [micAnalyser, setMicAnalyser] = useState<AnalyserNode | null>(null);
  const [speakerAnalyser, setSpeakerAnalyser] = useState<AnalyserNode | null>(null);

  // Track dynamic amplitude sizes for UI ripple animations
  const [speakerLevel, setSpeakerLevel] = useState<number>(0);
  const [micLevel, setMicLevel] = useState<number>(0);

  // Keep lists of active AudioBufferSourceNode objects for interruption cancel calls
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);

  // Update real-time clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeUtc(now.toLocaleTimeString("en-US", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync speak level calculations
  useEffect(() => {
    if (!speakerAnalyser || !isNovaSpeaking) {
      setSpeakerLevel(0);
      return;
    }

    let frameId: number;
    const array = new Uint8Array(speakerAnalyser.frequencyBinCount);
    const updateLevel = () => {
      speakerAnalyser.getByteFrequencyData(array);
      let sum = 0;
      for (let i = 0; i < array.length; i++) {
        sum += array[i];
      }
      const avg = sum / array.length;
      setSpeakerLevel(Math.min(1.5, avg / 45)); // normalized scale
      frameId = requestAnimationFrame(updateLevel);
    };
    updateLevel();
    return () => cancelAnimationFrame(frameId);
  }, [speakerAnalyser, isNovaSpeaking]);

  useEffect(() => {
    if (!micAnalyser || isMuted || status !== "connected") {
      setMicLevel(0);
      return;
    }

    let frameId: number;
    const array = new Uint8Array(micAnalyser.frequencyBinCount);
    const updateLevel = () => {
      micAnalyser.getByteFrequencyData(array);
      let sum = 0;
      for (let i = 0; i < array.length; i++) {
        sum += array[i];
      }
      const avg = sum / array.length;
      const rms = avg / 60; // normalized scale
      setIsUserSpeaking(rms > 0.15);
      setMicLevel(Math.min(1.5, rms));
      frameId = requestAnimationFrame(updateLevel);
    };
    updateLevel();
    return () => cancelAnimationFrame(frameId);
  }, [micAnalyser, isMuted, status]);

  // Convert PCM Float32 buffer to Uint8/string base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Convert base64 back into ArrayBuffer
  const base64ToArrayBuffer = (base64: string) => {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return buffer;
  };

  // Stop active sources to cleanly handle barge-in interruption in real-time matches
  const stopAllResponseAudio = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (err) {}
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    setIsNovaSpeaking(false);
  };

  // Stream speaker responses flawlessly
  const handleNextSpeakerAudioChunk = (base64Chunk: string) => {
    const playCtx = playAudioCtxRef.current;
    if (!playCtx) return;

    if (playCtx.state === "suspended") {
      playCtx.resume();
    }

    setIsNovaSpeaking(true);

    const rawBuffer = base64ToArrayBuffer(base64Chunk);
    const int16 = new Int16Array(rawBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = playCtx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = playCtx.createBufferSource();
    source.buffer = audioBuffer;

    const gainNode = playCtx.createGain();
    source.connect(gainNode);
    gainNode.connect(playCtx.destination);

    if (speakerAnalyserRef.current) {
      gainNode.connect(speakerAnalyserRef.current);
    }

    const currentTime = playCtx.currentTime;
    let startTime = nextStartTimeRef.current;

    // Buffer slightly in front to dodge high network latency spikes
    if (startTime < currentTime) {
      startTime = currentTime + 0.08;
    }

    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;

    activeSourcesRef.current.push(source);

    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
      if (activeSourcesRef.current.length === 0) {
        setIsNovaSpeaking(false);
      }
    };
  };

  // Begin capturing inputs
  const startRecordingStream = async () => {
    try {
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioCtxRef.current = inputCtx;

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      streamRef.current = mediaStream;

      const sourceNode = inputCtx.createMediaStreamSource(mediaStream);

      const analyserNode = inputCtx.createAnalyser();
      analyserNode.fftSize = 256;
      setMicAnalyser(analyserNode);
      sourceNode.connect(analyserNode);

      // Create ScriptProcessor script tag for chunk translation
      const procNode = inputCtx.createScriptProcessor(2048, 1, 1);
      processorRef.current = procNode;

      sourceNode.connect(procNode);
      procNode.connect(inputCtx.destination);

      procNode.onaudioprocess = (e) => {
        if (isMuted || wsRef.current?.readyState !== WebSocket.OPEN) return;

        const rawFloats = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(rawFloats.length);
        for (let i = 0; i < rawFloats.length; i++) {
          const sample = Math.max(-1, Math.min(1, rawFloats[i]));
          pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }

        const base64PCM = arrayBufferToBase64(pcm16.buffer);
        wsRef.current.send(JSON.stringify({ audio: base64PCM }));
      };
    } catch (err: any) {
      console.error("Failed to fetch mic stream:", err);
      setErrorMsg("Aapke Microphone ka access nahi mil paya! Please browser settings me permission enable karein.");
    }
  };

  // Speaker Analyser persistent node
  const speakerAnalyserRef = useRef<AnalyserNode | null>(null);

  const initSpeakerAudioContext = () => {
    if (!playAudioCtxRef.current) {
      const playCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      playAudioCtxRef.current = playCtx;

      const analyserNode = playCtx.createAnalyser();
      analyserNode.fftSize = 256;
      speakerAnalyserRef.current = analyserNode;
      setSpeakerAnalyser(analyserNode);
    }
  };

  // Open WebSocket Connection to fullstack server
  const connectToNova = async (voiceToLoad = currentVoice) => {
    if (status !== "disconnected") return;

    setErrorMsg(null);
    setStatus("connecting");

    // Initiate play audio context
    initSpeakerAudioContext();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws-live`;

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = async () => {
      console.log("WebSocket connected successfully");
      // Request requested voice
      if (voiceToLoad !== "Zephyr") {
        socket.send(JSON.stringify({ action: "changeVoice", voice: voiceToLoad }));
      }
      await startRecordingStream();
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        // Handle specific live events
        if (payload.type === "state") {
          if (payload.state === "connected") {
            setStatus("connected");
          } else if (payload.state === "disconnected") {
            disconnectFromNova();
          }
        }

        if (payload.type === "audio") {
          handleNextSpeakerAudioChunk(payload.audio);
        }

        if (payload.type === "subtitle") {
          setSubtitles(payload.text);
          // Auto-dim subtitles after 8s of inactivity
        }

        if (payload.type === "userTranscript") {
          setUserTranscript(payload.text);
        }

        if (payload.type === "interrupted") {
          console.log("NOVA was interrupted! Halting speaking...");
          stopAllResponseAudio();
        }

        if (payload.type === "toolCall") {
          // Open Website tool
          if (payload.name === "openWebsite" && payload.args) {
            setPendingTool({
              url: payload.args.url,
              name: payload.args.name || "Website",
              id: payload.id
            });
          }

          // Change Atmosphere tool
          if (payload.name === "changeAtmosphere" && payload.args?.atmosphere) {
            const requestedTheme = payload.args.atmosphere.toLowerCase();
            if (ATMOSPHERES[requestedTheme]) {
              setCurrentAtmosphere(ATMOSPHERES[requestedTheme]);
            }
          }
        }

        if (payload.error) {
          setErrorMsg(payload.message || "Gemini connect karne me error aayi.");
          disconnectFromNova();
        }
      } catch (wsErr) {
        console.error("Error handling incoming WS message:", wsErr);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed.");
      disconnectFromNova();
    };

    socket.onerror = (err) => {
      console.error("WebSocket transport error:", err);
      setErrorMsg("Network error: Server ke saath connection establish nahi ho paya.");
      disconnectFromNova();
    };
  };

  const disconnectFromNova = () => {
    setStatus("disconnected");
    setIsNovaSpeaking(false);
    setIsUserSpeaking(false);
    setSubtitles("");
    setUserTranscript("");

    // Halt Web Audio nodes
    stopAllResponseAudio();

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {}
      processorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      try {
        inputAudioCtxRef.current.close();
      } catch (e) {}
      inputAudioCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }

    setMicAnalyser(null);
  };

  // Change Voice Mood dynamically instantly bridging new websocket session
  const selectVoicePersonality = (voiceId: string) => {
    setCurrentVoice(voiceId);
    if (status === "connected" && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "changeVoice", voice: voiceId }));
    } else if (status === "disconnected") {
      // Re-trigger connection with specific voice loaded
    }
  };

  // Auto-trigger window open once user confirms the floating tool call notification
  const handleConfirmExecuteTool = () => {
    if (pendingTool) {
      window.open(pendingTool.url, "_blank");
      setPendingTool(null);
    }
  };

  return (
    <div className={`relative flex flex-col items-center justify-between min-h-screen w-full transition-all duration-[1000ms] text-white overflow-hidden bg-gradient-to-b ${currentAtmosphere.bgGradient} font-sans`}>
      
      {/* Background Neural Matrix Grid / Abstract floating graphics */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute inset-x-0 top-0 h-[400px] bg-radial from-white/5 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-purple-500/10 blur-[100px] animate-pulse" style={{ animationDuration: "12s" }} />
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-blue-500/10 blur-[120px] animate-pulse" style={{ animationDuration: "8s" }} />
      </div>

      {/* Header Panel */}
      <header className="relative z-10 flex items-center justify-between w-full max-w-5xl px-6 py-4 border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl bg-gradient-to-br ${status === "connected" ? "from-emerald-500/20 to-teal-500/20 text-emerald-400" : "from-purple-500/10 to-indigo-500/10 text-purple-400"} border border-white/10`}>
            <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: "10s" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">NOVA</h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider">AI GIRLFRIEND ASSISTANT</p>
          </div>
        </div>

        {/* Live System State Indicators */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/5 text-xs text-slate-400 shadow-inner">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-mono">{timeUtc || "16:33:16"} UTC</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                status === "connected" ? "bg-emerald-400" : status === "connecting" ? "bg-amber-400" : "bg-purple-400"
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                status === "connected" ? "bg-emerald-500" : status === "connecting" ? "bg-amber-500" : "bg-purple-500"
              }`}></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              {status === "connected" ? "Online" : status === "connecting" ? "Connecting" : "Offline"}
            </span>
          </div>

          {/* Settings Trigger Icon */}
          <button 
            id="settings-toggle-btn"
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-xl hover:bg-white/5 active:scale-95 border border-white/5 transition bg-slate-900/40 text-slate-300"
            title="Configure Styles & Voice"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Sandbox Interactive Content */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center w-full max-w-5xl px-4 py-6 gap-6 overflow-y-auto">
        
        {/* Playable suggestions & Status dashboard panel (Left grid) */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4 self-stretch justify-center order-2 lg:order-1">
          {/* Sassy Instructions Banner */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-md shadow-2xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-rose-500/10 blur-xl"></div>
            <div className="flex gap-2.5 items-start">
              <span className="text-2xl mt-0.5">💘</span>
              <div>
                <h3 className="text-sm font-semibold tracking-wide text-rose-300">Mohammed Faijan ki AI Gf</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  "Suno Faijan! Mujhse pyaar se baat karo aur jo man haaye poocho. Main har baat ka sassy aur cute jawab dungi. Chalo, power button dabakar mujhse sur jodo!"
                </p>
              </div>
            </div>
            
            <div className="mt-3.5 space-y-2 border-t border-white/5 pt-3">
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span>Active Mood:</span>
                <span className="font-semibold text-rose-400">
                  {VOICES.find(v => v.id === currentVoice)?.name}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span>Language:</span>
                <span className="font-semibold text-teal-400">Pure Hindi only 🇮🇳</span>
              </div>
            </div>
          </div>

          {/* Interactive Tap-to-Talk Seeds */}
          {status === "connected" && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-2"
            >
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest pl-1">Kya kahein? (Say these Out Loud):</span>
              <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {SUGGESTIONS.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      // Text suggestions copyable to clipboard/overlay so user remembers
                      navigator.clipboard.writeText(sug.label.slice(0, -2));
                    }}
                    className="p-2.5 text-left text-xs bg-black/35 hover:bg-white/5 active:bg-white/[0.02] rounded-xl border border-white/5 hover:border-white/10 transition text-slate-200 group flex justify-between items-center"
                    title="Click to copy suggestion text"
                  >
                    <span>{sug.label}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded font-mono">Read Out Loud</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Central Pulsing Brain Core and Orbit Waveforms (Center Grid) */}
        <div id="nova-center-core-panel" className="flex-1 flex flex-col items-center justify-center py-6 min-h-[350px] order-1 lg:order-2">
          
          {/* Orbital rings core */}
          <div className="relative flex items-center justify-center w-72 h-72">
            
            {/* Ambient dynamic radial circles scaled by speak level */}
            <AnimatePresence>
              {isNovaSpeaking && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ 
                    scale: 1 + speakerLevel * 0.4, 
                    opacity: 0.15 - speakerLevel * 0.05 
                  }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 25 }}
                  className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 blur-2xl z-0"
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isUserSpeaking && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ 
                    scale: 1 + micLevel * 0.4, 
                    opacity: 0.15 - micLevel * 0.05 
                  }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 25 }}
                  className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 blur-2xl z-0"
                />
              )}
            </AnimatePresence>

            {/* Core Rotating Symmetrical Borders */}
            <div className={`absolute inset-2 rounded-full border-2 border-dashed border-white/10 animate-spin`} style={{ animationDuration: "25s" }} />
            <div className={`absolute inset-6 rounded-full border border-dotted border-white/5 animate-spin`} style={{ animationDuration: "14s", animationDirection: "reverse" }} />

            {/* Pulsing Core Avatar Ball */}
            <motion.button
              id="nova-core-orb-button"
              onClick={() => {
                if (status === "disconnected") {
                  connectToNova();
                } else {
                  disconnectFromNova();
                }
              }}
              animate={status === "connected" ? {
                scale: isNovaSpeaking ? [1, 1.05, 0.98, 1.05] : [1, 1.02, 1],
              } : {
                scale: [1, 0.97, 1]
              }}
              transition={{
                repeat: Infinity,
                duration: isNovaSpeaking ? 1.5 : 3,
                ease: "easeInOut"
              }}
              className={`absolute w-44 h-44 rounded-full flex flex-col items-center justify-center bg-slate-900 border-2 transition-all duration-700 select-none cursor-pointer z-10 ${
                status === "connected" 
                  ? currentAtmosphere.coreGlow
                  : status === "connecting"
                    ? "border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.3)]"
                    : "border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.25)]"
              }`}
            >
              {/* Pulsing graphics inner */}
              <div className="absolute inset-1.5 rounded-full bg-gradient-to-b from-slate-900 via-slate-950 to-black z-0" />
              
              <div className="relative z-10 flex flex-col items-center select-none">
                {/* Heart Icon for girlfriend aura */}
                <motion.div
                  animate={{
                    scale: status === "connected" ? [1, 1.15, 1] : 1,
                    opacity: status === "connected" ? 1 : 0.6
                  }}
                  transition={{ repeat: Infinity, duration: 1.8 }}
                  className={`mb-2 ${status === "connected" ? currentAtmosphere.accentText : "text-purple-400"}`}
                >
                  <Heart className="w-9 h-9 fill-current" />
                </motion.div>

                <div className="font-bold text-center leading-none tracking-wide text-white">
                  NOVA
                </div>
                
                <div className="text-[10px] mt-1 tracking-widest font-mono text-slate-400 uppercase">
                  {status === "connected" ? "Listening" : status === "connecting" ? "SYNCING..." : "SLEEPING"}
                </div>
              </div>

              {/* Glowing outer orbital active ring */}
              {status === "connected" && (
                <div className="absolute -inset-1 rounded-full border-2 border-white/20 animate-pulse pointer-events-none" />
              )}
            </motion.button>

            {/* Glowing audio amplitude particle rays */}
            <div className="absolute inset-0 pointer-events-none rounded-full flex items-center justify-center z-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <div 
                  key={i} 
                  className="absolute w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: currentAtmosphere.waveColor,
                    transform: `rotate(${i * 60}deg) translateY(${status === "connected" ? 100 + (isNovaSpeaking ? speakerLevel * 25 : isUserSpeaking ? micLevel * 25 : 0) : 95}px)`,
                    opacity: status === "connected" ? 0.8 : 0.2,
                    boxShadow: `0 0 10px ${currentAtmosphere.waveColor}`,
                    transition: "transform 0.15s ease-out, opacity 0.3s transition"
                  }}
                />
              ))}
            </div>
          </div>

          {/* Trigger mic/power connection below orb */}
          <div className="mt-8 flex items-center gap-4">
            
            {/* Main Connection Toggle */}
            <button
              id="power-connection-btn"
              onClick={() => {
                if (status === "disconnected") {
                  connectToNova();
                } else {
                  disconnectFromNova();
                }
              }}
              className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl font-bold tracking-wide transition shadow-xl border cursor-pointer ${
                status === "connected"
                  ? "bg-rose-500 hover:bg-rose-600 border-rose-400 text-white shadow-rose-500/10"
                  : status === "connecting"
                    ? "bg-amber-500 border-amber-400 text-black shadow-amber-500/10"
                    : "bg-white hover:bg-slate-100 text-slate-950 border-white shadow-white/5"
              }`}
            >
              <Power className={`w-5 h-5 ${status === "connecting" ? "animate-spin" : ""}`} />
              <span>
                {status === "connected" ? "Disconnect Gf" : status === "connecting" ? "Connecting..." : "Connect voice call"}
              </span>
            </button>

            {/* Client microphone mute toggle */}
            {status === "connected" && (
              <button
                id="mic-mute-btn"
                onClick={() => setIsMuted(!isMuted)}
                className={`p-3.5 rounded-2xl border transition shadow-lg active:scale-95 cursor-pointer ${
                  isMuted 
                    ? "bg-red-500/25 border-red-500/40 text-red-400 hover:bg-red-500/30" 
                    : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                }`}
                title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Real-time Voice Waveforms / Transcription bubble Panel (Right Grid) */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4 self-stretch justify-center order-3">
          
          {/* Visualizers */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1.5 px-1 font-semibold uppercase tracking-widest">
                <span>NOVA Voice Out (24kHz)</span>
                <span className={isNovaSpeaking ? "text-emerald-400 font-bold" : "text-slate-500"}>
                  {isNovaSpeaking ? "Speaking" : "Muted"}
                </span>
              </div>
              <AudioVisualizer 
                analyser={speakerAnalyser} 
                isActive={isNovaSpeaking} 
                color={currentAtmosphere.waveColor} 
                type="bars" 
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1.5 px-1 font-semibold uppercase tracking-widest">
                <span>Mohammed Faijan Mic In (16kHz)</span>
                <span className={isUserSpeaking && !isMuted ? "text-cyan-400 font-bold" : "text-slate-500"}>
                  {isMuted ? "Muted" : isUserSpeaking && status === "connected" ? "Speaking" : "Listening"}
                </span>
              </div>
              <AudioVisualizer 
                analyser={micAnalyser} 
                isActive={status === "connected" && !isMuted} 
                color={currentAtmosphere.secondaryColor} 
                type="sine" 
              />
            </div>
          </div>

          {/* Subtitles Overlay Panel */}
          <div className="flex-1 min-h-[140px] flex flex-col gap-2.5 p-4 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-md shadow-inner relative justify-end">
            <span className="absolute top-3 left-3 text-[10px] text-slate-500 font-mono tracking-widest uppercase">Live Transcription (subtitle)</span>
            
            <div className="space-y-3 max-h-[140px] overflow-y-auto pr-1">
              <AnimatePresence mode="popLayout">
                {userTranscript && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-2.5 items-start justify-end"
                  >
                    <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tr-sm px-3 py-2 text-xs text-slate-200 shadow-sm max-w-[85%]">
                      <span className="block font-semibold text-[10px] text-slate-400 font-mono mb-0.5">Faijan bin</span>
                      {userTranscript}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-slate-800 border border-white/10 text-[10px] flex items-center justify-center font-bold text-slate-300">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </motion.div>
                )}

                {subtitles && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-2.5 items-start"
                  >
                    <div className="w-6 h-6 rounded-full bg-rose-500/10 border border-rose-500/30 text-[10px] flex items-center justify-center font-bold text-rose-300">
                      N
                    </div>
                    <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl rounded-tl-sm px-3 py-2 text-xs text-rose-200 shadow-sm max-w-[85%]">
                      <span className="block font-semibold text-[10px] text-rose-300 font-mono mb-0.5">NOVA Gf</span>
                      {subtitles}
                    </div>
                  </motion.div>
                )}

                {!subtitles && !userTranscript && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    className="text-xs text-slate-500 text-center pb-2 select-none"
                  >
                    {status === "connected" 
                      ? "Awaj lagaiye Faijan, main sun rahi hoon..." 
                      : "Gf offline hai, power button dabakar use jagayein."}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Website Link Open Banner (Bypasses inline Popup blocking) */}
      <AnimatePresence>
        {pendingTool && (
          <motion.div
            id="toolcall-notification-banner"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 left-6 sm:left-auto sm:w-[380px] z-50 p-4 rounded-2xl bg-slate-900/90 border border-teal-500/40 shadow-2xl shadow-teal-500/10 backdrop-blur-lg flex flex-col gap-3"
          >
            <div className="flex gap-3 items-start">
              <span className="text-3xl">🚀</span>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-teal-400">NOVA has requested an action!</h4>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Nova has triggered tool to open website: <span className="font-semibold text-white">{pendingTool.name}</span>. Bypassing blocker, please click link below!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end pt-1">
              <button
                onClick={() => setPendingTool(null)}
                className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 active:scale-95 rounded-lg border border-white/5 transition text-slate-400 cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="tool-confirm-btn"
                onClick={handleConfirmExecuteTool}
                className="px-4 py-1.5 text-xs bg-teal-500 hover:bg-teal-600 active:scale-95 text-slate-950 font-bold rounded-lg transition flex items-center gap-1.5 shadow-lg shadow-teal-500/15 cursor-pointer"
              >
                <span>Navigate to {pendingTool.name}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global error message banner */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            id="error-notification-banner"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-[380px] z-50 p-4 rounded-xl bg-red-950/90 border border-red-500/30 text-white shadow-2xl flex gap-3 backdrop-blur-md"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-red-300">Alert Notification</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{errorMsg}</p>
              <button
                onClick={() => setErrorMsg(null)}
                className="text-[10px] mt-2 font-semibold text-rose-400 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal slider for Settings / Customizing Gf (Right Overlay) */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 bg-black z-40 cursor-pointer"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed top-0 bottom-0 right-0 w-full max-w-sm z-50 p-6 bg-slate-950 border-l border-white/10 shadow-2xl flex flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Palette className="w-5 h-5 text-purple-400" />
                    <span>Customize NOVA</span>
                  </h3>
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="text-xs font-semibold px-2.5 py-1 hover:bg-white/5 border border-white/5 rounded-lg text-slate-400 cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                {/* Atmosphere switcher */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Choose Backdrop Atmosphere:</label>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.values(ATMOSPHERES).map((atm) => (
                      <button
                        key={atm.id}
                        onClick={() => setCurrentAtmosphere(atm)}
                        className={`p-3 text-left rounded-xl border transition flex justify-between items-center cursor-pointer ${
                          currentAtmosphere.id === atm.id
                            ? "bg-white/10 border-white/20 text-white shadow-inner"
                            : "bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/15"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-100">{atm.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{atm.colorName} Vibe</div>
                        </div>
                        {currentAtmosphere.id === atm.id && (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Voice mood toggler */}
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Voice Personality Mood:</label>
                  <p className="text-[10px] text-slate-500 italic mt-0.5 leading-relaxed">Instantly bridges a fresh real-time session config on the server.</p>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {VOICES.map((voc) => (
                      <button
                        key={voc.id}
                        onClick={() => selectVoicePersonality(voc.id)}
                        className={`p-3 text-left rounded-xl border transition flex flex-col gap-1 cursor-pointer ${
                          currentVoice === voc.id
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-100 shadow-sm"
                            : "bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/15"
                        }`}
                      >
                        <div className="flex justify-between w-full items-center">
                          <span className="text-xs font-bold text-slate-100">{voc.name}</span>
                          <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-slate-400">{voc.mode}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 leading-normal">{voc.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Copyright Info Footer */}
              <div className="pt-6 border-t border-white/5">
                <div className="flex gap-2.5 items-center">
                  <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 text-[10px] flex items-center justify-center font-bold text-slate-300">
                    S
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-300">Faijan's Voice Assistant</h5>
                    <p className="text-[10px] text-slate-500 font-mono tracking-wide">NOVA STABLE BUILD v2.1.2</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Footer credits line */}
      <footer className="relative z-10 w-full text-center py-4 border-t border-white/5 bg-slate-950/20 backdrop-blur-sm">
        <p className="text-[11px] text-slate-500 tracking-wide font-mono">
          Handcrafted with Romance & Web Audio API for <span className="text-rose-400 font-semibold uppercase">Mohammed Faijan</span> ❤️
        </p>
      </footer>
    </div>
  );
}
