import { beforeEach, expect, it, vi } from "vitest";
const mock=vi.hoisted(()=>({rpc:vi.fn(),range:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createServerClient:async()=>({rpc:mock.rpc,from:()=>({select:()=>({eq:()=>({order:()=>({range:mock.range})})})})})}));
import { getRewardSummary } from "./reward-summary";
beforeEach(()=>vi.resetAllMocks());
it("uses the database total and does not fetch history when available",async()=>{mock.rpc.mockResolvedValue({data:[{balance:"753",earned:"1003"}],error:null});expect(await getRewardSummary("buyer")).toEqual({balance:753,earned:1003,available:true});expect(mock.range).not.toHaveBeenCalled();});
it("counts more than 50 entries and follows full pages in the rollout fallback",async()=>{
  mock.rpc.mockResolvedValue({error:{code:"PGRST202"}});
  mock.range.mockResolvedValueOnce({data:Array.from({length:1000},()=>({points:1})),error:null}).mockResolvedValueOnce({data:[{points:100},{points:-250}],error:null});
  expect(await getRewardSummary("buyer")).toEqual({balance:850,earned:1100,available:true});expect(mock.range).toHaveBeenLastCalledWith(1000,1999);
});
it("reports unavailable rather than a misleading partial balance",async()=>{mock.rpc.mockResolvedValue({error:{}});mock.range.mockResolvedValue({data:null,error:{}});expect((await getRewardSummary("buyer")).available).toBe(false);});
