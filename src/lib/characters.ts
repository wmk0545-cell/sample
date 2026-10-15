export interface ChiikawaCharacter {
  id: string;
  name: string;
  koreanName: string;
  imageSrc: string;
}

export const ALL_CHARACTERS: ChiikawaCharacter[] = [
  { id: "chiikawa", name: "Chiikawa", koreanName: "치이카와", imageSrc: "/characters/chiikawa.png" },
  { id: "hachiware", name: "Hachiware", koreanName: "하치와레", imageSrc: "/characters/hachiware.png" },
  { id: "usagi", name: "Usagi", koreanName: "우사기", imageSrc: "/characters/usagi.png" },
  { id: "shisa", name: "Shisa", koreanName: "시사", imageSrc: "/characters/shisa.png" },
  { id: "momonga", name: "Momonga", koreanName: "모몽가", imageSrc: "/characters/momonga.png" },
  { id: "rakko", name: "Rakko", koreanName: "랏코", imageSrc: "/characters/rakko.png" },
  { id: "pungdengi", name: "Pungdengi", koreanName: "풍뎅이", imageSrc: "/characters/pungdengi.png" },
  { id: "kurimanju", name: "Kurimanju", koreanName: "쿠리만쥬", imageSrc: "/characters/kurimanju.png" },
  { id: "goblin", name: "Goblin", koreanName: "고블린", imageSrc: "/characters/goblin.png" },
  { id: "armor", name: "Armor", koreanName: "갑옷아저씨", imageSrc: "/characters/armor.png" },
  { id: "kani", name: "Kani", koreanName: "카니", imageSrc: "/characters/kani.png" },
  { id: "anoko", name: "Anoko", koreanName: "아노코", imageSrc: "/characters/anoko.png" },
];

export interface CardItem {
  instanceId: number;
  characterId: string;
  character: ChiikawaCharacter;
  isFlipped: boolean;
  isMatched: boolean;
}

export function generateCardDeck(): CardItem[] {
  // 12종 중 무작위 8종 캐릭터 선택
  const shuffledCandidates = [...ALL_CHARACTERS].sort(() => Math.random() - 0.5);
  const selected8 = shuffledCandidates.slice(0, 8);

  // 8종 캐릭터를 각각 2장씩 쌍으로 구성하여 총 16장
  const paired = [...selected8, ...selected8];

  // Fisher-Yates 셔플로 랜덤 배치
  for (let i = paired.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [paired[i], paired[j]] = [paired[j], paired[i]];
  }

  return paired.map((char, index) => ({
    instanceId: index,
    characterId: char.id,
    character: char,
    isFlipped: false,
    isMatched: false,
  }));
}
