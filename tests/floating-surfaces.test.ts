import { describe, expect, it } from "vitest";
import {
  scoreFloatingSurface,
  supportsFloatingPopupType,
  type FloatingSurfaceFacts,
} from "../src/client/theme/floating-surfaces.ts";

const popup = (overrides: Partial<FloatingSurfaceFacts> = {}): FloatingSurfaceFacts => ({
  position: "absolute",
  visible: true,
  focusableCount: 1,
  popupItemCount: 0,
  className: "generated_surface",
  localToTrigger: true,
  recentlyAdded: false,
  controlledByTrigger: false,
  ...overrides,
});

describe("floating surface classification", () => {
  it("accepts popup types without depending on a specific popup role", () => {
    expect(supportsFloatingPopupType("tree")).toBe(true);
    expect(supportsFloatingPopupType("grid")).toBe(true);
    expect(supportsFloatingPopupType("custom-picker")).toBe(true);
    expect(supportsFloatingPopupType("dialog")).toBe(false);
    expect(supportsFloatingPopupType("false")).toBe(false);
  });

  it("recognizes a local interactive surface with generated classes", () => {
    expect(scoreFloatingSurface(popup())).toBeGreaterThan(0);
  });

  it("recognizes a newly portaled custom picker without requiring item roles", () => {
    expect(
      scoreFloatingSurface(
        popup({ position: "fixed", localToTrigger: false, recentlyAdded: true }),
      ),
    ).toBeGreaterThan(0);
  });

  it("rejects persistent layout trees and decorative absolute layers", () => {
    expect(scoreFloatingSurface(popup({ position: "static", popupItemCount: 8 }))).toBe(
      Number.NEGATIVE_INFINITY,
    );
    expect(scoreFloatingSurface(popup({ focusableCount: 0, popupItemCount: 0 }))).toBe(
      Number.NEGATIVE_INFINITY,
    );
    expect(scoreFloatingSurface(popup({ visible: false }))).toBe(Number.NEGATIVE_INFINITY);
  });
});
