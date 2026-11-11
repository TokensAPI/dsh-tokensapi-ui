import tokensLogo from "../shell/assets/tokensapi-quicksand-mark.svg";

/** Paint only the host's decorative running icon; leave status and clock intact. */
export const runningBrandCss = `
html:is([data-theme="clean"], [data-theme="electrox"], [data-theme="unififi"]) {
  --tokens-running-logo: url("${tokensLogo}");
}
html:is([data-theme="clean"], [data-theme="electrox"], [data-theme="unififi"])
  [data-chat-running] [class*="_runningIcon"][aria-hidden="true"] {
  background: var(--tokens-running-logo) center / 10px 10px no-repeat;
}
html:is([data-theme="clean"], [data-theme="electrox"], [data-theme="unififi"])
  [data-chat-running] [class*="_runningIcon"][aria-hidden="true"] > * {
  display: none !important;
}
html:is([data-theme="clean"], [data-theme="electrox"], [data-theme="unififi"]):not([data-color-scheme="light"])
  [data-chat-running] [class*="_runningIcon"][aria-hidden="true"] {
  filter: invert(1);
}
/* Move only the painted logo, keeping the status row and timer stationary. */
@keyframes tokens-bench-settle {
  0%, 15%, 100% { background-position: 50% 50%; }
  42%, 60% { background-position: 50% calc(50% + 1px); }
}
@media (prefers-reduced-motion: no-preference) {
  html:is([data-theme="clean"], [data-theme="electrox"], [data-theme="unififi"])
    [data-chat-running] [class*="_runningIcon"][aria-hidden="true"] {
    animation: tokens-bench-settle 2.6s ease-in-out infinite;
  }
}
@media (prefers-reduced-motion: reduce) {
  html:is([data-theme="clean"], [data-theme="electrox"], [data-theme="unififi"])
    [data-chat-running] [class*="_runningIcon"][aria-hidden="true"] {
    animation: none;
    background-position: center;
  }
}
`;
