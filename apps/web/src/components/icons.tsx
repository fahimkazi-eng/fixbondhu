/**
 * A small, dependency-free icon set.
 *
 * Inline SVG rather than an icon package: the whole set is under 4KB, renders
 * identically offline, and avoids shipping a library for sixteen glyphs. All
 * icons are decorative and hidden from assistive technology, because the label
 * beside them always carries the meaning.
 */

type IconProps = { className?: string };

function Svg({ className = "h-4 w-4", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const Home = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 2.5 2.5 8v9.5h5V13h5v4.5h5V8L9 2.5z" />
  </Svg>
);

export const Search = (p: IconProps) => (
  <Svg {...p}>
    <path
      d="M8.5 3a5.5 5.5 0 013.43 9.8l4.24 4.23-1.42 1.42-4.23-4.24A5.5 5.5 0 118.5 3zm0 2a3.5 3.5 0 100 7 3.5 3.5 0 000-7z"
    />
  </Svg>
);

export const Calendar = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 2v2H3v14h14V4h-3V2h-2v2H8V2H6zM5 9h10v7H5V9z" />
  </Svg>
);

export const Check = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.2 13.4 4.8 10l-1.4 1.4 4.8 4.8 9-9L15.8 5.8l-7.6 7.6z" />
  </Svg>
);

export const CheckCircle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 1a9 9 0 100 18 9 9 0 000-18zm4.2 7.1-5 5-3.4-3.4 1.4-1.4 2 2 3.6-3.6 1.4 1.4z" />
  </Svg>
);

export const XCircle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 1a9 9 0 100 18 9 9 0 000-18zm3.5 11.1-1.4 1.4L10 11.4l-2.1 2.1-1.4-1.4L8.6 10 6.5 7.9l1.4-1.4L10 8.6l2.1-2.1 1.4 1.4L11.4 10l2.1 2.1z" />
  </Svg>
);

export const Clock = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 1a9 9 0 100 18 9 9 0 000-18zm1 4v4.6l3.3 2-1 1.7L9 10.5V5h2z" />
  </Svg>
);

export const Pin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 1a6 6 0 00-6 6c0 4.2 6 12 6 12s6-7.8 6-12a6 6 0 00-6-6zm0 8.5A2.5 2.5 0 1110 4.5a2.5 2.5 0 010 5z" />
  </Svg>
);

export const Star = (p: IconProps) => (
  <Svg {...p}>
    <path d="m10 1.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
  </Svg>
);

export const Message = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 3h16v11H8l-4 4v-4H2V3zm2 2v7h1.5V14l2.6-2H16V5H4z" />
  </Svg>
);

export const Money = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.9 3.2v1.2c1 .1 1.8.5 2.2 1.2l-1.3.8c-.3-.5-.9-.7-1.6-.7-.8 0-1.3.3-1.3.8 0 .4.4.6 1.4.8 1.5.3 2.4.9 2.4 2 0 1.1-.9 1.8-2.2 2v1.2H9v-1.2c-1.1-.1-2-.6-2.4-1.4l1.3-.8c.3.5 1 .9 1.8.9.9 0 1.4-.4 1.4-.9 0-.4-.4-.6-1.5-.9-1.4-.3-2.3-.8-2.3-1.9 0-1 .8-1.7 2.1-1.9V5.2h1.6z" />
  </Svg>
);

export const Shield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 1 3 3.5v5.2c0 4.3 3 8.3 7 9.3 4-1 7-5 7-9.3V3.5L10 1zm-1 12.4-3.2-3.2 1.4-1.4L9 10.6l4-4 1.4 1.4L9 13.4z" />
  </Svg>
);

export const Wrench = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12.3 2a5 5 0 00-4.6 7L2 14.7 3.3 16l5.7-5.7a5 5 0 006.3-6.4L13 6l-2-2 2.2-2.2A5 5 0 0012.3 2z" />
  </Svg>
);

export const Warning = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 2 1 18h18L10 2zm1 13H9v-2h2v2zm0-3H9V7h2v5z" />
  </Svg>
);

export const Inbox = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 3h14v14H3V3zm2 2v6h3l1 2h2l1-2h3V5H5zm.5 8h9v2h-9v-2z" />
  </Svg>
);

export const Users = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 8a3 3 0 100-6 3 3 0 000 6zm7 0a3 3 0 100-6 3 3 0 000 6zM1 17v-2a4 4 0 014-4h4a4 4 0 014 4v2H1zm14-6a4 4 0 014 4v2h-4v-2a6 6 0 00-1-3.2A4 4 0 0115 11z" />
  </Svg>
);

export const Chart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 2h2v16H3V2zm5 5h2v11H8V7zm5-4h2v15h-2V3zm5 8h2v7h-2v-7z" />
  </Svg>
);

export const Tag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.6 1H2v7.6l9.4 9.4L20 9.4 9.6 1zM5 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
  </Svg>
);
