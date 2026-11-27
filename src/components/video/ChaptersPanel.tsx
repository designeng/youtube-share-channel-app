import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStrings } from '../../lib/i18n';
import type { Chapter } from '../../lib/types';
import { space, useType } from '../theme';
import { StateView } from '../ui/StateView';
import type { ReviewState } from './AiPanel';
import { AiButton, ChapterRow } from './ChapterRow';
import { FollowButton, useFollowScroll } from './follow';
import { useShared } from './styles';

type Props = {
  chapters: Chapter[];
  /** false when the parts were generated because the author did not mark chapters */
  authored: boolean;
  currentIndex: number;
  time: number;
  reviews: Record<string, ReviewState>;
  onSeek: (sec: number) => void;
  onReview: (index: number) => void;
};

export function ChaptersPanel({ chapters, authored, currentIndex, time, reviews, onSeek, onReview }: Props) {
  const type = useType();
  const shared = useShared();
  const s = useStrings();
  const current = currentIndex >= 0 ? String(currentIndex) : undefined;
  const { follow, resume, contentRef, targetRef, scrollProps } = useFollowScroll(current);
  const seek = (sec: number) => {
    onSeek(sec);
    resume();
  };
  return (
    <View testID="panel-chapters" style={shared.fill}>
      <ScrollView testID="chapters-list" {...scrollProps}>
        <View ref={contentRef} style={shared.body}>
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
              <View key={c.index} ref={active ? targetRef : undefined} testID={`chapter-${c.index}`} aria-selected={active}>
                <ChapterRow chapter={c} active={active} onSeek={seek}>
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
        </View>
      </ScrollView>
      {!follow && current !== undefined && <FollowButton testID="chapters-follow" time={time} onPress={resume} />}
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { paddingHorizontal: space.sm, paddingBottom: space.xs },
});
