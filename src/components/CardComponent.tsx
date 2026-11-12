import React from 'react';
import { Verse } from '../data/verses';
import { CrossIcon } from './Icons';
import { getVerseReference } from '../lib/whatsapp';

interface CardProps {
  verse: Verse | null;
  isFlipped: boolean;
  isShaking?: boolean;
  onClick?: () => void;
  className?: string;
}

export const CardComponent: React.FC<CardProps> = ({
  verse,
  isFlipped,
  isShaking = false,
  onClick,
  className = ''
}) => {
  const ref = verse ? getVerseReference(verse) : '';
  const text = verse ? verse.t : '';
  const len = text.length;
  const lengthClass = len > 220 ? ' xxlong' : len > 140 ? ' xlong' : len > 70 ? ' long' : '';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={`card ${isFlipped ? 'is-flipped' : ''} ${isShaking ? 'shake' : ''} ${className}`}
      tabIndex={0}
      role="button"
      aria-label={verse && isFlipped ? `الآية: ${verse.t}` : 'كارت الآية'}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="card-inner">
        {/* Back face (before reveal) */}
        <div className="face back">
          <CrossIcon className="big-cross" style={{ color: 'var(--gold)' }} size={120} />
          <div className="hint">اضغط لتكشف الآية</div>
          <div className="tiny">افتقد سلامة اخوتك</div>
        </div>

        {/* Front face (verse revealed) */}
        <div className="face front">
          <CrossIcon className="orn" style={{ color: 'var(--gold-2)' }} size={34} />
          <p className={`verse${lengthClass}`}>«{text}»</p>
          {ref ? (
            <div className="ref">
              <bdi>{ref}</bdi>
            </div>
          ) : null}
          <div className="service">افتقد سلامة اخوتك</div>
        </div>
      </div>
    </div>
  );
};

