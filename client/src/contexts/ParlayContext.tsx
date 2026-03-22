import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { ParlayLeg } from "@shared/types";

interface ParlayContextValue {
  legs: ParlayLeg[];
  addLeg: (leg: ParlayLeg) => void;
  removeLeg: (matchId: number) => void;
  toggleLeg: (leg: ParlayLeg) => void;
  clearLegs: () => void;
  isSelected: (matchId: number, pick: string) => boolean;
  combinedOdds: number;
  legCount: number;
}

const ParlayContext = createContext<ParlayContextValue | null>(null);

export function ParlayProvider({ children }: { children: ReactNode }) {
  const [legs, setLegs] = useState<ParlayLeg[]>([]);

  const addLeg = useCallback((leg: ParlayLeg) => {
    setLegs((prev) => {
      // Remove any existing leg for this match
      const filtered = prev.filter((l) => l.matchId !== leg.matchId);
      return [...filtered, leg];
    });
  }, []);

  const removeLeg = useCallback((matchId: number) => {
    setLegs((prev) => prev.filter((l) => l.matchId !== matchId));
  }, []);

  const toggleLeg = useCallback((leg: ParlayLeg) => {
    setLegs((prev) => {
      const existingIndex = prev.findIndex(
        (l) => l.matchId === leg.matchId && l.pick === leg.pick
      );

      if (existingIndex >= 0) {
        // Remove if same pick is selected
        return prev.filter((_, i) => i !== existingIndex);
      } else {
        // Remove any existing leg for this match and add new one
        const filtered = prev.filter((l) => l.matchId !== leg.matchId);
        return [...filtered, leg];
      }
    });
  }, []);

  const clearLegs = useCallback(() => {
    setLegs([]);
  }, []);

  const isSelected = useCallback(
    (matchId: number, pick: string) => {
      return legs.some((l) => l.matchId === matchId && l.pick === pick);
    },
    [legs]
  );

  const combinedOdds = legs.reduce((acc, leg) => acc * leg.odds, 1);

  return (
    <ParlayContext.Provider
      value={{
        legs,
        addLeg,
        removeLeg,
        toggleLeg,
        clearLegs,
        isSelected,
        combinedOdds,
        legCount: legs.length,
      }}
    >
      {children}
    </ParlayContext.Provider>
  );
}

export function useParlay() {
  const context = useContext(ParlayContext);
  if (!context) {
    throw new Error("useParlay must be used within a ParlayProvider");
  }
  return context;
}
