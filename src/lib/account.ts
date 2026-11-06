// The signed-in user's profile (name, stats) with a local copy, plus sign-out and delete.
import { deleteAccount } from './api';
import { clearHistory } from './history';
import { type PrefsRow, resetPrefs, syncPrefs } from './prefs';
import { stored } from './stored';
import { isConfigured, supabase } from './supabase';

export type Stats = { total: number; clean: number; okay: number; bad: number };
type Profile = { displayName: string | null; stats: Stats | null };

const empty: Profile = { displayName: null, stats: null };
const store = stored<Profile>('quickgob.profile', empty, (saved) => ({ ...empty, ...(saved as Partial<Profile>) }));

export const useProfile = store.use;

async function userId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Loads the name and settings from the profiles row. Offline: the local copy stays as it is. */
export async function syncProfile() {
  if (!isConfigured) return;
  const id = await userId();
  if (!id) return;
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, strict_mode, gentle_mode, haptics')
    .eq('id', id)
    .maybeSingle<PrefsRow & { display_name: string | null }>();
  if (error) return;
  await store.loaded;
  if (data) store.set({ ...store.get(), displayName: data.display_name });
  await syncPrefs(data);
}

/** Saves a new display name (empty clears it). Throws if the server can't be reached. */
export async function saveDisplayName(name: string) {
  const id = await userId();
  if (!id) throw new Error('Not signed in.');
  const displayName = name.trim().slice(0, 40) || null;
  const { error } = await supabase.from('profiles').update({ display_name: displayName }).eq('id', id);
  if (error) throw new Error("Couldn't save your name. Check your connection and try again.");
  store.set({ ...store.get(), displayName });
}

/** Totals per verdict from the scans table (RLS returns only this user's rows). */
export async function syncStats() {
  if (!isConfigured) return;
  const count = async (verdict?: string) => {
    let query = supabase.from('scans').select('id', { count: 'exact', head: true });
    if (verdict) query = query.eq('verdict', verdict);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  };
  try {
    const [total, clean, okay, bad] = await Promise.all([count(), count('clean'), count('okay'), count('bad')]);
    store.set({ ...store.get(), stats: { total, clean, okay, bad } });
  } catch {
    // Offline: keep showing the last known stats.
  }
}

function clearLocalCache() {
  store.set(empty);
  resetPrefs();
}

export async function signOut() {
  await supabase.auth.signOut();
  clearLocalCache();
}

/** Deletes the account on the server (scans, profile, user), then everything kept on this phone. */
export async function deleteAccountAndData() {
  await deleteAccount();
  clearLocalCache();
  clearHistory();
}
