import { useEffect, useRef, useState } from "react";
import { Volume2, Square } from "lucide-react";

// Only one utterance may play at a time across the whole app.
let currentAudio: HTMLAudioElement | null = null;

function stopCurrentAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.src = "";
    } catch {
      /* noop */
    }
    currentAudio = null;
  }
}

export function SpeakButton({
  text,
  auto = false,
  label = "다시 듣기",
}: {
  text: string;
  auto?: boolean;
  label?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const aliveRef = useRef(true);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      if (currentAudio === audioRef.current) stopCurrentAudio();
      else {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      audioRef.current = null;
    }
    setPlaying(false);
    setLoading(false);
  };

  const play = async () => {
    if (playing) {
      stop();
      return;
    }
    if (!text.trim()) return;
    stopCurrentAudio();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      if (controller.signal.aborted || !aliveRef.current) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      stopCurrentAudio();
      currentAudio = audio;
      audio.onended = () => {
        if (currentAudio === audio) currentAudio = null;
        setPlaying(false);
      };
      audio.onpause = () => setPlaying(false);
      setPlaying(true);
      await audio.play();
    } catch (e) {
      if (!controller.signal.aborted) console.error(e);
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auto && text) {
      const t = setTimeout(() => play(), 300);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, auto]);

  // Stop playback and any pending request when this screen unmounts.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      if (audioRef.current) {
        if (currentAudio === audioRef.current) stopCurrentAudio();
        else {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <button
      type="button"
      onClick={play}
      className="inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-3 text-lg font-semibold text-secondary-foreground shadow-sm active:scale-95"
      aria-label={playing ? "듣기 중지" : "음성으로 듣기"}
    >
      {playing ? <Square className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
      {loading ? "준비 중..." : playing ? "중지" : label}
    </button>
  );
}
