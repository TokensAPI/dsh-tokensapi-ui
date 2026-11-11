import { useId } from "react";
import type { DebugThemeMode } from "./debug-preview.ts";
import css from "./ThemeChoices.module.css";

const choices = [
  ["auto", "自动", "跟随账号所属组织"],
  ["clean", "TokensAPI", "基础主题"],
  ["electrox", "ELECTRO X / 粒刻", "合作方主题"],
  ["unififi", "UNIFIFI 由你飞飞", "合作方主题"],
] as const;

export function ThemeChoices({ label, value, onChange, description }: {
  label: string;
  value: DebugThemeMode;
  onChange: (value: DebugThemeMode) => void;
  description: string;
}): React.JSX.Element {
  const id = useId();
  return (
    <fieldset className={css.fieldset} aria-describedby={`${id}-description`}>
      <legend className={css.legend}>{label}</legend>
      <div className={css.choices}>
        {choices.map(([mode, title, detail]) => (
          <label className={css.choice} key={mode}>
            <input type="radio" name={id} value={mode} checked={value === mode}
              onChange={() => onChange(mode)} />
            <span className={css.copy}><span className={css.title}>{title}</span><span className={css.detail}>{detail}</span></span>
          </label>
        ))}
      </div>
      <p id={`${id}-description`} className={css.description}>{description}</p>
    </fieldset>
  );
}
