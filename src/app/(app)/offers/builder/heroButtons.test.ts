import { describe, expect, it } from "vitest";
import {
  DEFAULT_HERO_CONTINUE_BUTTON,
  DEFAULT_HERO_MEDIA_BUTTON,
  normalizeHeroButton,
} from "./heroButtons";

describe("normalizeHeroButton", () => {
  it("returns the fallback for missing or invalid values", () => {
    expect(normalizeHeroButton(undefined, DEFAULT_HERO_MEDIA_BUTTON)).toEqual(
      DEFAULT_HERO_MEDIA_BUTTON,
    );
    expect(normalizeHeroButton("watch", DEFAULT_HERO_CONTINUE_BUTTON)).toEqual(
      DEFAULT_HERO_CONTINUE_BUTTON,
    );
  });

  it("keeps valid fields and fills the rest from the fallback", () => {
    expect(
      normalizeHeroButton(
        { label: "See the numbers", iconPlacement: "start" },
        DEFAULT_HERO_CONTINUE_BUTTON,
      ),
    ).toEqual({
      label: "See the numbers",
      icon: "",
      iconPlacement: "start",
      visible: true,
    });
  });

  it("ignores unknown icon placements", () => {
    expect(
      normalizeHeroButton(
        { label: "Watch", icon: "play", iconPlacement: "middle" },
        DEFAULT_HERO_MEDIA_BUTTON,
      ),
    ).toEqual({
      label: "Watch",
      icon: "play",
      iconPlacement: "end",
      visible: true,
    });
  });

  it("preserves an explicit hidden video button", () => {
    expect(
      normalizeHeroButton(
        { label: "Watch", icon: "play", iconPlacement: "end", visible: false },
        DEFAULT_HERO_MEDIA_BUTTON,
      ),
    ).toEqual({
      label: "Watch",
      icon: "play",
      iconPlacement: "end",
      visible: false,
    });
  });
});
