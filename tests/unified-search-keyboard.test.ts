import { describe, expect, it } from "vitest";
import { resolveUnifiedSearchKeyboardAction } from "@/lib/unified-search-keyboard";

describe("resolveUnifiedSearchKeyboardAction", () => {
  it("prioritizes operator suggestions for Arrow navigation", () => {
    expect(
      resolveUnifiedSearchKeyboardAction({
        key: "ArrowDown",
        hasOperatorSuggestions: true,
        hasNavigableResults: true,
        hasActiveResult: true,
        hasQuery: true,
      })
    ).toEqual({ type: "step-operator", direction: 1 });
  });

  it("falls back to result navigation when suggestions are hidden", () => {
    expect(
      resolveUnifiedSearchKeyboardAction({
        key: "ArrowUp",
        hasOperatorSuggestions: false,
        hasNavigableResults: true,
        hasActiveResult: true,
        hasQuery: true,
      })
    ).toEqual({ type: "step-result", direction: -1 });
  });

  it("keeps Enter precedence as suggestion > result > commit query", () => {
    expect(
      resolveUnifiedSearchKeyboardAction({
        key: "Enter",
        hasOperatorSuggestions: true,
        hasNavigableResults: true,
        hasActiveResult: true,
        hasQuery: true,
      })
    ).toEqual({ type: "apply-operator" });
    expect(
      resolveUnifiedSearchKeyboardAction({
        key: "Enter",
        hasOperatorSuggestions: false,
        hasNavigableResults: true,
        hasActiveResult: true,
        hasQuery: true,
      })
    ).toEqual({ type: "open-result" });
    expect(
      resolveUnifiedSearchKeyboardAction({
        key: "Enter",
        hasOperatorSuggestions: false,
        hasNavigableResults: false,
        hasActiveResult: false,
        hasQuery: true,
      })
    ).toEqual({ type: "commit-query" });
  });

  it("applies Esc precedence as suggestion > active result > clear query", () => {
    expect(
      resolveUnifiedSearchKeyboardAction({
        key: "Escape",
        hasOperatorSuggestions: true,
        hasNavigableResults: true,
        hasActiveResult: true,
        hasQuery: true,
      })
    ).toEqual({ type: "dismiss-operator" });
    expect(
      resolveUnifiedSearchKeyboardAction({
        key: "Escape",
        hasOperatorSuggestions: false,
        hasNavigableResults: true,
        hasActiveResult: true,
        hasQuery: true,
      })
    ).toEqual({ type: "clear-active-result" });
    expect(
      resolveUnifiedSearchKeyboardAction({
        key: "Escape",
        hasOperatorSuggestions: false,
        hasNavigableResults: false,
        hasActiveResult: false,
        hasQuery: true,
      })
    ).toEqual({ type: "clear-query" });
  });

  it("applies Tab only when suggestions are available", () => {
    expect(
      resolveUnifiedSearchKeyboardAction({
        key: "Tab",
        hasOperatorSuggestions: true,
        hasNavigableResults: true,
        hasActiveResult: false,
        hasQuery: true,
      })
    ).toEqual({ type: "apply-operator" });
    expect(
      resolveUnifiedSearchKeyboardAction({
        key: "Tab",
        hasOperatorSuggestions: false,
        hasNavigableResults: true,
        hasActiveResult: false,
        hasQuery: true,
      })
    ).toEqual({ type: "none" });
  });

  it("switches arrow/enter precedence to results when suggestions become unavailable", () => {
    const withSuggestions = {
      hasOperatorSuggestions: true,
      hasNavigableResults: true,
      hasActiveResult: true,
      hasQuery: true,
    };
    const withoutSuggestions = {
      ...withSuggestions,
      hasOperatorSuggestions: false,
    };

    expect(
      resolveUnifiedSearchKeyboardAction({
        key: "ArrowDown",
        ...withSuggestions,
      })
    ).toEqual({ type: "step-operator", direction: 1 });
    expect(
      resolveUnifiedSearchKeyboardAction({
        key: "ArrowDown",
        ...withoutSuggestions,
      })
    ).toEqual({ type: "step-result", direction: 1 });

    expect(
      resolveUnifiedSearchKeyboardAction({
        key: "Enter",
        ...withSuggestions,
      })
    ).toEqual({ type: "apply-operator" });
    expect(
      resolveUnifiedSearchKeyboardAction({
        key: "Enter",
        ...withoutSuggestions,
      })
    ).toEqual({ type: "open-result" });
  });
});
