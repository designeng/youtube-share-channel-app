/**
 * Tiny Markdown renderer for AI output: headings, lists, paragraphs, **bold**, *italic*, `code`.
 * Timecodes like [12:34] / 1:02:03 become tappable (seek the player).
 */
import { Fragment, type ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { firstTimecode } from '../lib/chapters';
import { radius, themed } from './theme';

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|\[?\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b\]?)/g;

function toSec(ts: string) {
  return ts
    .replace(/[\[\]]/g, '')
    .split(':')
    .reduce((a, p) => a * 60 + Number(p), 0);
}

export function InlineText({ text, onTime }: { text: string; onTime?: (sec: number) => void }) {
  const styles = useStyles();
  const parts = text.split(INLINE).filter((p) => p !== '');
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4)
          return (
            <Text key={i} style={styles.bold}>
              {p.slice(2, -2)}
            </Text>
          );
        if (p.startsWith('`') && p.endsWith('`'))
          return (
            <Text key={i} style={styles.code}>
              {p.slice(1, -1)}
            </Text>
          );
        if (/^\*[^*].*\*$/.test(p))
          return (
            <Text key={i} style={styles.italic}>
              {p.slice(1, -1)}
            </Text>
          );
        if (/^\[?(?:\d{1,2}:)?\d{1,2}:\d{2}\]?$/.test(p) && onTime)
          return (
            <Text key={i} style={styles.time} onPress={() => onTime(toSec(p))}>
              {p}
            </Text>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

type Props = {
  text: string;
  onTime?: (sec: number) => void;
  /** blocks about this moment of the video are highlighted */
  activeSec?: number;
  /** given to the first highlighted block */
  activeRef?: (node: ViewInstance | null) => void;
};

export function Markdown({ text, onTime, activeSec, activeRef }: Props) {
  const styles = useStyles();
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let para: string[] = [];
  let found = false;
  const push = (source: string, node: ReactNode) => {
    const sec = firstTimecode(source);
    const active = sec !== undefined && sec === activeSec;
    const first = active && !found;
    found ||= active;
    blocks.push(
      <View
        key={blocks.length}
        ref={first ? activeRef : undefined}
        testID={sec === undefined ? undefined : `ai-point-${sec}`}
        aria-selected={sec === undefined ? undefined : active}
        style={[styles.block, active && styles.blockActive]}
      >
        {node}
      </View>,
    );
  };
  const flush = () => {
    if (para.length) {
      const joined = para.join(' ');
      push(
        joined,
        <Text style={styles.p}>
          <InlineText text={joined} onTime={onTime} />
        </Text>,
      );
      para = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const li = line.match(/^(\s*)([-*•]|\d+[.)])\s+(.*)$/);
    if (!line.trim()) flush();
    else if (h) {
      flush();
      push(
        h[2],
        <Text style={[styles.h, h[1].length <= 2 ? styles.h1 : styles.h3]}>
          <InlineText text={h[2].replace(/\*\*/g, '')} onTime={onTime} />
        </Text>,
      );
    } else if (li) {
      flush();
      const indent = Math.min(3, Math.floor(li[1].length / 2));
      const bullet = /\d/.test(li[2]) ? li[2] : '•';
      push(
        li[3],
        <View style={[styles.li, { paddingLeft: 4 + indent * 14 }]}>
          <Text style={styles.bullet}>{bullet}</Text>
          <Text style={styles.liText}>
            <InlineText text={li[3]} onTime={onTime} />
          </Text>
        </View>,
      );
    } else if (/^---+$/.test(line.trim())) {
      flush();
      blocks.push(<View key={blocks.length} style={styles.hr} />);
    } else para.push(line.trim());
  }
  flush();
  return <View style={{ gap: 6 }}>{blocks}</View>;
}

const useStyles = themed((colors) => ({
  block: { borderLeftWidth: 3, borderColor: 'transparent', borderRadius: radius.sm, paddingLeft: 4 },
  blockActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  p: { fontSize: 15, lineHeight: 22, color: colors.text },
  h: { color: colors.text, fontWeight: '700', marginTop: 8 },
  h1: { fontSize: 18 },
  h3: { fontSize: 16 },
  li: { flexDirection: 'row', gap: 6 },
  bullet: { fontSize: 15, lineHeight: 22, color: colors.muted, minWidth: 14 },
  liText: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.text },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: 'Courier', backgroundColor: colors.border },
  time: { color: colors.link, fontWeight: '600' },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 6 },
}));
