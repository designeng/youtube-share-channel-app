import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Chapter } from '../../lib/types';
import { space, type } from '../theme';
import { StateView } from '../ui/StateView';
import type { ReviewState } from './AiPanel';
import { AiButton, ChapterRow } from './ChapterRow';
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
      {!chapters.length ? (
        <StateView icon="chapters" title="Таймкодов нет" message="Длительность видео неизвестна." />
      ) : (
        <Text style={[type.caption, styles.caption]}>
          {authored ? `Главы автора: ${chapters.length}` : 'Автор не разметил главы — видео разбито на части по ~10 минут.'}
        </Text>
      )}
      {chapters.map((c) => {
        const active = currentIndex === c.index;
        const review = reviews[String(c.index)];
        return (
          <View key={c.index} testID={`chapter-${c.index}`} aria-selected={active}>
            <ChapterRow chapter={c} active={active} onSeek={onSeek}>
              <AiButton
                testID={`chapter-ai-${c.index}`}
                label={`AI-обзор: ${c.title}`}
                onPress={() => onReview(c.index)}
                done={!!review?.text}
                loading={review?.loading}
              />
            </ChapterRow>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  caption: { paddingHorizontal: space.sm, paddingBottom: space.xs },
});
