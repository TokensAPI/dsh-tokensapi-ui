// Built-in capability modules registered through the same public registry a
// third-party plugin would use — no special-casing. Adding a module later is a
// registerCapability call, not a change to CapabilityWorkspace.
import { registerCapability } from "./capability-registry.ts";
import { SkillsModule } from "../modules/skills/SkillsModule.tsx";
import { NativeAutomation } from "../modules/automation/NativeAutomation.tsx";
import { ToolsModule } from "../modules/tools/ToolsModule.tsx";
import { ModulePlaceholder } from "../modules/ModulePlaceholder.tsx";

const KnowledgeView = (): React.JSX.Element => <ModulePlaceholder title="知识库" />;

/** Registrations belong to this plugin instance and are released on unload. */
export function registerBuiltinCapabilities(): () => void {
  const releases = [
    registerCapability({ id: "skills", label: "技能库", tag: "SKILLS", order: 10, render: SkillsModule }),
    registerCapability({ id: "knowledge", label: "知识库", tag: "KNOWLEDGE", order: 20, render: KnowledgeView }),
    registerCapability({ id: "automation", label: "自动化", tag: "AUTOMATION", order: 30, render: NativeAutomation, nativePanel: "schedules" }),
    registerCapability({ id: "tools", label: "工具库", tag: "TOOLS", order: 40, render: ToolsModule }),
  ];
  return () => { for (const release of releases) release(); };
}
