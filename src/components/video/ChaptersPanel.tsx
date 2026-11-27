import { Pressable, ScrollView, Text, View } from 'react-native';
import { formatTime } from '../../lib/format';
import type { Chapter } from '../../lib/types';
import type { ReviewState } from './AiPanel';
import { shared } from './styles';

type Props = {
  chapters: Chapter[];
  /** false when the parts were generated because the author did not mark chapters */
  authored: boolean;
  currentIndex: number;
  reviews: Record<string, ReviewState>;
  onSeek: (sec: number) => void;
  onReview: (index: number) => void;
};

export function ChaptersPanel({ chapters, authored, currentIndex, reviews, onSeek, onReview }: Props) {
  return (
    <ScrollView testID="panel-chapters" contentContainerStyle={shared.body}>
      <Text style={shared.hint}>
        {!chapters.length
          ? 'Длительность видео неизвестна — таймкодов нет.'
          : authored
            ? `Главы автора: ${chapters.length}`
            : 'Автор не разметил главы — видео разбито на части по ~10 минут.'}
      </Text>
      {chapters.map((c) => {
        const active = currentIndex === c.index;
        const done = !!reviews[String(c.index)]?.text;
        return (
          <View
            key={c.index}
            testID={`chapter-${c.index}`}
            aria-selected={active}
            style={[shared.chapter, active && shared.chapterActive]}
          >
            <View style={shared.chapterRow}>
              <Pressable role="button" onPress={() => onSeek(c.start)} style={shared.chapterMain}>
                <Text style={shared.time}>{formatTime(c.start)}</Text>
                <Text style={shared.chTitle}>{c.title}</Text>
              </Pressable>
              <Pressable
                testID={`chapter-ai-${c.index}`}
                onPress={() => onReview(c.index)}
                style={[shared.aiChip, done && shared.aiChipDone]}
                hitSlop={6}
              >
                <Text style={[shared.aiChipText, done && shared.aiChipTextDone]}>AI</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
