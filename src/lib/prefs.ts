import { stored } from './stored';
import { isConfigured, supabase } from './supabase';

export type Prefs = {
  /** Plant sweeteners (stevia, monk fruit…) keep a product at OKAY at best. On = the server's own rule. */
  strict: boolean;
  /** For BAD, the character shows its calm reaction instead of crying. */
  gentle: boolean;
  /** Vibrate when a verdict appears. */
  haptics: boolean;
};

// The account's settings live on the profiles row. This local copy makes them work offline;
// `unsynced` marks a change the server hasn't confirmed yet, so it is sent again later instead of being overwritten.
type Saved = Prefs & { unsynced?: boolean };

export type PrefsRow = { strict_mode: boolean; gentle_mode: boolean; haptics: boolean };

const defaults: Prefs = { strict: true, gentle: false, haptics: true };

const store = stored<Saved>('quickgab.prefs', defaults, (saved) => ({ ...defaults, ...(saved as Partial<Saved>) }));

const toRow = (p: Prefs): PrefsRow => ({ strict_mode: p.strict, gentle_mode: p.gentle, haptics: p.haptics });

export const getPrefs = store.get;
export const usePrefs = store.use;

/** Sends the local settings to the profile; clears `unsynced` once the server has them. */
async function push() {
  if (!isConfigured) return;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;
  const sent = store.get();
  const { error } = await supabase.from('profiles').update(toRow(sent)).eq('id', userId);
  // Only clear the flag if nothing changed while the request was in flight.
  if (!error && store.get() === sent) store.set({ ...sent, unsynced: false });
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  store.set({ ...store.get(), [key]: value, unsynced: true });
  push().catch(() => {}); // Offline: stays unsynced and is sent on the next sync.
}

/** After loading the profile: send local changes the server hasn't seen, otherwise take the server's values. */
export async function syncPrefs(row: PrefsRow | null) {
  await store.loaded;
  if (store.get().unsynced) return push();
  if (row) store.set({ strict: row.strict_mode, gentle: row.gentle_mode, haptics: row.haptics });
}

export const resetPrefs = () => store.set(defaults);
