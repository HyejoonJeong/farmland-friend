// Microphone recorder that yields a complete audio blob on stop.
export interface Recorder {
  stop: () => Promise<Blob>;
  cancel: () => void;
  mimeType: string;
  stream: MediaStream;
  onLevel?: (v: number) => void;
}

export async function startRecorder(
  onLevel?: (v: number) => void,
): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const mimeCandidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  const mimeType =
    mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  rec.start();

  // level meter
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  src.connect(analyser);
  const buf = new Uint8Array(analyser.frequencyBinCount);
  let raf = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    onLevel?.(Math.min(1, Math.sqrt(sum / buf.length) * 3));
    raf = requestAnimationFrame(tick);
  };
  tick();

  const cleanup = () => {
    cancelAnimationFrame(raf);
    ctx.close().catch(() => {});
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    mimeType: rec.mimeType || "audio/webm",
    stream,
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          cleanup();
          const blob = new Blob(chunks, {
            type: rec.mimeType || "audio/webm",
          });
          resolve(blob);
        };
        rec.stop();
      }),
    cancel: () => {
      try {
        rec.stop();
      } catch {}
      cleanup();
    },
  };
}