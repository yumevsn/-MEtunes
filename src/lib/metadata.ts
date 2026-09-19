import { parseBlob } from 'music-metadata';
import { ID3Writer } from 'browser-id3-writer';
import type { TrackTags } from '../types';

const APIC_COVER_FRONT = 3;

export async function readTags(file: File): Promise<{ tags: TrackTags; durationSec: number | null }> {
  try {
    const meta = await parseBlob(file, { skipCovers: false, duration: true });
    const picture = meta.common.picture?.[0];
    const tags: TrackTags = {
      title: meta.common.title ?? '',
      artist: meta.common.artist ?? '',
      album: meta.common.album ?? '',
      albumArtist: meta.common.albumartist ?? '',
      track: meta.common.track?.no != null ? String(meta.common.track.no) : '',
      year: meta.common.year != null ? String(meta.common.year) : '',
      genre: meta.common.genre?.[0] ?? '',
      picture: picture ? { format: picture.format, data: picture.data } : null,
    };
    return { tags, durationSec: meta.format.duration ?? null };
  } catch {
    return {
      tags: { title: '', artist: '', album: '', albumArtist: '', track: '', year: '', genre: '', picture: null },
      durationSec: null,
    };
  }
}

export async function writeMp3Tags(file: File, tags: TrackTags): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const writer = new ID3Writer(buffer);
  writer.setFrame('TIT2', tags.title || '');
  writer.setFrame('TPE1', tags.artist ? [tags.artist] : []);
  writer.setFrame('TALB', tags.album || '');
  writer.setFrame('TPE2', tags.albumArtist || '');
  writer.setFrame('TCON', tags.genre ? [tags.genre] : []);
  if (tags.track) writer.setFrame('TRCK', tags.track);
  const yearNum = Number.parseInt(tags.year, 10);
  if (Number.isFinite(yearNum) && yearNum > 0) writer.setFrame('TYER', yearNum);
  if (tags.picture) {
    writer.setFrame('APIC', {
      type: APIC_COVER_FRONT,
      data: toArrayBuffer(tags.picture.data),
      description: 'Cover',
    });
  }
  writer.addTag();
  return writer.getBlob();
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  if (data.buffer instanceof ArrayBuffer && data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
    return data.buffer;
  }
  return data.slice().buffer as ArrayBuffer;
}

export function pictureToObjectUrl(picture: { format: string; data: Uint8Array } | null): string | null {
  if (!picture) return null;
  const blob = new Blob([toArrayBuffer(picture.data)], { type: picture.format });
  return URL.createObjectURL(blob);
}
