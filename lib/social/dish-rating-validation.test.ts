import { expect, it } from "vitest";
import { parseDishRatings } from "./dish-rating-validation";
const id="00000000-0000-4000-8000-000000000001";
it("keeps a zero rating and allows an optional unrated dish",()=>{const form=new FormData();form.set("dish_rating_"+id,"0");form.set("dish_rating_00000000-0000-4000-8000-000000000002","");expect(parseDishRatings(form)).toEqual([{order_item_id:id,rating_10:0}]);});
it("rejects duplicate, malformed, non-integer or out-of-range ratings",()=>{
  for(const value of ["11","-1","5.5","NaN","1e1"]) {const form=new FormData();form.set("dish_rating_"+id,value);expect(parseDishRatings(form)).toBeNull();}
  const duplicate=new FormData();duplicate.append("dish_rating_"+id,"5");duplicate.append("dish_rating_"+id,"6");expect(parseDishRatings(duplicate)).toBeNull();
  const forged=new FormData();forged.set("dish_rating_bad-id","7");expect(parseDishRatings(forged)).toBeNull();
});
