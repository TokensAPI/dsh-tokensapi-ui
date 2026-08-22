export interface OnlineTool {
  id: string;
  name: string;
  description: string;
  category: "金蝶" | "吉客云" | "数据处理";
  tags: string[];
  runUrl: string;
}

export const ONLINE_TOOLS: OnlineTool[] = [
  {
    id: "receipt-cleaner",
    name: "收款单清洗（金蝶）",
    description: "把销售收款明细 Excel 清洗成金蝶收款单导入格式，并按支付渠道分别生成结果。",
    category: "金蝶",
    tags: ["金蝶", "收款单", "Excel"],
    runUrl: "https://www.electrox.cloud/tools/receipt-cleaner/run",
  },
  {
    id: "jky-logistics",
    name: "物流查询（吉客云）",
    description: "输入吉客云销售单号，查询全部包裹、顺丰运单号、重量和货品信息。",
    category: "吉客云",
    tags: ["吉客云", "物流", "运单号"],
    runUrl: "https://www.electrox.cloud/tools/jky-logistics/run",
  },
  {
    id: "data-cleaner",
    name: "粒刻数据清洗",
    description: "把发货 Excel 清洗成东福网上传格式，统一管理客户、SKU 和叫法匹配。",
    category: "数据处理",
    tags: ["Excel", "SKU 匹配", "东福网"],
    runUrl: "https://www.electrox.cloud/tools/data-cleaner/run",
  },
  {
    id: "jky-forecast",
    name: "销售预估达成同步（吉客云）",
    description: "将吉客云当月实际发货数量写入销售预估 Excel，并生成可下载的更新文件。",
    category: "吉客云",
    tags: ["吉客云", "销售预估", "Excel"],
    runUrl: "https://www.electrox.cloud/tools/jky-forecast/run",
  },
];

