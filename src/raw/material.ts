import type { INaverAdsClient, NaverCampaign, NaverAdGroup, NaverProductGroup } from "../api/types.js";
import {
  type BuilderConfig, type MaterialRawRow, buildBaseRow, buildLookups,
  emptyConvBucket, addConv,
} from "./builder.js";

export interface BuildMaterialArgs {
  client?: INaverAdsClient;
  startDate: string;
  endDate: string;
  config?: BuilderConfig;
  fetched?: {
    op: any[];
    conv: any[];
    campaigns: NaverCampaign[];
    adGroups: NaverAdGroup[];
    products?: NaverProductGroup[];
  };
}

const KEY = (r: any) => [
  r.statDt ?? r.date,
  r.nccCampaignId ?? r.campaignId,
  r.nccAdgroupId ?? r.adGroupId,
  (r.pcMblTp ?? r.device ?? "").toUpperCase(),
  r.nccAdId ?? r.adId ?? "",
  r.productId ?? "",
].join("||");

export async function buildMaterialRaw(args: BuildMaterialArgs): Promise<MaterialRawRow[]> {
  if (!args.fetched) throw new Error("buildMaterialRaw: live fetch not yet implemented; pass `fetched`");
  const { op, conv, campaigns, adGroups, products = [] } = args.fetched;
  const vatIncluded = args.config?.vatIncluded ?? true;
  const lookups = buildLookups(campaigns, adGroups);
  const productNameMap = new Map<string, string>();
  for (const pg of products) {
    for (const p of pg.productList ?? []) productNameMap.set(p.productId, p.productName);
  }

  const convBuckets = new Map<string, ReturnType<typeof emptyConvBucket>>();
  for (const c of conv) {
    const k = KEY(c);
    if (!convBuckets.has(k)) convBuckets.set(k, emptyConvBucket());
    addConv(convBuckets.get(k)!, c.convTpCd ?? c.convTpName, c.ccnt, c.convAmt);
  }

  const rows: MaterialRawRow[] = [];
  for (const o of op) {
    const k = KEY(o);
    const cb = convBuckets.get(k) ?? emptyConvBucket();
    const camp = lookups.campaign(o.nccCampaignId ?? o.campaignId);
    const ag = lookups.adGroup(o.nccAdgroupId ?? o.adGroupId);
    const productId: string = o.productId ?? "";
    const productName: string = o.productName ?? productNameMap.get(productId) ?? "";
    const base = buildBaseRow({
      date: o.statDt ?? o.date,
      campaignName: camp?.name ?? (o.nccCampaignId ?? o.campaignId ?? "unknown"),
      campaignTp: camp?.campaignTp ?? "SHOPPING",
      adGroupName: ag?.name ?? (o.nccAdgroupId ?? o.adGroupId ?? "unknown"),
      device: o.pcMblTp ?? o.device,
      op: o,
      conv: cb,
      vatIncluded,
    });
    rows.push({
      ...base,
      소재ID: String(o.nccAdId ?? o.adId ?? ""),
      "네이버 쇼핑 상품 ID": productId,
      상품명: productName,
    });
  }
  return rows;
}
