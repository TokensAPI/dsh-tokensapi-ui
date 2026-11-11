import darkLogoUrl from "./assets/tokensapi-quicksand-mark.svg";
import lightLogoUrl from "./assets/tokensapi-quicksand-mark.svg";
import unififiLogo from "./assets/unififi-mark.svg";
import { PartnerBrandMark, PartnerBrandText } from "./PartnerBrand.tsx";
import css from "./BrandSlots.module.css";

export interface TokensBrandMarkProps {
  size: number;
  className?: string;
}

/** Keep the host's hit area while matching the designer's compact lockup mark. */
export function TokensSidebarBrandMark(props: TokensBrandMarkProps): React.JSX.Element {
  return <TokensBrandMark {...props} className={[props.className, css.sidebarMark].filter(Boolean).join(" ")} />;
}

/** Official shell brand occupant. The host continues to own all button behavior. */
export function TokensBrandMark({ size, className }: TokensBrandMarkProps): React.JSX.Element {
  return (
    <span className={[css.mark, className].filter(Boolean).join(" ")} style={{ width: size, height: size }}>
      <img
        aria-hidden="true"
        className={css.lightMark}
        src={lightLogoUrl}
        width={size}
        height={size}
      />
      <img aria-hidden="true" className={css.darkMark} src={darkLogoUrl} width={size} height={size} />
      <span className={css.unififiMark}><PartnerBrandMark logo={unififiLogo} name="UNIFIFI / 由你飞飞" size={size} contained /></span>
    </span>
  );
}

/** Expanded-sidebar wordmark occupant. */
export function TokensBrandName(): React.JSX.Element {
  return (
    <span className={css.name}>
      <span className={css.tokensName}><span>Tokens</span> <span className={css.cowork}>Cowork</span></span>
      <span className={css.unififiName}>
        <PartnerBrandText name="UNIFIFI" />
      </span>
    </span>
  );
}

const HERO_HEADLINES = new Set([
  "探索未至之境",
  "Explore the unknown",
  "Into the Unknown",
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
  observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  return () => observer.disconnect();
}
