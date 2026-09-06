import { describe, expect, it } from "vitest";
import { dishAvailable, hasOffer, kitchenDistance, matchesDiscovery, newYorkDate, recommendationScore, travelEstimate, validPoint, type DiscoveryDish, type DiscoveryKitchen } from "./discovery";
const dish: DiscoveryDish = { id: "dish", kitchen_id: "k", name: "Palestinian maqluba", description: "Rice and chicken", price_cents: 1800, photo_url: null, contains_meat: true, allergens: ["none_declared"], is_available: true, sourcing_status: "verified", sourcing_until: "2026-09-06", vegetarian_claimed: false, serves: 1, meal_tags: [], offer_title: null, offer_expires_at: null, rating_count: 0, avg_rating_10: 0 };
const kitchen = { id:"k", name:"Neighborhood kitchen", neighborhood_label:"Teaneck", cuisine_tags:["Palestinian"], approx_lat:40.89, approx_lng:-74.02, repeat_customers:2, avg_rating_10:8 } as DiscoveryKitchen;
const today="2026-09-06";
describe("honest food discovery",()=>{
  it("does not infer dietary declarations from a name, cuisine or lack of meat",()=>{
    expect(matchesDiscovery({...dish,contains_meat:false},kitchen,["vegetarian"],"",today)).toBe(false);
    expect(matchesDiscovery(dish,kitchen,["zabiha"],"",today)).toBe(false);
    expect(matchesDiscovery(dish,kitchen,["no_pork"],"",today)).toBe(false);
  });
  it("requires every selected filter and every search term",()=>{
    expect(matchesDiscovery({...dish,serves:4,meal_tags:["iftar"]},{...kitchen,zabiha_claimed:true},["zabiha","family_trays","iftar"],"maqluba teaneck",today)).toBe(true);
    expect(matchesDiscovery(dish,kitchen,["allergens","family_trays"],"",today)).toBe(false);
    expect(matchesDiscovery(dish,kitchen,[],"maqluba kunafa",today)).toBe(false);
  });
  it("blocks expired, missing or unreviewed meat provenance",()=>{
    expect(dishAvailable(dish,today)).toBe(true);
    for(const changes of [{sourcing_until:"2026-09-05"},{sourcing_until:null},{sourcing_status:"pending"},{is_available:false}]) expect(dishAvailable({...dish,...changes},today)).toBe(false);
    expect(dishAvailable({...dish,contains_meat:false,sourcing_until:null},today)).toBe(true);
  });
  it("uses the kitchen timezone for receipt expiry",()=>expect(newYorkDate(new Date("2026-09-07T01:00:00Z"))).toBe(today));
  it("shows only offers that have not ended",()=>{
    const offer={...dish,offer_title:"Family supper",offer_expires_at:"2026-09-06T23:00:00Z"};
    expect(hasOffer(offer,Date.parse("2026-09-06T22:00:00Z"))).toBe(true);
    expect(hasOffer(offer,Date.parse(offer.offer_expires_at))).toBe(false);
    expect(hasOffer({...offer,offer_expires_at:"bad"},Date.now())).toBe(false);
  });
  it("does not invent distance or route data for invalid coordinates",()=>{
    expect(validPoint({lat:NaN,lng:0})).toBe(false);
    expect(validPoint({lat:91,lng:0})).toBe(false);
    expect(kitchenDistance(kitchen,{lat:40.89,lng:-74.02})).toBe(0);
    expect(kitchenDistance(kitchen,{lat:Infinity,lng:0})).toBeNull();
    expect(travelEstimate(null)).toBeNull();expect(travelEstimate(-1)).toBeNull();
    expect(travelEstimate(1)).toMatch(/est\. drive/);
  });
  it("uses completed cuisine preferences for personal recommendations",()=>{
    const origin={lat:40.89,lng:-74.02};
    expect(recommendationScore(kitchen,new Set(["Palestinian"]),origin)).toBeGreaterThan(recommendationScore(kitchen,new Set(),origin));
  });
});
