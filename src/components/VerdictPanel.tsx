import { Box, Check, Droplet, Leaf, type LucideIcon, Minus, X } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, type TextStyle, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ingredientNames } from '../lib/ingredients';
import { fitsTwoLines, planCut } from '../lib/panelLayout';
import { colors, fonts } from '../theme';
import type { ScanResult, Verdict } from '../types';

export const verdictColor: Record<Verdict, string> = { CLEAN: colors.clean, OKAY: colors.okay, BAD: colors.bad };
const verdictGlyph: Record<Verdict, LucideIcon> = { CLEAN: Check, OKAY: Minus, BAD: X };

// Typing: letters share one 800 ms budget (at most 25 ms each). Each line fades and slides in over 120 ms.
const REVEAL_MS = 800;
const MAX_LETTER_MS = 25;
const FADE_MS = 120;

// Layout
const PANEL_WIDTH = 0.58; // of the screen width
const VERDICT_ICON = 36;
const ICON_COLUMN = 28;
const ICON_GAP = 6;
const ITEM_INDENT = ICON_COLUMN + ICON_GAP; // 34: items line up with the title text
const ITEM_GAP = 6;
const SECTION_GAP = 12;
const AFTER_VERDICT = 14;
const GRID_MIN_ITEMS = 4;
const GRID_GAP = 6;
const GRID_PILL_PADDING_X = 6;
const GRID_FONT_SIZES = [14, 13, 12]; // the whole section steps down until every name fits
const PILL_PADDING_X = 8;
const STROKE = 2.5;

const SECTIONS = [
  { title: 'Natural sugars', key: 'naturalSugars', Icon: Leaf },
  { title: 'Added sugars', key: 'addedSugars', Icon: Box },
  { title: 'Sweeteners', key: 'sweeteners', Icon: Droplet },
] as const;

type Section = { key: string; title: string; Icon: LucideIcon; names: string[] };
type Row =
  | { kind: 'verdict'; key: string }
  | { kind: 'title'; key: string; section: Section }
  | { kind: 'items'; key: string; names: string[]; gridFontSize?: number };

type Props = {
  result: ScanResult;
  /** Height the panel may use without coming within 24 px of the character. */
  maxHeight: number;
  /** Height the expanded list may use (down to the "Scan another" button). */
  expandedMaxHeight: number;
};

/**
 * Top-right verdict and sugar lists: one left-aligned column on the right, each line in its own dark pill,
 * typed out in order. Sections with 4+ items use a two-column grid across the full panel width when every name
 * fits (the section's text steps down to 13 or 12 px if needed). If the list would reach
 * the character, it stops at the last full row and shows "+N more", which expands the full list.
 *
 * Before anything shows, the panel is laid out invisibly to decide the grids and where to cut.
 */
export function VerdictPanel({ result, maxHeight, expandedMaxHeight }: Props) {
  const { width } = useWindowDimensions();
  const color = verdictColor[result.verdict];
  // Per grid candidate: the font size its grid uses, or null for one name per row.
  const [gridSizes, setGridSizes] = useState<Record<string, number | null>>({});
  const [bottoms, setBottoms] = useState<Record<string, number>>({});
  const [moreHeight, setMoreHeight] = useState<number>();
  const [expanded, setExpanded] = useState(false);

  const sections: Section[] = SECTIONS.map((s) => ({ ...s, names: ingredientNames(result[s.key]) })).filter((s) => s.names.length > 0);
  const gridCandidates = sections.filter((s) => s.names.length >= GRID_MIN_ITEMS);
  const rows = buildRows(sections, gridSizes);

  // Step 1: check each grid candidate. Step 2: measure every row. Step 3: show and type.
  const checkingGrids = gridCandidates.some((s) => gridSizes[s.key] === undefined);
  const measured = !checkingGrids && moreHeight !== undefined && rows.every((r) => bottoms[r.key] !== undefined);
  const plan = measured
    ? planCut(
        rows.map((r) => ({ kind: r.kind, bottom: bottoms[r.key], items: r.kind === 'items' ? r.names.length : 0 })),
        maxHeight,
        moreHeight,
        ITEM_GAP,
      )
    : { visible: rows.length, hidden: 0 };

  // Lines to type, in reading order: the rows that fit, then "+N more".
  const lines: string[] = [];
  const lineOf = new Map<string, number>();
  for (const row of rows.slice(0, plan.visible)) {
    const texts = row.kind === 'verdict' ? [result.verdict] : row.kind === 'title' ? [row.section.title] : row.names;
    texts.forEach((t, i) => lineOf.set(`${row.key}:${i}`, lines.push(t) - 1));
  }
  const moreLabel = `+${plan.hidden} more`;
  if (plan.hidden > 0) lineOf.set('more:0', lines.push(moreLabel) - 1);
  const shown = useTypewriter(lines, measured);
  // Rows past the cut only appear once expanded, and then appear in full.
  const shownFor = (key: string, i: number, text: string) => {
    const line = lineOf.get(`${key}:${i}`);
    return line === undefined ? text.length : shown[line];
  };

  // Grid sections span the full panel width (no indent).
  const cellTextWidth = (width * PANEL_WIDTH - GRID_GAP) / 2 - GRID_PILL_PADDING_X * 2;
  const onRowLayout = (key: string, bottom: number) => setBottoms((b) => (b[key] === bottom ? b : { ...b, [key]: bottom }));
  const pill = (key: string, i: number, text: string, style: TextStyle, numberOfLines?: number, pillStyle?: ViewStyle) => {
    const n = shownFor(key, i, text);
    return (
      <Reveal key={i} started={n > 0} style={pillStyle ? { ...styles.pill, ...pillStyle } : styles.pill}>
        <Typed text={text} shown={n} style={style} numberOfLines={numberOfLines} />
      </Reveal>
    );
  };

  const visibleRows = !measured || expanded ? rows : rows.slice(0, plan.visible);
  const Glyph = verdictGlyph[result.verdict];

  return (
    <View style={styles.panel}>
      <ScrollView style={{ maxHeight: expanded ? expandedMaxHeight : undefined }} scrollEnabled={expanded} bounces={false}>
        {!checkingGrids &&
          visibleRows.map((row) => (
            <View
              key={row.key}
              onLayout={(e) => onRowLayout(row.key, e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
              style={
                row.kind === 'verdict'
                  ? undefined
                  : row.kind === 'title'
                    ? { marginTop: row.section === sections[0] ? AFTER_VERDICT : SECTION_GAP }
                    : row.gridFontSize
                      ? styles.gridItemRow
                      : styles.itemRow
              }
            >
              {row.kind === 'verdict' && (
                <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel={`${result.verdict}. ${result.headline}`}>
                  <Reveal started={shownFor(row.key, 0, result.verdict) > 0}>
                    <View style={[styles.verdictCircle, { backgroundColor: color }]}>
                      <Glyph size={22} color={result.verdict === 'BAD' ? '#FFFFFF' : colors.background} strokeWidth={STROKE} absoluteStrokeWidth />
                    </View>
                  </Reveal>
                  {pill(row.key, 0, result.verdict, { ...styles.verdict, color })}
                </View>
              )}
              {row.kind === 'title' && (
                <View style={styles.row}>
                  <Reveal started={shownFor(row.key, 0, row.section.title) > 0} style={styles.iconColumn}>
                    <View style={styles.iconCircle}>
                      <row.section.Icon size={20} color={colors.text} strokeWidth={STROKE} absoluteStrokeWidth />
                    </View>
                  </Reveal>
                  <View style={styles.titleText}>{pill(row.key, 0, row.section.title, styles.title)}</View>
                </View>
              )}
              {row.kind === 'items' && !row.gridFontSize && pill(row.key, 0, row.names[0], styles.item)}
              {row.kind === 'items' && row.gridFontSize && (
                <View style={styles.gridRow}>
                  {[0, 1].map((i) => (
                    <View key={i} style={styles.gridCell}>
                      {row.names[i] !== undefined &&
                        pill(row.key, i, row.names[i], { ...styles.gridItem, fontSize: row.gridFontSize }, 2, styles.gridPill)}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

        {plan.hidden > 0 && measured && (
          <Pressable
            style={styles.itemRow}
            onPress={() => setExpanded((e) => !e)}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Show fewer' : `Show ${plan.hidden} more`}
          >
            {/* "Show less" isn't a typed line, so it always shows in full. */}
            {expanded ? pill('less', 0, 'Show less', styles.item) : pill('more', 0, moreLabel, styles.item)}
          </Pressable>
        )}
      </ScrollView>

      {/* Invisible probes used while measuring. */}
      {checkingGrids &&
        gridCandidates.map((s) => (
          <GridProbe key={s.key} names={s.names} width={cellTextWidth} onResult={(size) => setGridSizes((g) => ({ ...g, [s.key]: size }))} />
        ))}
      {moreHeight === undefined && (
        <View style={[styles.probe, styles.pill]} onLayout={(e) => setMoreHeight(e.nativeEvent.layout.height)}>
          <Text style={styles.item}>+99 more</Text>
        </View>
      )}
    </View>
  );
}

/** Verdict row, then each section's title row and its item rows (pairs when the section has a grid size). */
function buildRows(sections: Section[], gridSizes: Record<string, number | null>): Row[] {
  const rows: Row[] = [{ kind: 'verdict', key: 'verdict' }];
  for (const s of sections) {
    rows.push({ kind: 'title', key: `${s.key}-title`, section: s });
    const gridFontSize = gridSizes[s.key] ?? undefined;
    const perRow = gridFontSize ? 2 : 1;
    for (let i = 0; i < s.names.length; i += perRow) {
      rows.push({ kind: 'items', key: `${s.key}-${gridFontSize ?? 'list'}-${i}`, names: s.names.slice(i, i + perRow), gridFontSize });
    }
  }
  return rows;
}

/**
 * Lays every name out at grid-cell width (invisibly) at 14, 13 and 12 px, and reports the largest size at which
 * all of them fit in 2 lines without splitting a word, or null if none does.
 */
function GridProbe({ names, width, onResult }: { names: string[]; width: number; onResult: (size: number | null) => void }) {
  const results = useRef<Record<string, boolean>>({});
  const expected = names.length * GRID_FONT_SIZES.length;
  return (
    <View style={styles.probe} pointerEvents="none">
      {GRID_FONT_SIZES.map((fontSize) =>
        names.map((name, i) => (
          <Text
            key={`${fontSize}-${i}`}
            style={[styles.gridItem, { fontSize, width }]}
            onTextLayout={(e) => {
              results.current[`${fontSize}-${i}`] = fitsTwoLines(name, e.nativeEvent.lines.map((l) => l.text));
              if (Object.keys(results.current).length < expected) return;
              const size = GRID_FONT_SIZES.find((f) => names.every((_, j) => results.current[`${f}-${j}`]));
              onResult(size ?? null);
            }}
          >
            {name}
          </Text>
        )),
      )}
    </View>
  );
}

/**
 * How many letters of each line are showing. One Reanimated clock runs the whole panel (no timer per letter);
 * lines start one after another and the whole reveal takes at most 800 ms. Nothing shows until `enabled`.
 * With reduce motion on, everything shows at once.
 */
function useTypewriter(lines: string[], enabled: boolean) {
  const total = lines.reduce((sum, l) => sum + l.length, 0);
  const reduceMotion = useReducedMotion();
  const [count, setCount] = useState(0);
  const letters = useSharedValue(0);

  useEffect(() => {
    letters.value = 0;
    setCount(0);
    if (!enabled || reduceMotion || total === 0) return;
    const letterMs = Math.min(MAX_LETTER_MS, REVEAL_MS / total);
    letters.value = withTiming(total, { duration: total * letterMs, easing: Easing.linear });
  }, [enabled, total, reduceMotion, letters]);

  useAnimatedReaction(
    () => Math.ceil(letters.value),
    (now, before) => {
      if (now !== before) scheduleOnRN(setCount, now);
    },
  );

  let left = !enabled ? 0 : reduceMotion ? total : count;
  return lines.map((l) => {
    const n = Math.max(0, Math.min(l.length, left));
    left -= l.length;
    return n;
  });
}

/** Hidden until its line starts, then fades and slides in. Never visible before its first letter. */
function Reveal({ started, style, children }: { started: boolean; style?: ViewStyle; children: ReactNode }) {
  const progress = useSharedValue(started ? 1 : 0);
  useEffect(() => {
    progress.value = started ? withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.cubic) }) : 0;
  }, [started, progress]);
  const fade = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: 8 * (1 - progress.value) }],
  }));
  return <Animated.View style={[style, fade]}>{children}</Animated.View>;
}

/** The full text is always laid out, so the pill never changes size; letters not typed yet are transparent. */
function Typed({ text, shown, style, numberOfLines }: { text: string; shown: number; style: TextStyle; numberOfLines?: number }) {
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {text.slice(0, shown)}
      <Text style={styles.unrevealed}>{text.slice(shown)}</Text>
    </Text>
  );
}

const pillBackground = 'rgba(11,11,15,0.62)';
const textShadow = { textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } };

const styles = StyleSheet.create({
  // Right edge lines up with the settings button (the header's 20 px side padding).
  panel: { position: 'absolute', right: 20, width: `${PANEL_WIDTH * 100}%` },
  row: { flexDirection: 'row', alignItems: 'center', gap: ICON_GAP },
  iconColumn: { width: ICON_COLUMN, alignItems: 'center' },
  verdictCircle: { width: VERDICT_ICON, height: VERDICT_ICON, borderRadius: VERDICT_ICON / 2, alignItems: 'center', justifyContent: 'center' },
  iconCircle: {
    width: ICON_COLUMN,
    height: ICON_COLUMN,
    borderRadius: ICON_COLUMN / 2,
    backgroundColor: pillBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: { flex: 1 },
  itemRow: { marginTop: ITEM_GAP, paddingLeft: ITEM_INDENT },
  gridItemRow: { marginTop: ITEM_GAP }, // grids span the full panel width
  gridRow: { flexDirection: 'row', gap: GRID_GAP },
  gridCell: { flex: 1, flexBasis: 0, alignItems: 'flex-start' },
  gridPill: { paddingHorizontal: GRID_PILL_PADDING_X },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: pillBackground,
    borderRadius: 8,
    paddingHorizontal: PILL_PADDING_X,
    paddingVertical: 3,
  },
  probe: { position: 'absolute', top: 0, left: 0, opacity: 0 },
  unrevealed: { color: 'transparent', textShadowColor: 'transparent' },
  verdict: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 32, letterSpacing: 0.5, ...textShadow },
  title: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.text, ...textShadow },
  item: { fontFamily: fonts.semibold, fontSize: 15, color: colors.textMuted, ...textShadow },
  gridItem: { fontFamily: fonts.semibold, fontSize: GRID_FONT_SIZES[0], color: colors.textMuted, ...textShadow },
});
