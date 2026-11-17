import { test, expect } from "bun:test";
import { startRecorder } from "../src/lib/recorder";

async function environment(run: (state: ReturnType<typeof mocks>) => Promise<void>) {
  const state = mocks();
  const values = {
    navigator: { mediaDevices: { getUserMedia: async () => state.stream } },
    MediaRecorder: state.MediaRecorder,
    AudioContext: state.AudioContext,
    requestAnimationFrame: state.requestAnimationFrame,
    cancelAnimationFrame: state.cancelAnimationFrame,
  };
  const saved = new Map(
    Object.keys(values).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(values))
    Object.defineProperty(globalThis, key, { configurable: true, value });
  try {
    await run(state);
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}
function mocks() {
  const state = {
    tracksStopped: 0,
    contexts: 0,
    contextsClosed: 0,
    stopCalls: 0,
    failSetup: false,
    failStart: false,
    failMeter: false,
    supported: "audio/webm;codecs=opus",
    frames: new Map<number, FrameRequestCallback>(),
    nextFrame: 1,
    stream: {
      getTracks: () => [
        {
          stop: () => {
            state.tracksStopped++;
          },
        },
      ],
    } as unknown as MediaStream,
    instance: null as any,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      const id = state.nextFrame++;
      state.frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id: number) => {
      state.frames.delete(id);
    },
    MediaRecorder: class {
      static isTypeSupported(type: string) {
        return type === state.supported;
      }
      state = "inactive";
      mimeType: string;
      onstop?: () => void;
      onerror?: () => void;
      ondataavailable?: (event: { data: Blob }) => void;
      constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
        if (state.failSetup) throw Error("setup");
        state.instance = this;
        this.mimeType = options?.mimeType ?? "audio/default";
      }
      start() {
        if (state.failStart) throw Error("start");
        this.state = "recording";
      }
      stop() {
        state.stopCalls++;
        this.state = "inactive";
      }
    },
    AudioContext: class {
      constructor() {
        state.contexts++;
        if (state.failMeter) throw Error("meter");
      }
      createMediaStreamSource() {
        return { connect: () => {} };
      }
      createAnalyser() {
        return {
          fftSize: 0,
          frequencyBinCount: 256,
          getByteTimeDomainData: (buf: Uint8Array) => buf.fill(140),
        };
      }
      async close() {
        state.contextsClosed++;
      }
    },
  };
  return state;
}

test("opinion input records without allocating an AudioContext or animation loop", async () =>
  environment(async (s) => {
    const rec = await startRecorder();
    expect(s.contexts).toBe(0);
    expect(s.frames.size).toBe(0);
    const result = rec.stop();
    s.instance.ondataavailable({ data: new Blob(["complete audio"]) });
    s.instance.onstop();
    expect(await (await result).text()).toBe("complete audio");
    expect(s.tracksStopped).toBe(1);
  }));
test("repeated stop uses one pending result and retains the final media chunk", async () =>
  environment(async (s) => {
    const rec = await startRecorder();
    const first = rec.stop();
    const second = rec.stop();
    expect(first).toBe(second);
    expect(s.stopCalls).toBe(1);
    s.instance.ondataavailable({ data: new Blob(["last chunk"]) });
    s.instance.onstop();
    expect(await (await second).text()).toBe("last chunk");
    expect(await rec.stop()).toBe(await first);
  }));
test("cancel releases the microphone immediately and rejects an in-flight stop", async () =>
  environment(async (s) => {
    const rec = await startRecorder();
    const pending = rec.stop();
    rec.cancel();
    rec.cancel();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(s.tracksStopped).toBe(1);
    expect(s.stopCalls).toBe(1);
    s.instance.onstop();
    expect(s.tracksStopped).toBe(1);
  }));
test("setup and start failures do not retain a microphone stream", async () => {
  for (const failure of ["failSetup", "failStart"] as const)
    await environment(async (s) => {
      s[failure] = true;
      await expect(startRecorder()).rejects.toThrow();
      expect(s.tracksStopped).toBe(1);
    });
});
test("meter failure still permits recording", async () =>
  environment(async (s) => {
    s.failMeter = true;
    const rec = await startRecorder(() => {});
    expect(s.instance.state).toBe("recording");
    rec.cancel();
    expect(s.tracksStopped).toBe(1);
  }));
test("visual meter updates at most 10 times per second and stops after cancellation", async () =>
  environment(async (s) => {
    const levels: number[] = [];
    const rec = await startRecorder((v) => levels.push(v));
    for (let time = 0; time < 1000; time += 16) {
      const [id, callback] = s.frames.entries().next().value!;
      s.frames.delete(id);
      callback(time);
    }
    expect(levels.length).toBeGreaterThanOrEqual(8);
    expect(levels.length).toBeLessThanOrEqual(10);
    expect(levels.every((v) => v >= 0 && v <= 1)).toBe(true);
    rec.cancel();
    expect(s.frames.size).toBe(0);
    expect(s.contextsClosed).toBe(1);
  }));
test("recording errors release resources and reject stop instead of hanging", async () =>
  environment(async (s) => {
    const rec = await startRecorder();
    const pending = rec.stop();
    s.instance.onerror();
    await expect(pending).rejects.toThrow("녹음을 완료하지 못했어요.");
    expect(s.tracksStopped).toBe(1);
  }));
test("Safari-compatible MP4 is selected when WebM is not supported", async () =>
  environment(async (s) => {
    s.supported = "audio/mp4";
    const rec = await startRecorder();
    expect(rec.mimeType).toBe("audio/mp4");
    rec.cancel();
  }));
