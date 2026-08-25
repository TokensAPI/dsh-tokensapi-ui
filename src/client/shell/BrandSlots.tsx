import darkLogoUrl from "./assets/tokens-cowork-dark-mark-96.png";
import { TOKENSAPI_LOGO } from "./tokensapi-logo.ts";
import css from "./BrandSlots.module.css";

export interface TokensBrandMarkProps {
  size: number;
  className?: string;
}

/** Official shell brand occupant. The host continues to own all button behavior. */
export function TokensBrandMark({ size, className }: TokensBrandMarkProps): React.JSX.Element {
  return (
    <span className={[css.mark, className].filter(Boolean).join(" ")} style={{ width: size, height: size }}>
      <img aria-hidden="true" className={css.lightMark} src={TOKENSAPI_LOGO} width={size} height={size} />
      <img aria-hidden="true" className={css.darkMark} src={darkLogoUrl} width={size} height={size} />
    </span>
  );
}

/** Expanded-sidebar wordmark occupant. */
export function TokensBrandName(): React.JSX.Element {
  return <span className={css.name}><span>Tokens</span> <span className={css.cowork}>Cowork</span></span>;
}

const HERO_HEADLINES = new Set([
  "探索未至之境",
  "Explore the unknown",
  "Smart Spaces. Unified Access.",
]);

const HERO_BADGES = new Set(["预览版", "Preview"]);

function syncHeroHeadline(): void {
  const hero = document.querySelector('[data-phase="hero"]');
  if (hero === null) return;
  for (const element of hero.querySelectorAll<HTMLElement>("h1, h2, h3, div, span")) {
    if (element.childElementCount === 0 && HERO_HEADLINES.has(element.textContent?.trim() ?? "")) {
      element.textContent = "";
      element.hidden = true;
      element.dataset.tokensCoworkHeadline = "true";
      break;
    }
  }
  for (const element of hero.querySelectorAll<HTMLElement>("span, div")) {
    if (element.childElementCount === 0 && HERO_BADGES.has(element.textContent?.trim() ?? "")) {
      element.hidden = true;
      element.dataset.tokensCoworkPreviewBadge = "true";
    }
  }
}

/** Replace only the host's exact new-chat headline; conversation content is untouched. */
export function observeTokensCoworkHeadline(): () => void {
  syncHeroHeadline();
  const observer = new MutationObserver(syncHeroHeadline);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
