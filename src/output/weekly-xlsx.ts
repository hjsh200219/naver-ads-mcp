// L2 service: 광고주 발송용 weekly xlsx (3 sheets: KPI 요약 / 매체별 성과 / AI 분석).
// Mirrors the HTML version's data 1:1 so parity tests can match raw numeric values.

import ExcelJS from "exceljs";
import type { AiAnalysis, PrecomputedPayload } from "../parser/types.js";

export interface WriteXlsxArgs {
  payload: PrecomputedPayload;
  ai: AiAnalysis;
  outputPath: string;
}

export async function writeWeeklyXlsx(args: WriteXlsxArgs): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "naver-ads-mcp";
  wb.created = new Date();

  buildKpiSummarySheet(wb, args.payload);
  buildMediaBreakdownSheet(wb, args.payload);
  buildAiAnalysisSheet(wb, args.ai, args.payload);

  await wb.xlsx.writeFile(args.outputPath);
}

function buildKpiSummarySheet(
  wb: ExcelJS.Workbook,
  payload: PrecomputedPayload,
): void {
  const sheet = wb.addWorksheet("KPI 요약");
  sheet.columns = [
    { header: "지표", key: "metric", width: 16 },
    { header: "금주", key: "current", width: 16 },
    { header: "전주", key: "previous", width: 16 },
    { header: "WoW (%)", key: "delta", width: 12 },
  ];

  const cur = payload.kpi_current;
  const prev = payload.kpi_previous;
  const wow = payload.kpi_wow;

  sheet.addRow({
    metric: "총 노출수",
    current: cur.impressions,
    previous: prev.impressions,
    delta: wow.impressions_pct,
  });
  sheet.addRow({
    metric: "총 클릭수",
    current: cur.clicks,
    previous: prev.clicks,
    delta: wow.clicks_pct,
  });
  sheet.addRow({
    metric: "총 광고비",
    current: cur.cost,
    previous: prev.cost,
    delta: wow.cost_pct,
  });
  sheet.addRow({
    metric: "총 전환수",
    current: cur.conversions,
    previous: prev.conversions,
    delta: wow.conversions_pct,
  });
  sheet.addRow({
    metric: "총 매출액",
    current: cur.revenue,
    previous: prev.revenue,
    delta: wow.revenue_pct,
  });
  sheet.addRow({
    metric: "ROAS",
    current: cur.roas,
    previous: prev.roas,
    delta: wow.roas_pct,
  });

  // Number formats: thousands separator on cur/prev, percent-style on delta.
  for (let r = 2; r <= 7; r++) {
    sheet.getCell(`B${r}`).numFmt = "#,##0";
    sheet.getCell(`C${r}`).numFmt = "#,##0";
    sheet.getCell(`D${r}`).numFmt = "0.0";
  }
  sheet.getRow(1).font = { bold: true };
}

function buildMediaBreakdownSheet(
  wb: ExcelJS.Workbook,
  payload: PrecomputedPayload,
): void {
  const sheet = wb.addWorksheet("매체별 성과");
  sheet.columns = [
    { header: "매체", key: "media", width: 14 },
    { header: "구분", key: "device", width: 10 },
    { header: "노출", key: "impressions", width: 12 },
    { header: "클릭", key: "clicks", width: 10 },
    { header: "비용(원)", key: "cost", width: 14 },
    { header: "전환", key: "conversions", width: 10 },
    { header: "매출(원)", key: "revenue", width: 14 },
    { header: "ROAS", key: "roas", width: 10 },
  ];

  for (const block of payload.media) {
    for (const row of block.rows) {
      sheet.addRow({
        media: block.label,
        device: row.device,
        impressions: row.impressions,
        clicks: row.clicks,
        cost: row.cost,
        conversions: row.conversions,
        revenue: row.revenue,
        roas: row.roas,
      });
    }
    sheet.addRow({
      media: `${block.label} 전주비`,
      device: "WoW%",
      impressions: block.wow.impressions_pct,
      clicks: block.wow.clicks_pct,
      cost: block.wow.cost_pct,
      conversions: block.wow.conversions_pct,
      revenue: block.wow.revenue_pct,
      roas: block.wow.roas_pct,
    });
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.font = { bold: true };
      return;
    }
    for (let c = 3; c <= 7; c++) {
      row.getCell(c).numFmt = "#,##0";
    }
    row.getCell(8).numFmt = "0";
  });
}

function buildAiAnalysisSheet(
  wb: ExcelJS.Workbook,
  ai: AiAnalysis,
  payload: PrecomputedPayload,
): void {
  const sheet = wb.addWorksheet("AI 분석");
  sheet.columns = [
    { header: "구분", key: "kind", width: 12 },
    { header: "분류", key: "category", width: 16 },
    { header: "내용", key: "body", width: 60 },
    { header: "우선순위", key: "priority", width: 12 },
  ];

  sheet.addRow({ kind: "실적 리뷰", category: "", body: ai.review_text });

  for (const ins of ai.insights) {
    sheet.addRow({
      kind: "인사이트",
      category: insightLabel(ins.type),
      body: `${ins.title} — ${ins.body}`,
      priority: "",
    });
  }

  for (const act of ai.action_items) {
    sheet.addRow({
      kind: "액션",
      category: "",
      body: `${act.title} — ${act.description}`,
      priority: priorityLabel(act.priority),
    });
  }

  const allWarnings = [...payload.data_warnings, ...ai.data_warnings];
  for (const w of allWarnings) {
    sheet.addRow({ kind: "데이터 안내", category: "", body: w, priority: "" });
  }

  sheet.getRow(1).font = { bold: true };
  sheet.getColumn(3).alignment = { wrapText: true, vertical: "top" };
}

function insightLabel(t: AiAnalysis["insights"][number]["type"]): string {
  if (t === "good") return "기회";
  if (t === "bad") return "즉시 개선";
  if (t === "warn") return "모니터링";
  return "참고";
}

function priorityLabel(
  p: AiAnalysis["action_items"][number]["priority"],
): string {
  if (p === "high") return "긴급";
  if (p === "mid") return "권장";
  return "유지";
}
