import { useCallback, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { stepCircularIndex } from "@/lib/unified-search";

export type UnifiedSearchKeyboardAction =
  | { type: "none" }
  | { type: "step-operator"; direction: 1 | -1 }
  | { type: "step-result"; direction: 1 | -1 }
  | { type: "apply-operator" }
  | { type: "open-result" }
  | { type: "commit-query" }
  | { type: "dismiss-operator" }
  | { type: "clear-active-result" }
  | { type: "clear-query" };

export type UnifiedSearchKeyboardResolutionInput = {
  key: string;
  hasOperatorSuggestions: boolean;
  hasNavigableResults: boolean;
  hasActiveResult: boolean;
  hasQuery: boolean;
};

export function resolveUnifiedSearchKeyboardAction(
  input: UnifiedSearchKeyboardResolutionInput
): UnifiedSearchKeyboardAction {
  const { key, hasOperatorSuggestions, hasNavigableResults, hasActiveResult, hasQuery } = input;

  if (key === "ArrowDown" || key === "ArrowUp") {
    const direction: 1 | -1 = key === "ArrowDown" ? 1 : -1;
    if (hasOperatorSuggestions) return { type: "step-operator", direction };
    if (hasNavigableResults) return { type: "step-result", direction };
    return { type: "none" };
  }

  if (key === "Tab") {
    return hasOperatorSuggestions ? { type: "apply-operator" } : { type: "none" };
  }

  if (key === "Enter") {
    if (hasOperatorSuggestions) return { type: "apply-operator" };
    if (hasActiveResult) return { type: "open-result" };
    return { type: "commit-query" };
  }

  if (key === "Escape") {
    if (hasOperatorSuggestions) return { type: "dismiss-operator" };
    if (hasActiveResult) return { type: "clear-active-result" };
    if (hasQuery) return { type: "clear-query" };
  }

  return { type: "none" };
}

type UnifiedSearchNavigableResult = {
  key: string;
  href: string;
};

type UseUnifiedSearchKeyboardParams = {
  operatorSuggestions: string[];
  setActiveOperatorSuggestionIndex: Dispatch<SetStateAction<number>>;
  setHideOperatorAutocomplete: Dispatch<SetStateAction<boolean>>;
  applyCurrentOperatorSuggestion: () => boolean;
  navigableResults: UnifiedSearchNavigableResult[];
  activeResultIndex: number;
  activeResultKey: string | null;
  setActiveResultKey: Dispatch<SetStateAction<string | null>>;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  pushRecentQuery: (value: string) => void;
  openResult: (href: string) => void;
};

export function useUnifiedSearchKeyboard({
  operatorSuggestions,
  setActiveOperatorSuggestionIndex,
  setHideOperatorAutocomplete,
  applyCurrentOperatorSuggestion,
  navigableResults,
  activeResultIndex,
  activeResultKey,
  setActiveResultKey,
  query,
  setQuery,
  pushRecentQuery,
  openResult,
}: UseUnifiedSearchKeyboardParams) {
  return useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const action = resolveUnifiedSearchKeyboardAction({
        key: event.key,
        hasOperatorSuggestions: operatorSuggestions.length > 0,
        hasNavigableResults: navigableResults.length > 0,
        hasActiveResult: activeResultIndex >= 0,
        hasQuery: Boolean(query),
      });

      switch (action.type) {
        case "step-operator": {
          event.preventDefault();
          setActiveOperatorSuggestionIndex((previous) =>
            stepCircularIndex(operatorSuggestions.length, previous, action.direction)
          );
          return;
        }
        case "step-result": {
          event.preventDefault();
          const nextIndex = stepCircularIndex(
            navigableResults.length,
            activeResultIndex,
            action.direction
          );
          const next = navigableResults[nextIndex];
          if (next) setActiveResultKey(next.key);
          return;
        }
        case "apply-operator": {
          event.preventDefault();
          applyCurrentOperatorSuggestion();
          return;
        }
        case "open-result": {
          const target = navigableResults[activeResultIndex];
          if (!target) return;
          event.preventDefault();
          pushRecentQuery(query);
          openResult(target.href);
          return;
        }
        case "commit-query": {
          pushRecentQuery(query);
          return;
        }
        case "dismiss-operator": {
          event.preventDefault();
          setHideOperatorAutocomplete(true);
          return;
        }
        case "clear-active-result": {
          if (!activeResultKey) return;
          event.preventDefault();
          setActiveResultKey(null);
          return;
        }
        case "clear-query": {
          event.preventDefault();
          setQuery("");
          return;
        }
        default: {
          return;
        }
      }
    },
    [
      activeResultIndex,
      activeResultKey,
      applyCurrentOperatorSuggestion,
      navigableResults,
      openResult,
      operatorSuggestions.length,
      pushRecentQuery,
      query,
      setActiveOperatorSuggestionIndex,
      setActiveResultKey,
      setHideOperatorAutocomplete,
      setQuery,
    ]
  );
}
