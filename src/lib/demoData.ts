import type { TrackTags } from '../types';
import { VirtualDirectoryHandle } from './virtualFs';

interface DemoTrackSpec {
  path: string;
  tags: TrackTags;
  durationSec: number;
}

function tag(partial: Partial<TrackTags>): TrackTags {
  return {
    title: '', artist: '', album: '', albumArtist: '', track: '', year: '', genre: '', picture: null,
    ...partial,
  };
}

const DEMO_TRACKS: DemoTrackSpec[] = [
  {
    path: 'Music/Coldplay/01 Yellow.mp3',
    tags: tag({ title: 'Yellow', artist: 'Coldplay', album: 'Parachutes', albumArtist: 'Coldplay', track: '1', year: '2000', genre: 'Alternative Rock' }),
    durationSec: 258,
  },
  {
    path: 'Music/Coldplay/02 Clocks.mp3',
    tags: tag({ title: 'Clocks', artist: 'Coldplay', album: 'A Rush of Blood to the Head', albumArtist: 'Coldplay', track: '2', year: '2002', genre: 'Alternative Rock' }),
    durationSec: 307,
  },
  {
    path: 'Music/Coldplay/03 Viva La Vida.mp3',
    tags: tag({ title: 'Viva La Vida', artist: 'Coldplay', album: 'Viva la Vida or Death and All His Friends', albumArtist: 'Coldplay', track: '3', year: '2008', genre: 'Alternative Rock' }),
    durationSec: 242,
  },
  {
    path: 'Music/Fela Kuti/01 Zombie.mp3',
    tags: tag({ title: 'Zombie', artist: 'Fela Kuti', album: 'Zombie', albumArtist: 'Fela Kuti', track: '1', year: '1976', genre: 'Afrobeat' }),
    durationSec: 731,
  },
  {
    path: 'Music/Fela Kuti/02 Water No Get Enemy.mp3',
    tags: tag({ title: 'Water No Get Enemy', artist: 'Fela Kuti', album: 'Expensive Shit', albumArtist: 'Fela Kuti', track: '2', year: '1975', genre: 'Afrobeat' }),
    durationSec: 641,
  },
  {
    path: 'Audiobooks/Atomic Habits/01 Introduction.mp3',
    tags: tag({ title: 'Introduction', artist: 'James Clear', album: 'Atomic Habits', track: '1', genre: 'Audiobook' }),
    durationSec: 542,
  },
  {
    path: 'Audiobooks/Atomic Habits/02 Chapter 1.mp3',
    tags: tag({ title: 'Chapter 1 - The Surprising Power of Atomic Habits', artist: 'James Clear', album: 'Atomic Habits', track: '2', genre: 'Audiobook' }),
    durationSec: 1024,
  },
  {
    path: 'Videos/Motivational/Morning Motivation.mp4',
    tags: tag({ title: 'Morning Motivation', artist: 'Motivation Channel', genre: 'Motivational' }),
    durationSec: 483,
  },
  {
    path: 'Videos/Motivational/Believe In Yourself.mp4',
    tags: tag({ title: 'Believe In Yourself', artist: 'Motivation Channel', genre: 'Motivational' }),
    durationSec: 391,
  },
];

const DEMO_PLAYLIST_NAME = 'Road Trip Mix.m3u8';
const DEMO_PLAYLIST_PATHS = [
  'Music/Coldplay/01 Yellow.mp3',
  'Music/Coldplay/02 Clocks.mp3',
  'Music/Fela Kuti/01 Zombie.mp3',
];

function placeholderBytes(index: number): Uint8Array<ArrayBuffer> {
  // Non-zero-length so the size column shows something plausible; the
  // content itself is never decoded as real audio (Demo Mode simulates
  // playback instead of loading these bytes into an <audio> element).
  return new Uint8Array(24 * 1024 + (index % 5) * 3072);
}

async function writeFile(root: VirtualDirectoryHandle, path: string, file: File): Promise<void> {
  const segments = path.split('/');
  const fileName = segments.pop() as string;
  let dir = root;
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment, { create: true });
  }
  const handle = await dir.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(file);
  await writable.close();
}

export interface DemoSeed {
  tags: TrackTags;
  durationSec: number;
}

export async function buildDemoLibrary(): Promise<{
  root: FileSystemDirectoryHandle;
  seedTags: Record<string, DemoSeed>;
}> {
  const root = new VirtualDirectoryHandle('Demo Phone');
  const seedTags: Record<string, DemoSeed> = {};

  for (const [index, spec] of DEMO_TRACKS.entries()) {
    const mime = spec.path.endsWith('.mp4') ? 'video/mp4' : 'audio/mpeg';
    const fileName = spec.path.split('/').pop() as string;
    const file = new File([placeholderBytes(index)], fileName, { type: mime });
    await writeFile(root, spec.path, file);
    seedTags[spec.path] = { tags: spec.tags, durationSec: spec.durationSec };
  }

  const playlistLines = ['#EXTM3U'];
  for (const path of DEMO_PLAYLIST_PATHS) {
    const seed = seedTags[path];
    const label = seed ? `${seed.tags.artist} - ${seed.tags.title}` : path;
    playlistLines.push(`#EXTINF:${seed?.durationSec ?? -1},${label}`, path);
  }
  const playlistFile = new File([`${playlistLines.join('\n')}\n`], DEMO_PLAYLIST_NAME, { type: 'application/x-mpegurl' });
  await writeFile(root, DEMO_PLAYLIST_NAME, playlistFile);

  return { root: root as unknown as FileSystemDirectoryHandle, seedTags };
}
