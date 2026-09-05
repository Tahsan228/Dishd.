/** Versioned acknowledgments are recorded atomically with each order. */
export const ACK_VERSION = '2026-09-05.2';
export const ACKNOWLEDGMENTS = [
 {key:'quality',text:'I have read the food-quality standards. My order must be fresh, safely handled, accurately described and securely packaged. I can report any failure; accepting this does not waive those standards.'},
 {key:'allergens',text:'I have checked the ingredients and allergens and will ask the kitchen about my dietary needs before ordering. The kitchen must disclose allergens and cross-contact risks and get my agreement before substitutions.'},
 {key:'halal',text:'I have checked the kitchen?s sourcing evidence. The kitchen must follow Dishd?s halal standards, including no pork or alcohol ingredients and verified meat sourcing. Dishd is not a halal certifier; suspected violations can be reported for investigation.'}
] as const;
