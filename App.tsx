import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import type { Session } from '@supabase/supabase-js';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { scanLabel } from './src/lib/api';
import { applyStrictMode } from './src/lib/display';
import { recordScan } from './src/lib/history';
import { getPrefs, usePrefs } from './src/lib/prefs';
import { isConfigured, supabase } from './src/lib/supabase';
import { placeholderResults } from './src/placeholderResults';
import { CameraScreen } from './src/screens/CameraScreen';
import { ResultScreen, type ScanState } from './src/screens/ResultScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { colors } from './src/theme';
import type { ScanResult, Verdict } from './src/types';

// Without Supabase settings in .env the app runs in demo mode: no sign-in, fake results.
const DEMO_TAGLINE = 'Demo mode · fake results';
let demoCount = 0;
const demoScan = () =>
  new Promise<ScanResult>((resolve) =>
    setTimeout(() => resolve(placeholderResults[demoCount++ % placeholderResults.length]), 1600),
  );

type Scan = { photoUri: string; state: ScanState };

const verdictHaptic: Record<Verdict, Haptics.NotificationFeedbackType> = {
  CLEAN: Haptics.NotificationFeedbackType.Success,
  OKAY: Haptics.NotificationFeedbackType.Warning,
  BAD: Haptics.NotificationFeedbackType.Error,
};

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const [session, setSession] = useState<Session | null | undefined>(isConfigured ? undefined : null);
  const [scan, setScan] = useState<Scan | null>(null);
  const scanId = useRef(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const prefs = usePrefs();

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Signing out (or deleting the account) returns to the sign-in screen.
  useEffect(() => {
    if (session === null && isConfigured) {
      setScan(null);
      setSettingsOpen(false);
    }
  }, [session]);

  const handleCapture = async (photoUri: string) => {
    const id = ++scanId.current;
    setScan({ photoUri, state: { status: 'reading' } });
    let state: ScanState;
    try {
      const result = isConfigured ? await scanLabel(photoUri) : await demoScan();
      state = { status: 'done', result };
    } catch (e) {
      state = { status: 'error', message: e instanceof Error ? e.message : "Couldn't read the label." };
    }
    // Ignore a result that arrives after the user already left this scan.
    if (id !== scanId.current) return;
    setScan({ photoUri, state });
    if (state.status === 'done') {
      recordScan(state.result);
      const { strict, haptics } = getPrefs();
      if (haptics) Haptics.notificationAsync(verdictHaptic[applyStrictMode(state.result, strict).verdict]).catch(() => {});
    }
  };

  const handleScanAnother = () => {
    scanId.current++;
    setScan(null);
  };

  const tagline = isConfigured ? undefined : DEMO_TAGLINE;
  const openSettings = () => setSettingsOpen(true);
  // Strict mode is applied on the device to the verdict shown; the server result is kept as is.
  const shownState: ScanState | undefined =
    scan?.state.status === 'done' ? { ...scan.state, result: applyStrictMode(scan.state.result, prefs.strict) } : scan?.state;
  const ready = fontsLoaded && session !== undefined;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {ready &&
          (isConfigured && !session ? (
            <SignInScreen />
          ) : scan ? (
            <ResultScreen
              photoUri={scan.photoUri}
              state={shownState ?? scan.state}
              onScanAnother={handleScanAnother}
              onOpenSettings={openSettings}
              gentle={prefs.gentle}
              tagline={tagline}
            />
          ) : (
            <CameraScreen onCapture={handleCapture} onOpenSettings={openSettings} tagline={tagline} />
          ))}
        {ready && <SettingsScreen visible={settingsOpen} onClose={() => setSettingsOpen(false)} phone={session?.user.phone} />}
      </View>
    </SafeAreaProvider>
  );
}
