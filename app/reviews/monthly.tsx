import { useLocalSearchParams } from 'expo-router';
import { ReviewScreen } from '../components/reviews/ReviewScreen';

export default function MonthlyReviewRoute() {
  const { key } = useLocalSearchParams<{ key?: string }>();
  return <ReviewScreen period="monthly" initialKey={key} />;
}
