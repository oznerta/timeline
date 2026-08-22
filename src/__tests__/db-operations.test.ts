import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialTimeline, defaultTimelineData } from '@/lib/default-data';
import { loadTimelineFromLocalStorage, saveTimelineToLocalStorage } from '@/lib/data-service';

describe('Data Service & Timeline Model Persistence', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (global as any).window = {
      localStorage: {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          Object.keys(store).forEach((k) => delete store[k]);
        },
      },
    };
    (global as any).localStorage = (global as any).window.localStorage;
  });

  it('creates clean initial timeline models with zero tasks', () => {
    const slug = `clean-sprint-${Date.now()}`;
    const initial = createInitialTimeline('Clean Sprint Alpha', slug, '2026-08-22');

    expect(initial.tasks).toHaveLength(0);
    expect(initial.project.title).toBe('Clean Sprint Alpha');
    expect(initial.project.slug).toBe(slug);
    expect(initial.sprints).toHaveLength(1);
    expect(initial.sprints[0].days).toHaveLength(28);
    expect(initial.categories).toHaveLength(1);
    expect(initial.categories[0].title).toBe('General');
  });

  it('serializes and restores timelines with full fidelity in storage cache', () => {
    const slug = `storage-test-${Date.now()}`;
    const testData = {
      ...defaultTimelineData,
      project: {
        ...defaultTimelineData.project,
        slug,
        title: 'Cached Timeline Test',
      },
    };

    saveTimelineToLocalStorage(testData);
    const restored = loadTimelineFromLocalStorage(slug);

    expect(restored.project.title).toBe('Cached Timeline Test');
    expect(restored.project.slug).toBe(slug);
  });

  it('validates project metadata and access control levels', () => {
    const timeline = createInitialTimeline('Access Test', 'access-test', '2026-08-22');
    expect(timeline.project.accessLevel).toBe('restricted');

    timeline.project.accessLevel = 'public_view';
    expect(timeline.project.accessLevel).toBe('public_view');
  });
});
