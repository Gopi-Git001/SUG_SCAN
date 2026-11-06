// Shared screen chrome: the top header, the profile button, the photo fades and the disclaimer footer.
import { LinearGradient } from 'expo-linear-gradient';
import { Menu, User } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { type DimensionValue, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

/** Top-right pill (person + ☰) that opens Settings. */
export function ProfileButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      style={({ pressed }) => [styles.profile, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        <User size={16} color={colors.cardText} strokeWidth={2.25} />
      </View>
      <Menu size={20} color={colors.cardText} strokeWidth={2.25} />
    </Pressable>
  );
}

export function Header({ right, tagline = 'Scan. Know. Choose better.' }: { right?: ReactNode; tagline?: string }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>QuickGAB</Text>
        <Text style={styles.tagline}>{tagline}</Text>
      </View>
      <View style={styles.actions}>{right}</View>
    </View>
  );
}

export function Footer() {
  return <Text style={styles.footer}>Not medical advice · Doesn't check allergens</Text>;
}

/** Dark gradients at the top and bottom so white text stays readable over any photo. */
export function Scrims({ topHeight = 170 }: { topHeight?: DimensionValue }) {
  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
        style={[StyleSheet.absoluteFill, { bottom: undefined, height: topHeight }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(11,11,15,0)', 'rgba(11,11,15,0.92)']}
        style={[StyleSheet.absoluteFill, { top: undefined, height: 260 }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingRight: 12,
    paddingTop: 8,
  },
  brand: { fontFamily: fonts.bold, fontSize: 24, color: colors.text, letterSpacing: -0.3 },
  tagline: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  profile: {
    height: 40,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 12,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  footer: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textFaint,
    textAlign: 'center',
    paddingVertical: 14,
  },
});
