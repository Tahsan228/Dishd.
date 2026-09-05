/**
 * The home-cooking permit differs by state, and naming the wrong one is not a
 * cosmetic error — it tells a cook to go and get a permit that does not exist
 * where they live.
 *
 * California runs MEHKO (Microenterprise Home Kitchen Operations), which is the
 * only programme that licenses selling *hot meals cooked to order* from a home.
 * New Jersey and New York have narrower cottage-food style permits that cover
 * shelf-stable goods, so a cook there is operating under a different rule with
 * different limits. The UI says which one applies rather than assuming MEHKO.
 */

export type Jurisdiction = {
  county: string;
  stateCode: string;
  /** The permit a cook here actually applies for. */
  permitName: string;
  /** Who issues it. */
  issuer: string;
  /** Anything a cook must know that the permit name alone does not convey. */
  caveat: string | null;
};

export const JURISDICTIONS: Jurisdiction[] = [
  {
    county: "Bergen",
    stateCode: "NJ",
    permitName: "Cottage Food Operator Permit",
    issuer: "New Jersey Department of Health",
    caveat:
      "New Jersey's permit covers shelf-stable foods. Hot meals cooked to order are not covered by it.",
  },
  {
    county: "Hudson",
    stateCode: "NJ",
    permitName: "Cottage Food Operator Permit",
    issuer: "New Jersey Department of Health",
    caveat:
      "New Jersey's permit covers shelf-stable foods. Hot meals cooked to order are not covered by it.",
  },
  {
    county: "Passaic",
    stateCode: "NJ",
    permitName: "Cottage Food Operator Permit",
    issuer: "New Jersey Department of Health",
    caveat:
      "New Jersey's permit covers shelf-stable foods. Hot meals cooked to order are not covered by it.",
  },
  {
    county: "New York",
    stateCode: "NY",
    permitName: "Home Processor exemption",
    issuer: "NYS Department of Agriculture and Markets",
    caveat:
      "The New York exemption covers non-potentially-hazardous foods only. Check your product list before listing.",
  },
  {
    county: "Kings",
    stateCode: "NY",
    permitName: "Home Processor exemption",
    issuer: "NYS Department of Agriculture and Markets",
    caveat:
      "The New York exemption covers non-potentially-hazardous foods only. Check your product list before listing.",
  },
  {
    county: "Queens",
    stateCode: "NY",
    permitName: "Home Processor exemption",
    issuer: "NYS Department of Agriculture and Markets",
    caveat:
      "The New York exemption covers non-potentially-hazardous foods only. Check your product list before listing.",
  },
  {
    county: "Alameda",
    stateCode: "CA",
    permitName: "MEHKO permit",
    issuer: "Alameda County Department of Environmental Health",
    caveat: null,
  },
];

export function findJurisdiction(county: string, stateCode: string): Jurisdiction | null {
  return (
    JURISDICTIONS.find(
      (j) =>
        j.county.toLowerCase() === county.trim().toLowerCase() &&
        j.stateCode.toLowerCase() === stateCode.trim().toLowerCase(),
    ) ?? null
  );
}

/** The permit label to show, falling back to neutral wording off-map. */
export function permitLabel(county: string, stateCode: string): string {
  return findJurisdiction(county, stateCode)?.permitName ?? "home kitchen permit";
}
