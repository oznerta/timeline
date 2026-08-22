import { Metadata } from 'next';
import { TimelineCanvasWrapper } from '@/components/canvas/TimelineCanvasWrapper';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `${title} | Weekline`,
    description: `Sprint delivery schedule and timeline for ${title}`,
  };
}

export default async function PublicTimelinePage({ params }: PageProps) {
  const { slug } = await params;
  return <TimelineCanvasWrapper slug={slug} />;
}
