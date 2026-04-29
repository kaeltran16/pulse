import { useLocalSearchParams } from 'expo-router';
import { ReviewScreen } from '../components/reviews/ReviewScreen';

export default function WeeklyReviewRoute() {
  const { key } = useLocalSearchParams<{ key?: string }>();
  return <ReviewScreen period="weekly" initialKey={key} />;
}
