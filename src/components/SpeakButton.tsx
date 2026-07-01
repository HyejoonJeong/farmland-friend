import { useEffect, useRef, useState } from "react";
import { Volume2, Square } from "lucide-react";

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
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  const play = async () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onpause = () => setPlaying(false);
      setPlaying(true);
      await audio.play();
    } catch (e) {
      console.error(e);
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

  useEffect(() => () => audioRef.current?.pause(), []);

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