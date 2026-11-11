/** Extend clean paint recipes to branded variants without changing specificity. */
export function includeBaseSkins(css: string): string {
  return css.replaceAll('[data-theme="clean"]', ':is([data-theme="clean"], [data-theme="unififi"])');
}
