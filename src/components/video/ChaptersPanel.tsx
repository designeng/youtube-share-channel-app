import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStrings } from '../../lib/i18n';
import type { Chapter } from '../../lib/types';
import { space, useType } from '../theme';
import { StateView } from '../ui/StateView';
import type { ReviewState } from './AiPanel';
import { AiButton, ChapterRow } from './ChapterRow';
import { useShared } from './styles';

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
  const type = useType();
  const shared = useShared();
  const s = useStrings();
  return (
    <ScrollView testID="panel-chapters" contentContainerStyle={shared.body}>
      {!chapters.length ? (
        <StateView icon="chapters" title={s.chapters.none} message={s.chapters.unknownDuration} />
      ) : (
        <Text style={[type.caption, styles.caption]}>
          {authored ? s.chapters.authored(chapters.length) : s.chapters.split}
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
                label={s.ai.chapterReview(c.title)}
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
