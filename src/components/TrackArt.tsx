import type { TrackTags } from '../types';
import { getArtUrl } from '../lib/artCache';
import { MusicNoteIcon } from './icons';

interface TrackArtProps {
  picture: TrackTags['picture'];
  size: number;
  className?: string;
}

export function TrackArt({ picture, size, className = '' }: TrackArtProps) {
  const url = getArtUrl(picture);
  return (
    <div className={`art-thumb ${className}`} style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" loading="lazy" /> : <MusicNoteIcon size={Math.round(size * 0.42)} />}
    </div>
  );
}
