import type { INaverAdsClient, NaverCampaign, NaverAdGroup } from "../api/types.js";
import {
  type BuilderConfig, type SearchTermRawRow, buildBaseRow, buildLookups,
  emptyConvBucket, addConv,
} from "./builder.js";

export interface BuildSearchTermArgs {
  client?: INaverAdsClient;
  startDate: string;
  endDate: string;
  config?: BuilderConfig;
  fetched?: {
    op: any[];
    conv: any[];
    campaigns: NaverCampaign[];
    adGroups: NaverAdGroup[];
  };
}

const KEY = (r: any) => [
  r.statDt ?? r.date ?? r.날짜,
  r.nccCampaignId ?? r.campaignId,
  r.nccAdgroupId ?? r.adGroupId,
  (r.pcMblTp ?? r.device ?? "").toUpperCase(),
  r.searchTerm ?? r.검색어 ?? r.keyword ?? "",
].join("||");

export async function buildSearchTermRaw(args: BuildSearchTermArgs): Promise<SearchTermRawRow[]> {
  if (!args.fetched) throw new Error("buildSearchTermRaw: live fetch path not yet implemented; pass `fetched`");
  const { op, conv, campaigns, adGroups } = args.fetched;
  const vatIncluded = args.config?.vatIncluded ?? true;
  const lookups = buildLookups(campaigns, adGroups);

  const convBuckets = new Map<string, ReturnType<typeof emptyConvBucket>>();
  for (const c of conv) {
    const k = KEY(c);
    if (!convBuckets.has(k)) convBuckets.set(k, emptyConvBucket());
    addConv(convBuckets.get(k)!, c.convTpCd ?? c.convTpName, c.ccnt, c.convAmt);
  }

  const rows: SearchTermRawRow[] = [];
  for (const o of op) {
    const k = KEY(o);
    const cb = convBuckets.get(k) ?? emptyConvBucket();
    const camp = lookups.campaign(o.nccCampaignId ?? o.campaignId);
    const ag = lookups.adGroup(o.nccAdgroupId ?? o.adGroupId);
    const searchTermResolved = o.searchTerm ?? o.검색어 ?? o.keyword ?? "unknown";
    const base = buildBaseRow({
      date: o.statDt ?? o.date ?? o.날짜,
      campaignName: camp?.name ?? (o.nccCampaignId ?? o.campaignId ?? "unknown"),
      campaignTp: camp?.campaignTp ?? "WEB_SITE",
      adGroupName: ag?.name ?? (o.nccAdgroupId ?? o.adGroupId ?? "unknown"),
      device: o.pcMblTp ?? o.device,
      op: o,
      conv: cb,
      vatIncluded,
    });
    rows.push({ ...base, 검색어: searchTermResolved });
  }
  return rows;
}
