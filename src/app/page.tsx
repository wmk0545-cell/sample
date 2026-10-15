"use client";

import React, { useState, useEffect, useRef } from "react";
import { generateCardDeck, CardItem } from "@/lib/characters";
import { PlayingCard } from "@/components/PlayingCard";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Home as HomeIcon, Trophy, Clock, User, Heart, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";

interface RankingItem {
  rank: number;
  name: string;
  score: number;
  finishtime: string;
}

type GamePhase = "NAME_INPUT" | "READY" | "PLAYING" | "PAUSED" | "COMPLETED";

export default function CardGamePage() {
  // 상태 관리
  const [phase, setPhase] = useState<GamePhase>("NAME_INPUT");
  const [userName, setUserName] = useState<string>("");
  const [tempName, setTempName] = useState<string>("");
  const [cards, setCards] = useState<CardItem[]>([]);
  const [selectedCards, setSelectedCards] = useState<CardItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // 게임 메트릭
  const [matchCount, setMatchCount] = useState<number>(0);
  const [turns, setTurns] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [finalTimeStr, setFinalTimeStr] = useState<string>("");
  const [sheetSaveStatus, setSheetSaveStatus] = useState<"IDLE" | "SAVING" | "SAVED" | "ERROR">("IDLE");

  // TOP 3 랭킹 데이터
  const [topRankings, setTopRankings] = useState<RankingItem[]>([]);
  const [loadingRankings, setLoadingRankings] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 타이머 작동 로직
  useEffect(() => {
    if (phase === "PLAYING") {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [phase]);

  // 시간 포맷팅 유틸 (mm:ss)
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  // 게임 시작 (또는 다시 시작)
  const startNewGame = (autoPlay: boolean = true) => {
    const newDeck = generateCardDeck();
    setCards(newDeck);
    setSelectedCards([]);
    setIsProcessing(false);
    setMatchCount(0);
    setTurns(0);
    setElapsedSeconds(0);
    setFinalTimeStr("");

    if (autoPlay) {
      setPhase("PLAYING");
    } else {
      setPhase("READY");
    }
  };

  // 1. 이름 입력 완료 시
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim()) return;
    setUserName(tempName.trim());
    startNewGame(false); // READY 단계로 이동
  };

  // 2. 카드 클릭 이벤트
  const handleCardClick = (clickedCard: CardItem) => {
    if (phase !== "PLAYING" || isProcessing) return;
    if (clickedCard.isFlipped || clickedCard.isMatched) return;

    // 첫 번째 또는 두 번째 카드 뒤집기
    const updatedCards = cards.map((c) =>
      c.instanceId === clickedCard.instanceId ? { ...c, isFlipped: true } : c
    );
    setCards(updatedCards);

    const newSelected = [...selectedCards, clickedCard];
    setSelectedCards(newSelected);

    if (newSelected.length === 2) {
      setIsProcessing(true);
      setTurns((prev) => prev + 1);

      const [first, second] = newSelected;

      if (first.characterId === second.characterId) {
        // 일치 성공! 앞면 상태(isFlipped: true, isMatched: true)를 계속 유지
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.characterId === first.characterId
                ? { ...c, isFlipped: true, isMatched: true }
                : c
            )
          );
          setSelectedCards([]);
          setIsProcessing(false);
          const newMatchedCount = matchCount + 1;
          setMatchCount(newMatchedCount);

          // 전체 8쌍 매칭 완료 (게임 종료)
          if (newMatchedCount === 8) {
            handleGameComplete();
          }
        }, 500);
      } else {
        // 불일치 시 일정 시간 후 다시 뒷면으로 뒤집기
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.instanceId === first.instanceId || c.instanceId === second.instanceId
                ? { ...c, isFlipped: false }
                : c
            )
          );
          setSelectedCards([]);
          setIsProcessing(false);
        }, 900);
      }
    }
  };

  // 구글 시트에서 TOP 3 랭킹 불러오기 (JSONP 방식)
  const fetchTop3Rankings = (gasUrl: string) => {
    setLoadingRankings(true);
    const callbackName = "gasCallback_" + Date.now();
    const script = document.createElement("script");
    script.src = `${gasUrl}?callback=${callbackName}&t=${Date.now()}`;

    // 전역 콜백 등록
    (window as unknown as Record<string, (res: { status: string; top3?: RankingItem[] }) => void>)[callbackName] = (
      res
    ) => {
      if (res && res.top3) {
        setTopRankings(res.top3);
      }
      setLoadingRankings(false);
      delete (window as unknown as Record<string, unknown>)[callbackName];
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };

    script.onerror = () => {
      setLoadingRankings(false);
      delete (window as unknown as Record<string, unknown>)[callbackName];
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };

    document.body.appendChild(script);
  };

  // 3. 게임 성공 처리 (구글 시트 연동)
  const handleGameComplete = async () => {
    setPhase("COMPLETED");
    const formatted = formatTime(elapsedSeconds);
    setFinalTimeStr(formatted);

    // 24시간 형식 (HH:mm:ss) 문자열 생성
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    const finishtime24 = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    // 점수 계산: 기본 점수에서 시도 횟수 페널티를 제외 (최소 10점)
    const calculatedScore = Math.max(10, 1000 - turns * 20);

    // .env.local 파일에 설정된 NEXT_PUBLIC_GOOGLE_SCRIPT_URL 키 값 참조
    const gasUrl =
      process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL ||
      process.env.NEXT_PUBLIC_GOOGLE_SHEET_API_URL ||
      (typeof window !== "undefined" ? localStorage.getItem("gas_api_url") : null);

    if (gasUrl) {
      setSheetSaveStatus("SAVING");
      setLoadingRankings(true);

      const payload = {
        name: userName || "익명",
        score: calculatedScore,
        finishtime: finishtime24,
      };

      // 1. JSONP 방식으로 데이터 저장 및 즉시 TOP 3 랭킹 수신 (브라우저 CORS / 차단 우회에 가장 신뢰성 높음)
      const sendViaJsonp = () => {
        const callbackName = "gasSaveCb_" + Date.now();
        const script = document.createElement("script");
        const params = new URLSearchParams({
          action: "save",
          name: payload.name,
          score: String(payload.score),
          finishtime: payload.finishtime,
          callback: callbackName,
          t: String(Date.now()),
        });
        script.src = `${gasUrl}?${params.toString()}`;

        (window as unknown as Record<string, (res: { status: string; top3?: RankingItem[] }) => void>)[callbackName] = (
          res
        ) => {
          if (res && res.status === "success") {
            setSheetSaveStatus("SAVED");
            if (res.top3) {
              setTopRankings(res.top3);
            }
          }
          setLoadingRankings(false);
          delete (window as unknown as Record<string, unknown>)[callbackName];
          if (document.body.contains(script)) {
            document.body.removeChild(script);
          }
        };

        script.onerror = () => {
          // JSONP 실패 시 일반 fetchTop3Rankings 시도
          fetchTop3Rankings(gasUrl);
          delete (window as unknown as Record<string, unknown>)[callbackName];
          if (document.body.contains(script)) {
            document.body.removeChild(script);
          }
        };

        document.body.appendChild(script);
      };

      try {
        // 2. 표준 POST 전송 (no-cors)도 병행 실행하여 저장 누락 완전 방지
        fetch(gasUrl, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify(payload),
        }).catch(() => {});

        // JSONP 실행
        sendViaJsonp();
      } catch (err) {
        console.error("구글 앱스 스크립트 실행 실패:", err);
        setSheetSaveStatus("ERROR");
        setLoadingRankings(false);
      }
    } else {
      setSheetSaveStatus("IDLE");
      setLoadingRankings(false);
    }

    // 축하 폭죽 효과
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
      setTimeout(() => {
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
      }, 300);
    } catch {
      // confetti fallback
    }
  };

  // 4. 일시정지 / 계속하기 토글
  const togglePause = () => {
    if (phase === "PLAYING") {
      setPhase("PAUSED");
    } else if (phase === "PAUSED") {
      setPhase("PLAYING");
    }
  };

  // 5. 처음으로 (이름 입력 화면으로 리셋)
  const handleResetToHome = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setPhase("NAME_INPUT");
    setCards([]);
    setSelectedCards([]);
    setMatchCount(0);
    setTurns(0);
    setElapsedSeconds(0);
    setFinalTimeStr("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-3 sm:p-6 transition-colors duration-300">
      {/* 상단 네비게이션 & 테마 토글 */}
      <div className="w-full max-w-xl mx-auto flex items-center justify-between py-1 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌸</span>
          <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
            Mini Game
          </span>
        </div>
        <ModeToggle />
      </div>

      <main className="w-full max-w-xl mx-auto flex flex-col items-center justify-center my-auto py-4">
        {/* 헤더 타이틀 */}
        <header className="w-full text-center mb-5 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground flex items-center justify-center gap-2">
            먼작귀 카드 맞추기 게임
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            귀여운 먼작귀 친구들의 짝을 찾아 카드를 완성해 보세요!
          </p>
        </header>

        {/* 단계 1: 사용자 이름 입력 화면 */}
        {phase === "NAME_INPUT" && (
          <Card className="w-full max-w-sm sm:max-w-md shadow-lg border-border/70 bg-card/90 backdrop-blur">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-2 rounded-full bg-secondary/80 flex items-center justify-center border border-border shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/characters/chiikawa.png"
                  alt="치이카와"
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain"
                />
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold">도전자 등록</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                게임을 시작하기 전에 플레이어 이름을 입력해 주세요!
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleNameSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="username" className="text-xs sm:text-sm font-semibold flex items-center gap-1.5 text-foreground/80">
                    <User className="w-4 h-4 text-primary" />
                    플레이어 이름
                  </label>
                  <Input
                    id="username"
                    placeholder="예: 치이카와 팬"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    maxLength={15}
                    required
                    autoFocus
                    className="text-base h-11"
                  />
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Button
                  type="submit"
                  disabled={!tempName.trim()}
                  className="w-full h-11 text-base font-bold shadow-md transition-transform active:scale-95"
                >
                  입장하기 🐾
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {/* 단계 2: 게임 진행 인터페이스 */}
        {phase !== "NAME_INPUT" && (
          <div className="w-full flex flex-col items-center gap-3 sm:gap-4">
            {/* 상단 컨트롤 및 대시보드 바 */}
            <div className="w-full bg-card/90 backdrop-blur rounded-2xl p-3 sm:p-4 shadow-sm border border-border flex flex-wrap items-center justify-between gap-2.5">
              {/* 좌측: 플레이어 & 기록 배지 */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1 px-2.5 py-1 bg-secondary rounded-lg">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span className="font-bold text-xs sm:text-sm max-w-[90px] truncate">{userName}</span>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 bg-secondary rounded-lg">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-mono font-bold text-xs sm:text-sm">
                    {formatTime(elapsedSeconds)}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-lg text-xs">
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  <span className="font-medium text-muted-foreground hidden xs:inline">매칭:</span>
                  <span className="font-bold text-foreground">{matchCount}</span>
                  <span className="text-muted-foreground">/8</span>
                </div>
              </div>

              {/* 우측: 게임 컨트롤 버튼 그룹 */}
              <div className="flex items-center gap-1.5">
                {phase === "READY" && (
                  <Button
                    onClick={() => setPhase("PLAYING")}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 sm:h-9 text-xs sm:text-sm px-3 shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 mr-1" /> 시작
                  </Button>
                )}

                {phase === "PLAYING" && (
                  <Button
                    onClick={togglePause}
                    variant="outline"
                    className="h-8 sm:h-9 text-xs sm:text-sm px-2.5"
                  >
                    <Pause className="w-3.5 h-3.5 mr-1 text-amber-500" /> 일시정지
                  </Button>
                )}

                {phase === "PAUSED" && (
                  <Button
                    onClick={togglePause}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-8 sm:h-9 text-xs sm:text-sm px-3 shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 mr-1" /> 계속하기
                  </Button>
                )}

                <Button
                  onClick={() => startNewGame(true)}
                  variant="outline"
                  className="h-8 sm:h-9 text-xs sm:text-sm px-2.5"
                  title="다시 시작"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> 다시 시작
                </Button>

                <Button
                  onClick={handleResetToHome}
                  variant="ghost"
                  className="h-8 sm:h-9 text-xs sm:text-sm px-2"
                  title="처음으로 (이름 입력 화면)"
                >
                  <HomeIcon className="w-3.5 h-3.5 mr-1" /> 처음으로
                </Button>
              </div>
            </div>

            {/* 4x4 카드 그리드 컨테이너 */}
            <div className="relative w-full">
              {/* 일시정지 오버레이 */}
              {phase === "PAUSED" && (
                <div className="absolute inset-0 z-20 backdrop-blur-md bg-background/80 rounded-2xl flex flex-col items-center justify-center p-6 border-2 border-dashed border-border animate-in fade-in">
                  <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-2 shadow-sm text-amber-500">
                    <Pause className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">게임이 일시정지되었습니다</h3>
                  <p className="text-xs text-muted-foreground mb-4">준비가 되면 계속하기 버튼을 눌러주세요.</p>
                  <Button
                    onClick={togglePause}
                    className="bg-primary text-primary-foreground font-bold px-6 shadow"
                  >
                    <Play className="w-4 h-4 mr-1.5" /> 계속하기
                  </Button>
                </div>
              )}

              {/* 시작 전 대기(READY) 오버레이 */}
              {phase === "READY" && (
                <div className="absolute inset-0 z-20 backdrop-blur-md bg-background/80 rounded-2xl flex flex-col items-center justify-center p-6 border-2 border-dashed border-border animate-in fade-in">
                  <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2 shadow-sm">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">
                    반가워요, {userName}님!
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4 text-center max-w-xs">
                    카드를 2장씩 뒤집어 같은 먼작귀 친구들을 모두 찾아보세요.
                  </p>
                  <Button
                    onClick={() => setPhase("PLAYING")}
                    className="font-bold px-8 h-11 text-base shadow-lg transition-transform active:scale-95"
                  >
                    <Play className="w-4 h-4 mr-1.5" /> 게임 시작하기!
                  </Button>
                </div>
              )}

              {/* 4x4 카드 반응형 그리드 */}
              <div className="grid grid-cols-4 gap-2 sm:gap-3 p-2.5 sm:p-4 bg-card/50 rounded-2xl sm:rounded-3xl border border-border shadow-sm">
                {cards.map((card) => (
                  <PlayingCard
                    key={card.instanceId}
                    card={card}
                    onClick={() => handleCardClick(card)}
                    disabled={phase !== "PLAYING" || isProcessing}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 단계 3: 완료 팝업 모달 (완전 불투명 및 개인정보/시간 제거) */}
        {phase === "COMPLETED" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm sm:max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-foreground">
              {/* 상단 축하 배너 (완전 불투명) */}
              <div className="bg-gradient-to-r from-rose-400 via-pink-400 to-amber-300 dark:from-zinc-800 dark:to-zinc-800 p-6 text-center text-white relative">
                <div className="w-16 h-16 mx-auto rounded-full bg-white/30 dark:bg-black/30 flex items-center justify-center border border-white/50 shadow-md mb-2">
                  <Trophy className="w-8 h-8 text-yellow-200 fill-yellow-300 drop-shadow" />
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white drop-shadow-sm">
                  축하합니다! 미션 완료! 🎉
                </h2>
                <p className="text-white/95 text-xs mt-1">모든 먼작귀 친구들을 다 찾았어요!</p>
              </div>

              {/* 본문 콘텐츠 (완전 불투명 배경) */}
              <div className="p-5 space-y-3 bg-white dark:bg-zinc-900">
                <div className="bg-zinc-50 dark:bg-zinc-800/80 rounded-xl p-4 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">플레이어:</span>
                    <span className="text-zinc-900 dark:text-zinc-100 font-bold text-base">{userName}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t border-zinc-200 dark:border-zinc-700 pt-2.5">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">최종 달성 점수:</span>
                    <span className="text-pink-600 dark:text-pink-400 font-black text-xl font-mono">
                      {Math.max(10, 1000 - turns * 20)}점
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t border-zinc-200 dark:border-zinc-700 pt-2.5">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">총 뒤집은 횟수:</span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-bold">{turns} 회</span>
                  </div>
                  {/* 구글 시트 자동 저장 상태 안내 */}
                  <div className="flex justify-between items-center text-xs border-t border-zinc-200 dark:border-zinc-700 pt-2 text-zinc-500">
                    <span>구글 시트 저장:</span>
                    <span className="font-semibold">
                      {sheetSaveStatus === "SAVING" && (
                        <span className="text-amber-500 animate-pulse">전송 중...</span>
                      )}
                      {sheetSaveStatus === "SAVED" && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ 저장 완료</span>
                      )}
                      {sheetSaveStatus === "ERROR" && (
                        <span className="text-rose-500">저장 실패</span>
                      )}
                      {sheetSaveStatus === "IDLE" && <span>완료</span>}
                    </span>
                  </div>
                </div>

                {/* 🏆 구글 시트 명예의 전당 TOP 3 랭킹 (종료시간/날짜 노출 없이 순위/이름/점수만 표시) */}
                <div className="bg-amber-50/90 dark:bg-zinc-800 rounded-xl p-3.5 border border-amber-200 dark:border-zinc-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      명예의 전당 (TOP 3 랭킹)
                    </span>
                    {loadingRankings && (
                      <span className="text-[10px] text-amber-600 animate-pulse">갱신 중...</span>
                    )}
                  </div>

                  {topRankings.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      {topRankings.map((item) => {
                        const isCurrent = item.name === userName;
                        return (
                          <div
                            key={item.rank}
                            className={`flex items-center justify-between text-xs px-2.5 py-2 rounded-lg ${
                              isCurrent
                                ? "bg-amber-200/90 dark:bg-amber-950/60 font-bold text-amber-950 dark:text-amber-100 border border-amber-400"
                                : "bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-800"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[11px] ${
                                  item.rank === 1
                                    ? "bg-amber-400 text-amber-950 shadow-sm"
                                    : item.rank === 2
                                    ? "bg-slate-300 text-slate-800"
                                    : "bg-amber-700 text-white"
                                }`}
                              >
                                {item.rank}
                              </span>
                              <span className="truncate max-w-[120px] font-medium">{item.name}</span>
                              {isCurrent && (
                                <span className="text-[9px] bg-pink-500 text-white px-1 py-0.2 rounded font-bold">
                                  MY
                                </span>
                              )}
                            </div>
                            <div className="flex items-center font-bold text-pink-600 dark:text-pink-400 font-mono text-xs">
                              {item.score}점
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {loadingRankings ? "랭킹을 불러오는 중입니다..." : "랭킹 기록이 없습니다."}
                    </div>
                  )}
                </div>
              </div>

              {/* 하단 버튼 (완전 불투명) */}
              <div className="p-5 pt-0 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => startNewGame(true)}
                  className="w-full font-bold h-11 text-sm bg-pink-500 hover:bg-pink-600 text-white shadow-sm"
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" /> 다시 플레이
                </Button>
                <Button
                  onClick={handleResetToHome}
                  variant="outline"
                  className="w-full h-11 text-sm border-zinc-300 dark:border-zinc-700"
                >
                  <HomeIcon className="w-4 h-4 mr-1.5" /> 처음으로
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 하단 푸터 (요청하신 Copyright 문구) */}
      <footer className="w-full text-center py-4 border-t border-border/50 text-[11px] sm:text-xs text-muted-foreground">
        <p>Copyright 먼작귀 카드 맞추기 게임 by Ayoun Woo</p>
      </footer>
    </div>
  );
}
