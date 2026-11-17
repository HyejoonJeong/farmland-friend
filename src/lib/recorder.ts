// A complete recording owns its stream until stop/cancel, including failed setup.
export interface Recorder {
  stop: () => Promise<Blob>;
  cancel: () => void;
  mimeType: string;
  stream: MediaStream;
  onLevel?: (v: number) => void;
}

export async function startRecorder(onLevel?: (v: number) => void): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  let ctx: AudioContext | undefined;
  let raf: number | undefined;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (raf !== undefined) cancelAnimationFrame(raf);
    void ctx?.close().catch(() => {});
    stream.getTracks().forEach((track) => track.stop());
  };

  try {
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    let chunks: BlobPart[] = [];
    let finished = false;
    let failure: Error | undefined;
    let stopped: Promise<Blob> | undefined;
    let resolve: ((blob: Blob) => void) | undefined;
    let reject: ((reason: Error) => void) | undefined;
    const blob = () => new Blob(chunks, { type: rec.mimeType || "audio/webm" });
    rec.ondataavailable = (event) => {
      if (!failure && event.data.size) chunks.push(event.data);
    };
    rec.onstop = () => {
      finished = true;
      cleanup();
      if (failure) reject?.(failure);
      else resolve?.(blob());
    };
    rec.onerror = () => {
      failure = new Error("녹음을 완료하지 못했어요.");
      cleanup();
      reject?.(failure);
    };

    // Opinion input needs no meter. Avoid creating an AudioContext or RAF loop there.
    if (onLevel) {
      try {
        ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        let previous = -Infinity;
        const tick = (time: number) => {
          if (cleaned) return;
          // The visual level needs at most 10 updates/sec, not a React render every frame.
          if (time - previous >= 100) {
            previous = time;
            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (const sample of buf) sum += ((sample - 128) / 128) ** 2;
            onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3));
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        // A missing visual meter must not prevent voice recording.
        void ctx?.close().catch(() => {});
        ctx = undefined;
      }
    }
    rec.start();
    return {
      stream,
      mimeType: rec.mimeType || "audio/webm",
      stop: () => {
        if (stopped) return stopped;
        stopped = new Promise<Blob>((done, fail) => {
          resolve = done;
          reject = fail;
          if (failure) return fail(failure);
          if (finished) return done(blob());
          try {
            if (rec.state !== "inactive") rec.stop();
          } catch (error) {
            cleanup();
            fail(error);
          }
        });
        return stopped;
      },
      cancel: () => {
        failure = new DOMException("Aborted", "AbortError");
        chunks = [];
        try {
          if (rec.state !== "inactive") rec.stop();
        } catch {}
        cleanup();
        reject?.(failure);
      },
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
