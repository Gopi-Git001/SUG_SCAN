import { stored } from './stored';

export type Prefs = {
  /** Plant sweeteners (stevia, monk fruit…) keep a product at OKAY at best. On = the server's own rule. */
  strict: boolean;
  /** For BAD, the character shows its calm reaction instead of crying. */
  gentle: boolean;
  /** Vibrate when a verdict appears. */
  haptics: boolean;
};

const defaults: Prefs = { strict: true, gentle: false, haptics: true };

const store = stored<Prefs>('quickgab.prefs', defaults, (saved) => ({ ...defaults, ...(saved as Partial<Prefs>) }));

export const getPrefs = store.get;
export const usePrefs = store.use;
export const setPref = <K extends keyof Prefs>(key: K, value: Prefs[K]) => store.set({ ...store.get(), [key]: value });
