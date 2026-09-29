import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IntentKey } from "./data";

export interface IntentResult {
  intent: IntentKey;
  confidence: number;
  summary: string;
  followUp?: string;
  needsClarification: boolean;
}

interface AppState {
  region: string | null;
  transcript: string;
  clarification: string;
  intent: IntentResult | null;
  setRegion: (r: string) => void;
  setTranscript: (t: string) => void;
  appendClarification: (t: string) => void;
  setIntent: (i: IntentResult | null) => void;
  reset: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      region: null,
      transcript: "",
      clarification: "",
      intent: null,
      setRegion: (region) => set({ region }),
      setTranscript: (transcript) => set({ transcript, intent: null, clarification: "" }),
      appendClarification: (t) =>
        set((s) => ({ clarification: (s.clarification + " " + t).trim() })),
      setIntent: (intent) => set({ intent }),
      reset: () => set({ transcript: "", clarification: "", intent: null }),
    }),
    {
      name: "nongji-app",
      version: 2,
      migrate: (persisted, version) => {
        if (version < 2) {
          const state = persisted as Partial<AppState>;
          return { ...state, intent: null, transcript: "", clarification: "" };
        }
        return persisted as AppState;
      },
    },
  ),
);