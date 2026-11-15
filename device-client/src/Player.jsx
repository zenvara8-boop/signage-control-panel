import { useEffect, useState } from 'react';

/** Memutar playlist bergantian; `override` (konten hasil push) menggantikan playlist. */
export default function Player({ items, override, onChange }) {
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [items]);

  const safeIndex = items.length ? index % items.length : 0;
  const current = override ?? items[safeIndex]?.content ?? null;

  useEffect(() => {
    if (override || items.length < 2) return;
    const seconds = items[safeIndex]?.durasi_detik || 10;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % items.length), seconds * 1000);
    return () => clearTimeout(timer);
  }, [items, safeIndex, override]);

  useEffect(() => onChange(current), [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;
  return (
    <div className="slide" key={`${current.id}-${override ? 'push' : safeIndex}`}>
      <Renderer content={current} />
    </div>
  );
}

function Renderer({ content }) {
  switch (content.tipe) {
    case 'image':
      return <img src={content.payload} alt={content.judul} />;
    case 'video':
      return <video src={content.payload} autoPlay muted loop playsInline />;
    case 'url':
      return <iframe src={content.payload} title={content.judul} />;
    default:
      return <p className="big-text">{content.payload}</p>;
  }
}
