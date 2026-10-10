import { useSyncExternalStore } from "react";
import type { Survey } from "@/types/survey";

/**
 * Practice-side working copy of the template draft (Milestone 3).
 * Loaded from the server; edits stay local (with Undo) until Save draft or Publish writes them.
 */
interface State {
  survey: Survey | null;
  history: { survey: Survey; diff: string[] }[];
  savedRevision: number;
  dirty: boolean;
}

const initial: State = { survey: null, history: [], savedRevision: 0, dirty: false };
let state: State = initial;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const surveyStore = {
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
  get: () => state,
  load(survey: Survey, revision: number) {
    if (state.dirty && state.survey) return; // keep unsaved local edits
    state = { survey, history: [], savedRevision: revision, dirty: false }; emit();
  },
  forceLoad(survey: Survey, revision: number) { state = { survey, history: [], savedRevision: revision, dirty: false }; emit(); },
  commit(survey: Survey, diff: string[]) {
    if (!state.survey) return;
    state = { ...state, history: [...state.history, { survey: state.survey, diff }].slice(-20), survey, dirty: true }; emit();
  },
  undo() {
    const last = state.history.at(-1); if (!last) return;
    const history = state.history.slice(0, -1);
    state = { ...state, survey: last.survey, history, dirty: history.length > 0 || state.dirty }; emit();
  },
  markSaved(revision: number) { state = { ...state, savedRevision: revision, dirty: false }; emit(); },
};

export function useSurveyStore(): State {
  return useSyncExternalStore(surveyStore.subscribe, surveyStore.get, () => initial);
}
