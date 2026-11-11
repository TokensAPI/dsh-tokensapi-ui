import benchfrontLockup from "./assets/benchfront-lockup.svg";
import css from "./PartnerBrand.module.css";

/** Shared partner logo, in a product bar or a host-sized sidebar slot. */
export function PartnerBrandMark({ logo, name, size = 38, contained = false }: {
  logo: string; name: string; size?: number; contained?: boolean;
}): React.JSX.Element {
  return (
    <span className={css.markFrame} style={{ width: size, height: size, display: "block" }}>
      <img className={[css.mark, contained && css.containedMark].filter(Boolean).join(" ")} src={logo} alt={name} />
    </span>
  );
}

/** The ELECTRO X lockup shared by all partners; compact fits the 24px host slot. */
export function PartnerBrandText({ name, localName, compact = false }: {
  name: string; localName?: string; compact?: boolean;
}): React.JSX.Element {
  return (
    <span className={[css.brandText, compact && css.compact].filter(Boolean).join(" ")}>
      <span className={css.brandTitle}>
        {name}{localName ? <> <span className={css.brandSlash}>/</span> {localName}</> : null}
      </span>
      <span className={css.poweredBy}>
        powered by
        <img className={css.poweredLockup} src={benchfrontLockup} alt="BenchFront" />
      </span>
    </span>
  );
}
