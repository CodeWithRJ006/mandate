import stringSimilarity from 'string-similarity';

const mandateSku = "iPhone 15 Pro";
const fulfillmentSku = "iPhone 13 Mini";

const score = stringSimilarity.compareTwoStrings(mandateSku, fulfillmentSku);
console.log(`[EVAL] "${mandateSku}" vs "${fulfillmentSku}"`);
console.log(`[SCORE] ${score.toFixed(3)}`);
