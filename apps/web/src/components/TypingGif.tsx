/**
 * Jim Carrey furiously typing — a bit of humour for the waiting/idle moments.
 * Wrapped in a neon frame to match the cyberpunk theme.
 */
export default function TypingGif({
  caption,
  className = "",
}: {
  caption?: string;
  className?: string;
}) {
  return (
    <figure className={`mx-auto w-fit ${className}`}>
      <div className="rounded-lg overflow-hidden neon-box">
        <img
          src="/jim-carrey-typing.gif"
          alt="Jim Carrey typing frantically"
          loading="lazy"
          className="block w-full max-w-[260px] h-auto"
        />
      </div>
      {caption && (
        <figcaption className="text-sub text-xs mt-2 text-center font-display uppercase tracking-widest">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
