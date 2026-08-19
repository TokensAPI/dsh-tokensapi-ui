// `*.module.css` → class-name map (hashed local → global). `*.css` → raw text.
// The tsdown plugins (tsdown.config.ts) compile the former with lightningcss and
// inline the latter verbatim; the client injects both as <style> tags.
declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

declare module "*.css" {
  const cssText: string;
  export default cssText;
}
