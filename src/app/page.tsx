import DashboardPage from './dashboard/page';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Weekline — Sprint Delivery Timeline Workspace',
  description: 'Clean multi-week sprint delivery schedule and organization workspace platform.',
};

export default function HomePage() {
  return <DashboardPage />;
}
