import { BRAND_LOGO } from "../shell/brand-logo.ts";
import { TOKENSAPI_LOGO } from "../shell/tokensapi-logo.ts";
import styles from "./StartupLoading.module.css";

const GATE_ID = "tokens-model-manager-gate";
const KEY_INPUT_ID = "tokens-model-manager-key";
const css = (name: keyof typeof styles): string => styles[name] ?? "";

function clearDecoration(gate: HTMLElement): void {
  delete gate.dataset.tokensLoading;
  delete gate.dataset.tokensAccessForm;
  gate.classList.remove(css("gate"));
  gate.classList.remove(css("formGate"));
}

function createBrand(): HTMLElement {
  const brand = document.createElement("div");
  brand.className = css("brand");
  const mark = document.createElement("img");
  mark.className = css("mark");
  mark.src = BRAND_LOGO;
  mark.alt = "";
  const identity = document.createElement("div");
  identity.className = css("identity");
  identity.innerHTML = '<strong>ELECTRO X <i>/</i> 粒刻</strong><span>TOKENSAPI ACCESS</span>';
  brand.append(mark, identity);
  return brand;
}

/** Restyle the manager-owned form without replacing its interactive nodes, so
 * its validation, request and error handling remain the single source of truth. */
function decorateAccessForm(gate: HTMLElement): void {
  const input = gate.querySelector<HTMLInputElement>(`#${KEY_INPUT_ID}`);
  if (!input) return;
  if (gate.dataset.tokensAccessForm === "true") return;

  const form = input.closest("form");
  const card = form?.parentElement;
  const label = form?.querySelector<HTMLLabelElement>(`label[for="${KEY_INPUT_ID}"]`);
  const inputRow = input.parentElement;
  const reveal = inputRow?.querySelector<HTMLButtonElement>('button[type="button"]');
  const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  const message = submit?.previousElementSibling;
  if (!form || !card || !label || !inputRow || !reveal || !submit || !(message instanceof HTMLElement)) return;

  delete gate.dataset.tokensLoading;
  gate.dataset.tokensAccessForm = "true";
  gate.classList.remove(css("gate"));
  gate.classList.add(css("formGate"));
  card.className = css("formPanel");
  form.className = css("form");
  label.className = css("fieldLabel");
  inputRow.className = css("inputRow");
  input.className = css("keyInput");
  reveal.className = css("revealButton");
  message.className = css("message");
  submit.className = css("submitButton");

  const previousIntro = form.previousElementSibling?.textContent ?? "";
  const reverify = /旧版本|重新输入|stored|not verified/i.test(previousIntro);
  const title = document.createElement("h1");
  title.className = css("formTitle");
  title.textContent = reverify ? "重新连接 TokensAPI" : "连接 TokensAPI";
  const description = document.createElement("p");
  description.className = css("formDescription");
  description.textContent = reverify
    ? "当前凭据需要重新验证。连接后即可继续使用模型、识图和 Agent 能力。"
    : "验证 API Key 后，即可使用模型、识图和 Agent 能力。";

  label.textContent = "API KEY";
  input.placeholder = "输入你的 TokensAPI API Key";
  input.autocomplete = "new-password";
  card.replaceChildren(createBrand(), title, description, form);
}

/** Replace only the model manager's transient checking card. The manager keeps
 * ownership of authentication: its input appearing or its gate disappearing
 * immediately ends this presentation state. */
function decorateCheckingGate(): void {
  const gate = document.getElementById(GATE_ID);
  if (!(gate instanceof HTMLElement)) return;
  if (document.documentElement.dataset.theme !== "electrox") {
    clearDecoration(gate);
    return;
  }
  if (gate.querySelector(`#${KEY_INPUT_ID}`) !== null) {
    decorateAccessForm(gate);
    return;
  }
  if (gate.dataset.tokensLoading === "true") return;

  gate.dataset.tokensLoading = "true";
  gate.classList.add(css("gate"));

  const panel = document.createElement("section");
  panel.className = css("panel");
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");

  const brand = createBrand();
  const identity = brand.querySelector(`.${css("identity")}`);
  const status = identity?.querySelector("span");
  if (status) status.textContent = "INITIALIZING WORKSPACE";

  const title = document.createElement("h1");
  title.className = css("title");
  title.textContent = "正在启动 TokensHarness";
  const description = document.createElement("p");
  description.className = css("description");
  description.textContent = "正在验证本地配置并初始化模型服务";

  const track = document.createElement("div");
  track.className = css("track");
  track.setAttribute("aria-hidden", "true");
  const pulse = document.createElement("span");
  track.appendChild(pulse);

  const footer = document.createElement("div");
  footer.className = css("footer");
  footer.append("SECURE BOOT", document.createElement("span"), "POWERED BY");
  const platform = document.createElement("img");
  platform.src = TOKENSAPI_LOGO;
  platform.alt = "TokensAPI";
  footer.appendChild(platform);

  panel.append(brand, title, description, track, footer);
  gate.replaceChildren(panel);
}

export function observeStartupGate(): () => void {
  if (typeof document === "undefined") return () => {};
  decorateCheckingGate();
  const observer = new MutationObserver(decorateCheckingGate);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => {
    observer.disconnect();
    const gate = document.getElementById(GATE_ID);
    if (gate instanceof HTMLElement) clearDecoration(gate);
  };
}
