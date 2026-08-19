// 技能库 module container: owns the list ↔ detail navigation (a selected skill),
// so the capability registry mounts one component while the two faces stay in
// separate files. Detail reads the already-fetched SkillEntry — no refetch.
import { useState } from "react";
import type { SkillEntry } from "./data.ts";
import { SkillsList } from "./SkillsList.tsx";
import { SkillDetail } from "./SkillDetail.tsx";

export function SkillsModule(): React.JSX.Element {
  const [selected, setSelected] = useState<SkillEntry | null>(null);
  return selected === null ? (
    <SkillsList onOpen={setSelected} />
  ) : (
    <SkillDetail skill={selected} onBack={() => setSelected(null)} />
  );
}
