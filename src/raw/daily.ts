import type { INaverAdsClient, NaverCampaign, NaverAdGroup } from "../api/types.js";
import {
  type BuilderConfig, type DailyRawRow, buildBaseRow, buildLookups,
  emptyConvBucket, addConv,
} from "./builder.js";

export interface BuildDailyArgs {
  client?: INaverAdsClient;       // not used if `fetched` provided
  startDate: string;
  endDate: string;
  config?: BuilderConfig;
  fetched?: {
    op: any[];           // AD reportTp rows
    conv: any[];         // AD_CONVERSION reportTp rows
    campaigns: NaverCampaign[];
    adGroups: NaverAdGroup[];
  };
}

const KEY = (r: any) => [
  r.statDt ?? r.date ?? r.날짜,
  r.nccCampaignId ?? r.campaignId,
  r.nccAdgroupId ?? r.adGroupId,
  (r.pcMblTp ?? r.device ?? "").toUpperCase(),
].join("||");

export async function buildDailyRaw(args: BuildDailyArgs): Promise<DailyRawRow[]> {
  if (!args.fetched) {
    throw new Error("buildDailyRaw: live fetch path not yet implemented; pass `fetched` for now");
  }
  const { op, conv, campaigns, adGroups } = args.fetched;
  const vatIncluded = args.config?.vatIncluded ?? true;
  const lookups = buildLookups(campaigns, adGroups);

  // Group conversion rows by (date, campaign, adgroup, device)
  const convBuckets = new Map<string, ReturnType<typeof emptyConvBucket>>();
  for (const c of conv) {
    const k = KEY(c);
    if (!convBuckets.has(k)) convBuckets.set(k, emptyConvBucket());
    addConv(convBuckets.get(k)!, c.convTpCd ?? c.convTpName, c.ccnt, c.convAmt);
  }

  const rows: DailyRawRow[] = [];
  for (const o of op) {
    const k = KEY(o);
    const conv = convBuckets.get(k) ?? emptyConvBucket();
    const camp = lookups.campaign(o.nccCampaignId ?? o.campaignId);
    const ag = lookups.adGroup(o.nccAdgroupId ?? o.adGroupId);
    rows.push(buildBaseRow({
      date: o.statDt ?? o.date ?? o.날짜,
      campaignName: camp?.name ?? (o.nccCampaignId ?? o.campaignId ?? "unknown"),
      campaignTp: camp?.campaignTp ?? "WEB_SITE",
      adGroupName: ag?.name ?? (o.nccAdgroupId ?? o.adGroupId ?? "unknown"),
      device: o.pcMblTp ?? o.device,
      op: o,
      conv,
      vatIncluded,
    }));
  }
  return rows;
}
