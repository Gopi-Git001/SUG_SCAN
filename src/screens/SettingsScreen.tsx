import Constants from 'expo-constants';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  Feather,
  History,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  Lock,
  Star,
  Trash2,
  Vibrate,
  type LucideIcon,
} from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Alert, FlatList, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { verdictColor } from '../components/VerdictPanel';
import { links } from '../config';
import { deleteAccount } from '../lib/api';
import { applyStrictMode, ingredientSummary, maskPhone } from '../lib/display';
import { clearHistory, useHistory } from '../lib/history';
import { type Prefs, setPref, usePrefs } from '../lib/prefs';
import { isConfigured, supabase } from '../lib/supabase';
import { colors, fonts } from '../theme';

type Page = 'settings' | 'history' | 'methodology';
const titles: Record<Page, string> = { settings: 'Settings', history: 'Scan history', methodology: 'How verdicts work' };

/** Full-screen Settings, with the History and "How verdicts work" pages inside it. */
export function SettingsScreen({ visible, onClose, phone }: { visible: boolean; onClose: () => void; phone?: string }) {
  const [page, setPage] = useState<Page>('settings');
  const close = () => {
    setPage('settings');
    onClose();
  };
  const back = () => (page === 'settings' ? close() : setPage('settings'));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={back} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaProvider>
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
          <View style={styles.topBar}>
            <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel={page === 'settings' ? 'Close settings' : 'Back'}>
              <ChevronLeft size={26} color={colors.cardText} />
            </Pressable>
            <Text style={styles.title} accessibilityRole="header">
              {titles[page]}
            </Text>
          </View>
          {page === 'settings' && <SettingsList phone={phone} open={setPage} onAccountGone={close} />}
          {page === 'history' && <HistoryList />}
          {page === 'methodology' && <Methodology />}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

// ---------- Settings ----------

function SettingsList({ phone, open, onAccountGone }: { phone?: string; open: (p: Page) => void; onAccountGone: () => void }) {
  const prefs = usePrefs();
  const history = useHistory();
  const toggle = (key: keyof Prefs) => (value: boolean) => setPref(key, value);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Group title="Account">
        <Row icon={Phone} label="Phone number" value={isConfigured ? maskPhone(phone) : 'Demo mode'} />
        <Row icon={LogOut} label="Sign out" onPress={() => confirmSignOut(onAccountGone)} />
        <Row icon={Trash2} label="Delete account" danger onPress={() => confirmDelete(onAccountGone)} />
      </Group>

      <Group title="Preferences">
        <Row
          icon={ShieldCheck}
          label="Strict mode"
          detail="Stevia and monk fruit count as OKAY at best."
          toggle={{ value: prefs.strict, onChange: toggle('strict') }}
        />
        <Row
          icon={Feather}
          label="Gentle mode"
          detail="For BAD, the cube stays calm instead of crying."
          toggle={{ value: prefs.gentle, onChange: toggle('gentle') }}
        />
        <Row icon={Vibrate} label="Haptics" detail="Vibrate when a verdict appears." toggle={{ value: prefs.haptics, onChange: toggle('haptics') }} />
      </Group>

      <Group title="Data">
        <Row icon={History} label="Scan history" value={`${history.length}`} onPress={() => open('history')} chevron />
        <Row icon={Trash2} label="Clear scan history" onPress={confirmClearHistory} />
      </Group>

      <Group title="About">
        <Row icon={BookOpen} label="How verdicts work" onPress={() => open('methodology')} chevron />
        <Row icon={Lock} label="Privacy policy" onPress={() => openLink(links.privacy)} chevron />
        <Row icon={FileText} label="Terms of use" onPress={() => openLink(links.terms)} chevron />
        <Row icon={Mail} label="Contact support" onPress={() => openLink(`mailto:${links.supportEmail}?subject=QuickGAB%20support`)} chevron />
        <Row icon={Star} label="Rate QuickGAB" onPress={() => openLink(Platform.OS === 'ios' ? links.appStore : links.playStore)} chevron />
      </Group>

      <Text style={styles.version}>QuickGAB {Constants.expoConfig?.version ?? ''}</Text>
    </ScrollView>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

type RowProps = {
  icon: LucideIcon;
  label: string;
  detail?: string;
  value?: string;
  danger?: boolean;
  chevron?: boolean;
  onPress?: () => void;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
};

function Row({ icon: Icon, label, detail, value, danger, chevron, onPress, toggle }: RowProps) {
  const ink = danger ? colors.bad : colors.cardText;
  return (
    <Pressable
      onPress={toggle ? () => toggle.onChange(!toggle.value) : onPress}
      disabled={!onPress && !toggle}
      accessibilityRole={toggle ? 'switch' : onPress ? 'button' : 'text'}
      accessibilityState={toggle ? { checked: toggle.value } : undefined}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Icon size={20} color={danger ? colors.bad : colors.cardTextMuted} strokeWidth={2} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: ink }]}>{label}</Text>
        {detail && <Text style={styles.rowDetail}>{detail}</Text>}
      </View>
      {value !== undefined && <Text style={styles.rowValue}>{value}</Text>}
      {toggle && (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          trackColor={{ false: 'rgba(255,255,255,0.18)', true: colors.clean }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="rgba(255,255,255,0.18)"
        />
      )}
      {chevron && <ChevronRight size={18} color={colors.textFaint} />}
    </Pressable>
  );
}

// ---------- Actions ----------

const demoAlert = () => Alert.alert('Demo mode', 'The backend is not connected yet, so results are fake and there is no account.');

function confirmSignOut(done: () => void) {
  if (!isConfigured) return demoAlert();
  Alert.alert('Sign out?', 'You can sign back in with your phone number.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', onPress: () => supabase.auth.signOut().then(done) },
  ]);
}

function confirmDelete(done: () => void) {
  if (!isConfigured) return demoAlert();
  Alert.alert(
    'Delete account?',
    'This permanently deletes your QuickGAB account and your scan history. It cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteAccount()
            .then(() => {
              clearHistory();
              done();
            })
            .catch((e: Error) => Alert.alert('Delete failed', e.message)),
      },
    ],
  );
}

function confirmClearHistory() {
  Alert.alert('Clear scan history?', 'This removes every saved scan from this phone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: clearHistory },
  ]);
}

function openLink(url: string) {
  Linking.openURL(url).catch(() => Alert.alert("Couldn't open link", url));
}

// ---------- History ----------

function HistoryList() {
  const history = useHistory();
  const { strict } = usePrefs();
  return (
    <FlatList
      data={history}
      keyExtractor={(e) => e.id}
      contentContainerStyle={styles.content}
      ListEmptyComponent={<Text style={styles.empty}>No scans yet. Your last 50 scans will show here.</Text>}
      renderItem={({ item, index }) => {
        const result = applyStrictMode(item.result, strict);
        const color = verdictColor[result.verdict];
        return (
          <View style={[styles.historyRow, index === 0 && styles.first, index === history.length - 1 && styles.last]}>
            <View style={[styles.badge, styles.historyBadge, { backgroundColor: `${color}29` }]}>
              <Text style={[styles.badgeText, { color }]}>{result.verdict}</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {result.headline}
              </Text>
              <Text style={styles.rowDetail} numberOfLines={1}>
                {ingredientSummary(result)}
              </Text>
            </View>
            <Text style={styles.historyDate}>{formatDate(item.date)}</Text>
          </View>
        );
      }}
    />
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}\n${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

// ---------- How verdicts work ----------

const rules: { verdict: keyof typeof verdictColor; text: string }[] = [
  { verdict: 'CLEAN', text: 'No added sugar and no sweeteners. Sugars that are naturally in the food, like the lactose in milk or the fructose in fruit, are fine.' },
  { verdict: 'OKAY', text: 'A little added sugar (1–4 g per serving), sugar alcohols such as erythritol, or plant sweeteners such as stevia and monk fruit.' },
  { verdict: 'BAD', text: 'Artificial sweeteners such as aspartame or sucralose, alcohol, or more than 4 g of added sugar per serving.' },
];

function Methodology() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.paragraph}>
        QuickGAB reads the ingredient list and the nutrition panel from your photo. Fixed rules then decide the verdict, so the same label
        always gets the same answer.
      </Text>
      {rules.map((r) => (
        <View key={r.verdict} style={styles.ruleCard}>
          <View style={[styles.badge, { backgroundColor: `${verdictColor[r.verdict]}29`, alignSelf: 'flex-start' }]}>
            <Text style={[styles.badgeText, { color: verdictColor[r.verdict] }]}>{r.verdict}</Text>
          </View>
          <Text style={styles.ruleText}>{r.text}</Text>
        </View>
      ))}
      <Text style={styles.paragraph}>
        If the label doesn't show how many grams of added sugar there are, any added sugar counts as OKAY and QuickGAB asks you to scan the
        nutrition panel.
      </Text>
      <Text style={styles.paragraph}>
        With Strict mode off, a product whose only sweetener is stevia, monk fruit or a similar plant sweetener shows as CLEAN.
      </Text>
      <Text style={styles.muted}>Not medical advice. QuickGAB doesn't check allergens.</Text>
    </ScrollView>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, paddingHorizontal: 12 },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.cardText },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  group: { marginTop: 20 },
  groupTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupCard: { backgroundColor: '#16161C', borderRadius: 14, overflow: 'hidden' },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    marginTop: -StyleSheet.hairlineWidth, // hides the first row's top line
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.05)' },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: fonts.medium, fontSize: 16, color: colors.cardText },
  rowDetail: { fontFamily: fonts.regular, fontSize: 13, color: colors.cardTextMuted, marginTop: 2 },
  rowValue: { fontFamily: fonts.medium, fontSize: 15, color: colors.cardTextMuted },
  version: { fontFamily: fonts.regular, fontSize: 13, color: colors.textFaint, textAlign: 'center', marginTop: 28 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  historyRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#16161C',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  first: { marginTop: 16, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderTopWidth: 0 },
  last: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  historyBadge: { width: 58, alignItems: 'center' }, // same width, so the text column lines up
  historyDate: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.cardTextMuted, textAlign: 'right' },
  empty: { fontFamily: fonts.regular, fontSize: 15, color: colors.cardTextMuted, textAlign: 'center', marginTop: 48 },
  paragraph: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.cardText, marginTop: 16 },
  ruleCard: { backgroundColor: '#16161C', borderRadius: 14, padding: 16, marginTop: 12, gap: 8 },
  ruleText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.cardText },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.textFaint, marginTop: 24 },
});
