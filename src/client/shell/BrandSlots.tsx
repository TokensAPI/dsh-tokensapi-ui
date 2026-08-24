import { TOKENSAPI_LOGO } from "./tokensapi-logo.ts";
import css from "./BrandSlots.module.css";

export interface TokensBrandMarkProps {
  size: number;
  className?: string;
}

/** Official shell brand occupant. The host continues to own all button behavior. */
export function TokensBrandMark({ size, className }: TokensBrandMarkProps): React.JSX.Element {
  return (
    <img
      aria-hidden="true"
      className={[css.mark, className].filter(Boolean).join(" ")}
      src={TOKENSAPI_LOGO}
      width={size}
      height={size}
    />
  );
}

/** Expanded-sidebar wordmark occupant. */
export function TokensBrandName(): React.JSX.Element {
  return <span className={css.name}>TokensAPI</span>;
}
