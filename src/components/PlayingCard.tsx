"use client";

import React from "react";
import { CardItem } from "@/lib/characters";
import { Sparkles } from "lucide-react";

interface PlayingCardProps {
  card: CardItem;
  onClick: () => void;
  disabled?: boolean;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({ card, onClick, disabled }) => {
  // 짝이 맞았거나(isMatched) 현재 뒤집힌 상태(isFlipped)이면 앞면이 계속 보이도록 유지
  const isRevealed = card.isFlipped || card.isMatched;

  return (
    <div
      className={`relative w-full aspect-[3/4] sm:aspect-square cursor-pointer select-none perspective-1000 transition-transform duration-200 active:scale-95 ${
        card.isMatched ? "cursor-default" : disabled ? "pointer-events-none" : ""
      }`}
      onClick={() => {
        // 이미 매칭되었거나 뒤집힌 카드는 다시 클릭 방지
        if (!isRevealed && !disabled) {
          onClick();
        }
      }}
    >
      <div
        className={`w-full h-full relative transition-all duration-500 rounded-2xl preserve-3d ${
          isRevealed ? "rotate-y-180" : ""
        } ${
          card.isMatched
            ? "ring-3 sm:ring-4 ring-emerald-500/80 shadow-md shadow-emerald-500/20"
            : "shadow-sm hover:shadow-md hover:-translate-y-1"
        }`}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* 뒷면 (카드 커버) - 차분한 톤 & 다크모드 대응 */}
        <div
          className="absolute inset-0 w-full h-full rounded-2xl flex flex-col items-center justify-center p-2 bg-gradient-to-br from-rose-200/90 via-orange-100/90 to-amber-100/90 dark:from-zinc-800 dark:via-zinc-800/90 dark:to-zinc-900 text-zinc-700 dark:text-zinc-200 border border-black/5 dark:border-white/10 shadow-inner"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-white/70 dark:bg-zinc-700/60 backdrop-blur-sm flex items-center justify-center border border-white/60 dark:border-white/10 shadow-sm">
            <span className="text-xl sm:text-2xl filter drop-shadow">⭐</span>
          </div>
          <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-bold tracking-widest text-zinc-700 dark:text-zinc-300">
            CHIIKAWA
          </p>
        </div>

        {/* 앞면 (먼작귀 캐릭터 이미지) - 짝을 맞추면 계속 앞면 유지 */}
        <div
          className="absolute inset-0 w-full h-full rounded-2xl flex flex-col items-center justify-center p-1 sm:p-2 bg-[#dcd5c7] dark:bg-[#34322e] border border-amber-200/60 dark:border-zinc-700 shadow-sm rotate-y-180 overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
          }}
        >
          {/* 매칭 완료 뱃지 */}
          {card.isMatched && (
            <div className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 z-10 bg-emerald-600 text-white text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
              <Sparkles className="w-2.5 h-2.5" /> 짝맞춤
            </div>
          )}

          {/* 캐릭터 이미지 */}
          <div className="w-full h-full flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.character.imageSrc}
              alt={card.character.koreanName}
              className={`w-full h-full object-contain rounded-xl filter drop-shadow-sm transition-transform duration-300 ${
                card.isMatched ? "scale-100" : "hover:scale-105"
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
