// Static skill catalogue for the MVP skeleton — no backend. Shapes mirror the
// requirements (name / summary / tags / version / usage / status) so wiring a
// real source later is a swap of this module.
export interface SkillCard {
  id: string;
  name: string;
  summary: string;
  tags: string[];
  version: string;
  usage: number;
  status: "live" | "beta";
  category: SkillCategoryId;
  added: boolean;
}

export type SkillCategoryId =
  | "all"
  | "popular"
  | "expert"
  | "automation"
  | "data"
  | "content"
  | "flow";

export const SKILL_CATEGORIES: { id: SkillCategoryId; label: string }[] = [
  { id: "all", label: "全部技能" },
  { id: "popular", label: "常用" },
  { id: "expert", label: "专家" },
  { id: "automation", label: "自动化" },
  { id: "data", label: "数据分析" },
  { id: "content", label: "内容创作" },
  { id: "flow", label: "自动化流程" },
];

export const SKILLS: SkillCard[] = [
  {
    id: "data-cleaner",
    name: "数据清洗",
    summary: "清洗并标准化业务数据，去重、补全与格式统一。",
    tags: ["DATA", "ETL"],
    version: "1.2.3",
    usage: 1248,
    status: "live",
    category: "data",
    added: true,
  },
  {
    id: "report-writer",
    name: "周报生成",
    summary: "汇总本周工作要点，生成结构化中文周报。",
    tags: ["CONTENT", "REPORT"],
    version: "0.9.1",
    usage: 862,
    status: "live",
    category: "content",
    added: false,
  },
  {
    id: "news-digest",
    name: "每日 AI 新闻",
    summary: "抓取并摘要当天 AI 行业要闻，推送到当前对话。",
    tags: ["AUTOMATION", "NEWS"],
    version: "1.0.0",
    usage: 431,
    status: "beta",
    category: "automation",
    added: false,
  },
  {
    id: "sql-expert",
    name: "SQL 专家",
    summary: "把自然语言转成可执行 SQL，并解释查询计划。",
    tags: ["EXPERT", "SQL"],
    version: "2.1.0",
    usage: 2043,
    status: "live",
    category: "expert",
    added: false,
  },
  {
    id: "image-caption",
    name: "图像描述",
    summary: "为上传图片生成中文描述与关键标签。",
    tags: ["DATA", "VISION"],
    version: "0.4.2",
    usage: 178,
    status: "beta",
    category: "data",
    added: false,
  },
  {
    id: "meeting-prep",
    name: "会议前准备",
    summary: "根据日程整理议题、背景资料与待办清单。",
    tags: ["CONTENT", "OFFICE"],
    version: "1.1.0",
    usage: 596,
    status: "live",
    category: "content",
    added: false,
  },
];
