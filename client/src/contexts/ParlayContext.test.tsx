import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ParlayProvider, useParlay } from "./ParlayContext";
import { ReactNode } from "react";

const wrapper = ({ children }: { children: ReactNode }) => (
  <ParlayProvider>{children}</ParlayProvider>
);

describe("ParlayContext", () => {
  it("starts with empty legs", () => {
    const { result } = renderHook(() => useParlay(), { wrapper });
    expect(result.current.legs).toEqual([]);
    expect(result.current.legCount).toBe(0);
    expect(result.current.combinedOdds).toBe(1);
  });

  it("adds legs correctly", () => {
    const { result } = renderHook(() => useParlay(), { wrapper });

    act(() => {
      result.current.addLeg({
        matchId: 1,
        pick: "home",
        odds: 2.0,
        matchInfo: { homeTeam: "Team A", awayTeam: "Team B", sport: "NFL" },
      });
    });

    expect(result.current.legCount).toBe(1);
    expect(result.current.legs[0].matchId).toBe(1);
    expect(result.current.combinedOdds).toBe(2.0);
  });

  it("replaces leg for same match", () => {
    const { result } = renderHook(() => useParlay(), { wrapper });

    act(() => {
      result.current.addLeg({ matchId: 1, pick: "home", odds: 2.0 });
    });

    act(() => {
      result.current.addLeg({ matchId: 1, pick: "away", odds: 3.0 });
    });

    expect(result.current.legCount).toBe(1);
    expect(result.current.legs[0].pick).toBe("away");
    expect(result.current.legs[0].odds).toBe(3.0);
  });

  it("toggles leg off when same pick selected", () => {
    const { result } = renderHook(() => useParlay(), { wrapper });

    act(() => {
      result.current.toggleLeg({ matchId: 1, pick: "home", odds: 2.0 });
    });

    expect(result.current.legCount).toBe(1);

    act(() => {
      result.current.toggleLeg({ matchId: 1, pick: "home", odds: 2.0 });
    });

    expect(result.current.legCount).toBe(0);
  });

  it("removes specific leg", () => {
    const { result } = renderHook(() => useParlay(), { wrapper });

    act(() => {
      result.current.addLeg({ matchId: 1, pick: "home", odds: 2.0 });
      result.current.addLeg({ matchId: 2, pick: "away", odds: 3.0 });
    });

    expect(result.current.legCount).toBe(2);

    act(() => {
      result.current.removeLeg(1);
    });

    expect(result.current.legCount).toBe(1);
    expect(result.current.legs[0].matchId).toBe(2);
  });

  it("clears all legs", () => {
    const { result } = renderHook(() => useParlay(), { wrapper });

    act(() => {
      result.current.addLeg({ matchId: 1, pick: "home", odds: 2.0 });
      result.current.addLeg({ matchId: 2, pick: "away", odds: 3.0 });
    });

    expect(result.current.legCount).toBe(2);

    act(() => {
      result.current.clearLegs();
    });

    expect(result.current.legCount).toBe(0);
    expect(result.current.combinedOdds).toBe(1);
  });

  it("calculates combined odds correctly", () => {
    const { result } = renderHook(() => useParlay(), { wrapper });

    act(() => {
      result.current.addLeg({ matchId: 1, pick: "home", odds: 2.0 });
      result.current.addLeg({ matchId: 2, pick: "away", odds: 3.0 });
      result.current.addLeg({ matchId: 3, pick: "draw", odds: 1.5 });
    });

    expect(result.current.combinedOdds).toBe(9.0);
  });

  it("checks if leg is selected correctly", () => {
    const { result } = renderHook(() => useParlay(), { wrapper });

    act(() => {
      result.current.addLeg({ matchId: 1, pick: "home", odds: 2.0 });
    });

    expect(result.current.isSelected(1, "home")).toBe(true);
    expect(result.current.isSelected(1, "away")).toBe(false);
    expect(result.current.isSelected(2, "home")).toBe(false);
  });

  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useParlay());
    }).toThrow("useParlay must be used within a ParlayProvider");
  });
});
