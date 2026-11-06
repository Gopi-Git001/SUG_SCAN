import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import type { ScanResult, Verdict } from '../types';
import { CubeIcon, DropIcon, LeafIcon } from './Icons';

export const verdictColor: Record<Verdict, string> = { CLEAN: colors.clean, OKAY: colors.okay, BAD: colors.bad };

// Badge text sits on a 16% tint of its colour; BAD's rose is lifted slightly to keep 4.5:1 contrast over bright photos.
const badgeInk: Record<Verdict, string> = { ...verdictColor, BAD: '#FD8A9B' };

const sectionColor = { natural: '#34D399', added: '#FBBF24', sweeteners: '#60A5FA' };
const SECTION_ICON = 14;

// Collapsed or not, remembered until the app is closed.
let collapsedThisSession = false;

/** Top-right dark status card: verdict, then the sugar lists that apply. Scrolls inside if taller than `maxHeight`. */
export function VerdictPanel({ result, maxHeight }: { result: ScanResult; maxHeight: number }) {
  const [collapsed, setCollapsed] = useState(collapsedThisSession);
  const color = verdictColor[result.verdict];
  const sections = [
    { title: 'Natural sugars', items: result.naturalSugars, color: sectionColor.natural, Icon: LeafIcon },
    { title: 'Added sugars', items: result.addedSugars, color: sectionColor.added, Icon: CubeIcon },
    { title: 'Sweeteners', items: result.sweeteners, color: sectionColor.sweeteners, Icon: DropIcon },
  ].filter((s) => s.items.length > 0);

  const toggle = () => {
    collapsedThisSession = !collapsed;
    setCollapsed(collapsedThisSession);
  };

  return (
    <View style={[styles.card, { maxHeight }]}>
      <View style={styles.verdictRow}>
        <Text style={[styles.verdict, { color }]} accessibilityRole="header">
          {result.verdict}
        </Text>
        <View style={[styles.badge, { backgroundColor: `${color}29` /* 16% */ }]}>
          <Text style={[styles.badgeText, { color: badgeInk[result.verdict] }]}>{result.verdict}</Text>
        </View>
        <View style={styles.spacer} />
        <Pressable
          onPress={toggle}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Show details' : 'Hide details'}
          style={collapsed && styles.chevronCollapsed}
        >
          <ChevronDown size={20} color={colors.cardTextMuted} strokeWidth={2.5} />
        </Pressable>
      </View>

      {!collapsed && (
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false} bounces={false}>
          <Text style={styles.secondary}>{result.headline}</Text>

          {sections.map((s) => (
            <View key={s.title} style={styles.section}>
              <View style={styles.labelRow}>
                <s.Icon size={SECTION_ICON} color={s.color} />
                <Text style={[styles.label, { color: s.color }]}>{s.title}</Text>
              </View>
              {s.items.map((item) => (
                <Text key={item} style={styles.item}>
                  {item}
                </Text>
              ))}
            </View>
          ))}

          {result.note && <Text style={[styles.secondary, styles.note]}>{result.note}</Text>}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    boxShadow: '0px 6px 20px rgba(0,0,0,0.4)',
  },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verdict: { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 26 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  spacer: { flex: 1 },
  chevronCollapsed: { transform: [{ rotate: '180deg' }] },
  body: { flexGrow: 0 },
  secondary: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.cardTextMuted, marginTop: 2 },
  section: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.cardBorder, gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  label: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  item: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.cardText },
  note: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.cardBorder },
});
