import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function Svg({ size = 18, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="M7.5 5.2c0-1 1.1-1.6 1.9-1.1l10.6 6.8c.8.5.8 1.7 0 2.2L9.4 19.9c-.8.5-1.9-.1-1.9-1.1V5.2z" />
    </Svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <rect x="6.5" y="4.5" width="4" height="15" rx="1.2" />
      <rect x="13.5" y="4.5" width="4" height="15" rx="1.2" />
    </Svg>
  );
}

export function PreviousIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <rect x="4.5" y="4.5" width="2.2" height="15" rx="1" />
      <path d="M19.5 5.3c.9-.6 2-.1 2 1v11.4c0 1.1-1.1 1.6-2 1L9.8 12.9c-.8-.5-.8-1.4 0-1.9z" />
    </Svg>
  );
}

export function NextIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <rect x="17.3" y="4.5" width="2.2" height="15" rx="1" />
      <path d="M4.5 6.3c0-1.1 1.1-1.6 2-1l9.7 5.7c.8.5.8 1.4 0 1.9L6.5 18.7c-.9.6-2 .1-2-1z" />
    </Svg>
  );
}

export function VolumeIcon({ level = 'high', ...props }: IconProps & { level?: 'muted' | 'low' | 'high' }) {
  return (
    <Svg {...props}>
      <path d="M4 9.5h3.2L11 6v12l-3.8-3.5H4z" fill="currentColor" stroke="none" />
      {level !== 'muted' && <path d="M15 9.2a3.6 3.6 0 0 1 0 5.6" />}
      {level === 'high' && <path d="M17.3 6.8a7.4 7.4 0 0 1 0 10.4" />}
      {level === 'muted' && <path d="M15.5 9.5l4 5M19.5 9.5l-4 5" />}
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M19 19l-4.3-4.3" />
    </Svg>
  );
}

export function MusicNoteIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="M9 17.5a2.7 2.7 0 1 1-1.9-2.6c.4-.1.9-.1 1.4.1V6.7c0-.6.4-1.1 1-1.3l7-1.9c.7-.2 1.4.3 1.4 1v9a2.7 2.7 0 1 1-1.9-2.6c.4-.1.9-.1 1.4.1V6.1l-6.4 1.7v9.7z" />
    </Svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 5.2c2.2-.9 4.7-.9 6.5.3v13c-1.8-1.2-4.3-1.2-6.5-.3z" />
      <path d="M19.5 5.2c-2.2-.9-4.7-.9-6.5.3v13c1.8-1.2 4.3-1.2 6.5-.3z" />
    </Svg>
  );
}

export function FilmIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M8 4.5v15M16 4.5v15M3.5 9h4.5M16 9h4.5M3.5 15h4.5M16 15h4.5" />
    </Svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="M3.5 6.2c0-.7.6-1.2 1.2-1.2h4.4c.4 0 .8.2 1 .5l1 1.3h8.2c.7 0 1.2.6 1.2 1.2v9.8c0 .7-.6 1.2-1.2 1.2H4.7c-.7 0-1.2-.6-1.2-1.2z" />
    </Svg>
  );
}

export function PlaylistIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 6.5h13M4 12h13M4 17.5h7" />
      <circle cx="18.5" cy="17.5" r="2.2" fill="currentColor" stroke="none" />
      <path d="M20.7 17.5V8l-3 .8" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 9l7 7 7-7" />
    </Svg>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 15l7-7 7 7" />
    </Svg>
  );
}

export function EjectIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <path d="M12 5.5l6.5 7h-13z" />
      <rect x="5.5" y="15" width="13" height="2.6" rx="0.8" />
    </Svg>
  );
}

export function DeviceIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="7" y="3.5" width="10" height="17" rx="2" />
      <path d="M10.5 17.2h3" />
    </Svg>
  );
}

export function UsbIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="6" r="2" />
      <circle cx="6.5" cy="17" r="2" />
      <circle cx="17.5" cy="17" r="2" />
      <path d="M12 8v4M12 12l-5.5 3M12 12l5.5 3" />
    </Svg>
  );
}

export function ImportIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v10M8 10.5l4 4 4-4" />
      <path d="M5 15v3a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18v-3" />
    </Svg>
  );
}

export function ArtistIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M5 20c.6-3.6 3.5-5.6 7-5.6s6.4 2 7 5.6" />
    </Svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function ListViewIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="4.7" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="4.7" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="4.7" cy="17.5" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function GridViewIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </Svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M4 17l4.5-4.5 3.5 3.5 3-3 5 5" />
    </Svg>
  );
}

export function AlbumIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15.2 4.8l4 4L8.5 19.5l-4.7 1 1-4.7z" />
      <path d="M13.5 6.5l4 4" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 7h14M9.5 7V5.2c0-.4.3-.7.7-.7h3.6c.4 0 .7.3.7.7V7M7 7l.8 12c.1.9.8 1.5 1.7 1.5h4.9c.9 0 1.6-.6 1.7-1.5L17 7" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  );
}
