// A `*.module.css` import resolves to its class-name map (local name → hashed
// name). tsdown's cssModulesPlugin (tsdown.config.ts) compiles the stylesheet
// with lightningcss, injects it as a <style> tag at load, and default-exports
// this map.
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
