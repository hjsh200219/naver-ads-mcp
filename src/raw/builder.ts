import type { NaverCampaign, NaverAdGroup } from "../api/types.js";
import { deriveMonth, deriveWeek, normalizeDate } from "../util/dates.js";

export const MEDIA_NAVER = "네이버";

export const CAMPAIGN_TP_KO: Record<string, string> = {
  WEB_SITE: "파워링크",
  SHOPPING: "쇼핑검색",
  BRAND_SEARCH: "브랜드검색",
  POWER_CONTENTS: "파워컨텐츠",
};

export const CONV_TP_TO_COL: Record<string, "구매완료" | "회원가입" | "신청완료" | "기타전환"> = {
  "1": "구매완료",
  "2": "회원가입",
  "3": "신청완료",
};

export function classifyConvTp(code: string | number | undefined): "구매완료" | "회원가입" | "신청완료" | "기타전환" {
  if (code === undefined || code === null) return "기타전환";
  return CONV_TP_TO_COL[String(code)] ?? "기타전환";
}

export interface RawRowBase {
  월별: string;
  주차: string;
  날짜: string;
  매체: string;
  캠페인유형: string;
  캠페인: string;
  광고그룹: string;
  디바이스: "PC" | "MO";
  "광고비 (VAT-)": number;
  노출수: number;
  클릭수: number;
  구매완료: number;
  회원가입: number;
  신청완료: number;
  기타전환: number;
  전환매출액: number;
  평균노출순위: number;
}

export type DailyRawRow = RawRowBase;
export interface KeywordRawRow extends RawRowBase { 키워드: string }
export interface SearchTermRawRow extends RawRowBase { 검색어: string }
export interface MaterialRawRow extends RawRowBase {
  소재ID: string;
  "네이버 쇼핑 상품 ID": string;
  상품명: string;
}

export interface BuilderConfig { vatIncluded?: boolean }

export function normalizeDevice(raw: string | undefined): "PC" | "MO" {
  if (!raw) return "PC";
  const u = raw.toUpperCase();
  if (u === "PC") return "PC";
  return "MO"; // M, MO, MOBILE all → MO
}

export function applyVat(salesAmt: number, vatIncluded: boolean): number {
  if (!vatIncluded) return salesAmt;
  return Math.round((salesAmt / 1.1) * 100) / 100;  // 2dp
}

export function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function buildBaseRow(opts: {
  date: string;
  campaignName: string;
  campaignTp: string;
  adGroupName: string;
  device: string | undefined;
  op: { salesAmt?: unknown; impCnt?: unknown; clkCnt?: unknown; avgRnk?: unknown };
  conv: { 구매완료: number; 회원가입: number; 신청완료: number; 기타전환: number; 전환매출액: number };
  vatIncluded: boolean;
}): RawRowBase {
  const d = normalizeDate(opts.date);
  return {
    월별: deriveMonth(d),
    주차: deriveWeek(d),
    날짜: d,
    매체: MEDIA_NAVER,
    캠페인유형: CAMPAIGN_TP_KO[opts.campaignTp] ?? opts.campaignTp,
    캠페인: opts.campaignName,
    광고그룹: opts.adGroupName,
    디바이스: normalizeDevice(opts.device),
    "광고비 (VAT-)": applyVat(num(opts.op.salesAmt), opts.vatIncluded),
    노출수: num(opts.op.impCnt),
    클릭수: num(opts.op.clkCnt),
    구매완료: opts.conv.구매완료,
    회원가입: opts.conv.회원가입,
    신청완료: opts.conv.신청완료,
    기타전환: opts.conv.기타전환,
    전환매출액: opts.conv.전환매출액,
    평균노출순위: num(opts.op.avgRnk),
  };
}

export function emptyConvBucket() {
  return { 구매완료: 0, 회원가입: 0, 신청완료: 0, 기타전환: 0, 전환매출액: 0 };
}

export function addConv(
  bucket: ReturnType<typeof emptyConvBucket>,
  convTpCd: unknown,
  ccnt: unknown,
  convAmt: unknown,
) {
  const col = classifyConvTp(convTpCd as any);
  bucket[col] += num(ccnt);
  bucket.전환매출액 += num(convAmt);
}

export function buildLookups(campaigns: NaverCampaign[], adGroups: NaverAdGroup[]) {
  const cMap = new Map(campaigns.map(c => [c.nccCampaignId, c]));
  const aMap = new Map(adGroups.map(a => [a.nccAdgroupId, a]));
  return {
    campaign: (id: string) => cMap.get(id),
    adGroup: (id: string) => aMap.get(id),
  };
}
