// L2 service: 광고주 발송용 weekly report HTML. Same KPI/매체/insights/actions
// data as artifact-html but with AE-only chrome stripped:
// - no topnav, step-bar, action-bar, regen buttons
// - no edit-hint / "AE 검토" markers
// - no confidence warning pill
// - data_warnings still rendered (광고주가 인지할 권리)
//
// Self-contained: inline CSS, no external fetch.

import type {
  AiAnalysis,
  ActionPriority,
  DeviceRow,
  Insight,
  InsightType,
  MediaBlock,
  PrecomputedPayload,
  WowDelta,
} from "../parser/types.js";

export interface RenderArgs {
  payload: PrecomputedPayload;
  ai: AiAnalysis;
}

export function renderWeeklyHtml({ payload, ai }: RenderArgs): string {
  return [
    "<!DOCTYPE html>",
    `<html lang="ko"><head><meta charset="UTF-8"><title>${escapeHtml(
      payload.advertiser,
    )} — 주간 리포트</title>`,
    "<style>",
    INLINE_CSS,
    "</style></head><body>",
    `<div class="page">`,
    renderHeader(payload),
    renderKpiGrid(payload.kpi_current, payload.kpi_previous, payload.kpi_wow),
    renderMediaBlocks(payload.media),
    renderReview(ai.review_text),
    renderInsights(ai.insights),
    renderActions(ai.action_items),
    renderDataWarnings(payload.data_warnings, ai.data_warnings),
    "</div></body></html>",
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtInt(n: number): string {
  return n.toLocaleString("ko-KR");
}

function fmtPct(n: number, digits = 2): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function deltaClass(n: number): string {
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "neu";
}

function renderHeader(payload: PrecomputedPayload): string {
  return [
    `<div class="pg-header">`,
    `<h1>${escapeHtml(payload.advertiser)} — 주간 리포트</h1>`,
    `<div class="sub">분석 기간: <strong>${escapeHtml(
      payload.report_period.start,
    )} ~ ${escapeHtml(payload.report_period.end)}</strong> | 비교 기간: ${escapeHtml(
      payload.compare_period.start,
    )} ~ ${escapeHtml(payload.compare_period.end)} | 매체: 네이버 파워링크 + 쇼핑검색</div>`,
    `</div>`,
  ].join("");
}

function kpiCard(
  label: string,
  value: string,
  delta: number,
  prevLabel: string,
  variant?: string,
): string {
  return [
    `<div class="kpi-card${variant ? " " + variant : ""}">`,
    `<div class="kpi-label">${escapeHtml(label)}</div>`,
    `<div class="kpi-value">${escapeHtml(value)}</div>`,
    `<div class="kpi-delta ${deltaClass(delta)}">${escapeHtml(fmtPct(delta))}</div>`,
    `<div class="kpi-prev">${escapeHtml(prevLabel)}</div>`,
    `</div>`,
  ].join("");
}

function renderKpiGrid(
  cur: PrecomputedPayload["kpi_current"],
  prev: PrecomputedPayload["kpi_previous"],
  wow: WowDelta,
): string {
  return [
    `<div class="kpi-grid">`,
    kpiCard(
      "총 노출수",
      fmtInt(cur.impressions),
      wow.impressions_pct,
      `전주 ${fmtInt(prev.impressions)}`,
    ),
    kpiCard(
      "총 클릭수",
      fmtInt(cur.clicks),
      wow.clicks_pct,
      `전주 ${fmtInt(prev.clicks)}`,
    ),
    kpiCard(
      "총 광고비",
      `${fmtInt(cur.cost)}원`,
      wow.cost_pct,
      `전주 ${fmtInt(prev.cost)}원`,
    ),
    kpiCard(
      "총 전환수",
      `${fmtInt(cur.conversions)}건`,
      wow.conversions_pct,
      `전주 ${fmtInt(prev.conversions)}건`,
      "green",
    ),
    kpiCard(
      "총 매출액",
      `${fmtInt(cur.revenue)}원`,
      wow.revenue_pct,
      `전주 ${fmtInt(prev.revenue)}원`,
      "green",
    ),
    kpiCard(
      "ROAS",
      `${cur.roas.toFixed(0)}%`,
      wow.roas_pct,
      `전주 ${prev.roas.toFixed(0)}%`,
      "orange",
    ),
    `</div>`,
  ].join("");
}

function renderMediaBlocks(blocks: MediaBlock[]): string {
  return `<div class="media-row">${blocks.map(renderMediaCard).join("")}</div>`;
}

function renderMediaCard(block: MediaBlock): string {
  const head = `<div class="mc-head"><h3>${escapeHtml(block.label)}</h3><span class="mc-badge ${deltaClass(
    block.wow.roas_pct,
  )}">ROAS ${fmtPct(block.wow.roas_pct, 1)}</span></div>`;
  const headerRow = `<tr><th>구분</th><th>노출</th><th>클릭</th><th>비용(원)</th><th>전환</th><th>매출(원)</th><th>ROAS</th></tr>`;
  const dataRows = block.rows.map((r) => deviceRow(r)).join("");
  const wowRow = `<tr class="wow-row"><td>전주 비교</td><td class="${deltaClass(
    block.wow.impressions_pct,
  )}">${fmtPct(block.wow.impressions_pct, 1)}</td><td class="${deltaClass(
    block.wow.clicks_pct,
  )}">${fmtPct(block.wow.clicks_pct, 1)}</td><td class="${deltaClass(
    block.wow.cost_pct,
  )}">${fmtPct(block.wow.cost_pct, 1)}</td><td class="${deltaClass(
    block.wow.conversions_pct,
  )}">${fmtPct(block.wow.conversions_pct, 1)}</td><td class="${deltaClass(
    block.wow.revenue_pct,
  )}">${fmtPct(block.wow.revenue_pct, 1)}</td><td class="${deltaClass(
    block.wow.roas_pct,
  )}">${fmtPct(block.wow.roas_pct, 1)}</td></tr>`;
  return `<div class="media-card">${head}<table class="mc-table"><thead>${headerRow}</thead><tbody>${dataRows}${wowRow}</tbody></table></div>`;
}

function deviceRow(r: DeviceRow): string {
  return `<tr><td>${escapeHtml(r.device)}</td><td>${fmtInt(r.impressions)}</td><td>${fmtInt(
    r.clicks,
  )}</td><td>${fmtInt(r.cost)}</td><td>${fmtInt(r.conversions)}건</td><td>${fmtInt(
    r.revenue,
  )}</td><td>${r.roas.toFixed(0)}%</td></tr>`;
}

function renderReview(text: string): string {
  return `<div class="section-label"><h2>실적 리뷰</h2></div><div class="report-card"><div class="review-block"><p class="review-text">${escapeHtml(
    text,
  )}</p></div></div>`;
}

function insightTagClass(t: InsightType): string {
  return t === "good"
    ? "good"
    : t === "bad"
      ? "bad"
      : t === "warn"
        ? "warn"
        : "info";
}

function insightTagLabel(t: InsightType): string {
  return t === "good"
    ? "기회"
    : t === "bad"
      ? "즉시 개선 필요"
      : t === "warn"
        ? "모니터링 필요"
        : "참고";
}

function renderInsights(insights: Insight[]): string {
  const items = insights
    .map(
      (i) =>
        `<li class="insight-item"><span class="it-tag ${insightTagClass(
          i.type,
        )}">${escapeHtml(insightTagLabel(i.type))}</span><div class="insight-text"><p><strong>${escapeHtml(
          i.title,
        )}</strong> — ${escapeHtml(i.body)}</p><div class="it-metric">${i.metrics
          .map((m) => `<span>${escapeHtml(m)}</span>`)
          .join("")}</div></div></li>`,
    )
    .join("");
  return `<div class="section-label"><h2>주요 인사이트</h2></div><div class="report-card"><ul class="insight-list">${items}</ul></div>`;
}

function priorityClass(p: ActionPriority): string {
  return p === "high" ? "pri-high" : p === "mid" ? "pri-mid" : "pri-low";
}

function priorityLabel(p: ActionPriority): string {
  return p === "high" ? "긴급" : p === "mid" ? "권장" : "유지";
}

function renderActions(actions: AiAnalysis["action_items"]): string {
  const items = actions
    .map(
      (a) =>
        `<li class="action-row"><div class="action-text"><div class="action-title">${escapeHtml(
          a.title,
        )}</div><div class="action-desc">${escapeHtml(
          a.description,
        )}</div></div><span class="action-priority ${priorityClass(
          a.priority,
        )}">${escapeHtml(priorityLabel(a.priority))}</span></li>`,
    )
    .join("");
  return `<div class="section-label"><h2>다음 주 추천 액션</h2></div><div class="report-card"><ul class="action-list-clean">${items}</ul></div>`;
}

function renderDataWarnings(
  payloadWarnings: string[],
  aiWarnings: string[],
): string {
  const all = [...payloadWarnings, ...aiWarnings];
  if (all.length === 0) return "";
  const items = all.map((w) => `<li>${escapeHtml(w)}</li>`).join("");
  return `<div class="section-label"><h2>데이터 안내</h2></div><div class="report-card"><ul class="warning-list">${items}</ul></div>`;
}

const INLINE_CSS = `
:root{--primary:#1A5C9A;--accent:#2E86DE;--light:#EAF3FB;--green:#27AE60;--red:#E74C3C;--orange:#F39C12;--bg:#F4F6F9;--card:#FFFFFF;--border:#DCE6F0;--text:#1C2B3A;--muted:#6C7D8E;--radius:10px}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:var(--bg);color:var(--text);font-size:14px}
.page{max-width:1180px;margin:0 auto;padding:24px 20px 60px}
.pg-header{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-bottom:20px}
.pg-header h1{font-size:20px;font-weight:700;color:var(--primary)}
.pg-header .sub{font-size:13px;color:var(--muted);margin-top:4px}
.kpi-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:20px}
.kpi-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:14px}
.kpi-card.green{border-left:4px solid var(--green)}
.kpi-card.orange{border-left:4px solid var(--orange)}
.kpi-label{font-size:12px;color:var(--muted)}
.kpi-value{font-size:22px;font-weight:700;margin:6px 0}
.kpi-delta{font-size:12px;font-weight:600}
.kpi-delta.up{color:var(--green)}
.kpi-delta.down{color:var(--red)}
.kpi-prev{font-size:11px;color:var(--muted);margin-top:4px}
.media-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.media-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px}
.mc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.mc-head h3{font-size:14px}
.mc-badge{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px}
.mc-badge.up{background:#E8F8EF;color:#1E8449}
.mc-badge.down{background:#FDEDEC;color:#C0392B}
.mc-table{width:100%;border-collapse:collapse;font-size:12px}
.mc-table th,.mc-table td{padding:6px 8px;border-bottom:1px solid var(--border);text-align:right}
.mc-table th:first-child,.mc-table td:first-child{text-align:left}
.wow-row{background:#FFF8F8}
.up{color:var(--green)}
.down{color:var(--red)}
.section-label{margin:18px 0 10px}
.section-label h2{font-size:15px;color:var(--primary)}
.report-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:8px}
.review-text{font-size:13px;line-height:1.7;white-space:pre-wrap}
.insight-list,.action-list-clean{list-style:none}
.insight-item{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
.it-tag{font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-right:6px;align-self:flex-start}
.it-tag.good{background:#E8F8EF;color:#1E8449}
.it-tag.bad{background:#FDEDEC;color:#C0392B}
.it-tag.warn{background:#FEF9E7;color:#B7770D}
.it-tag.info{background:var(--light);color:var(--primary)}
.it-metric{display:flex;gap:12px;margin-top:6px;font-size:11px;color:var(--muted)}
.action-row{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
.action-title{font-weight:700;font-size:13px}
.action-desc{font-size:12px;color:var(--muted);margin-top:4px}
.action-priority{font-size:10px;font-weight:700;padding:3px 10px;border-radius:10px;align-self:flex-start}
.pri-high{background:#FDEDEC;color:#C0392B}
.pri-mid{background:#FEF9E7;color:#B7770D}
.pri-low{background:#E8F8EF;color:#1E8449}
.warning-list{list-style:disc;padding-left:20px;color:#B7770D;font-size:12px}
`;
