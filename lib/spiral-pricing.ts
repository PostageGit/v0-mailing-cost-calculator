// ─── Spiral Binding Pricing Engine ───────────────────────
import type { SpiralInputs, SpiralPartInputs, SpiralPartResult, SpiralCalcResult } from "./spiral-types"


// ─── Constants ───────────────────────────────────────────
const BLEED_MARGIN = 0.25
const GUTTER_AMOUNT = 0.2
const EPSILON = 1e-9

export const EXTRA_COVER_PRICES = { plastic: 0.50, vinyl: 0.50 }

// Binding price per book by sheet-thickness tier x quantity bracket
const BINDING_TABLE: { min: number; max: number; q1_10: number; q11_26: number; q26_100: number; q101_1000: number }[] = [
  { min: 5, max: 80, q1_10: 6.50, q11_26: 4.00, q26_100: 3.65, q101_1000: 3.25 },
  { min: 81, max: 100, q1_10: 7.50, q11_26: 4.25, q26_100: 3.95, q101_1000: 3.50 },
  { min: 101, max: 150, q1_10: 8.50, q11_26: 4.50, q26_100: 4.25, q101_1000: 3.75 },
  { min: 151, max: 200, q1_10: 10.00, q11_26: 5.50, q26_100: 4.75, q101_1000: 4.75 },
  { min: 201, max: 290, q1_10: 15.00, q11_26: 12.00, q26_100: 10.00, q101_1000: 10.00 },
]

// 9-tier quantity brackets
const LEVEL_TIERS: { key: string; min: number; max: number; level: string }[] = [
  { key: "1-99", min: 1, max: 99, level: "Level 2" },
  { key: "100-249", min: 100, max: 249, level: "Level 3" },
  { key: "250-999", min: 250, max: 999, level: "Level 4" },
  { key: "1000-1999", min: 1000, max: 1999, level: "Level 5" },
  { key: "2000-3499", min: 2000, max: 3499, level: "Level 6" },
  { key: "3500-4999", min: 3500, max: 4999, level: "Level 7" },
  { key: "5000-99999", min: 5000, max: 99999, level: "Level 8" },
  { key: "100000-999999", min: 100000, max: 999999, level: "Level 9" },
  { key: "1000000+", min: 1000000, max: Infinity, level: "Level 10" },
]

// Sheet dimensions lookup
const SHEET_DIMS: Record<string, { w: number; h: number }> = {
  "8.5x11": { w: 8.5, h: 11 },
  "11x17": { w: 11, h: 17 },
  "12x18": { w: 12, h: 18 },
  "13x19": { w: 13, h: 19 },
}

// ─── PRICING_DATA ────────────────────────────────────────
// [paperName, type, sizeId, sides, ...9 price tiers]
const PRICING_DATA: string[][] = [
  ["100lb text gloss","paper","8.5x11","S/S","0.3","0.15","0.13125","0.117375","0.106875","0.090375","0.079875","0.073875","0.071345"],
  ["100lb text gloss","paper","8.5x11","D/S","0.3608","0.1804","0.15785","0.141163","0.128535","0.108691","0.096063","0.088847","0.08569"],
  ["100lb text gloss","paper","8.5x11","4/0","0.5262","0.3508","0.30695","0.2631","0.249945","0.211357","0.186801","0.172769","0.133304"],
  ["100lb text gloss","paper","8.5x11","4/4","0.8724","0.5816","0.5089","0.4362","0.41439","0.350414","0.309702","0.286438","0.221008"],
  ["100lb text gloss","paper","8.5x11","1/0","0.3054","0.2036","0.17815","0.1527","0.145065","0.122669","0.108417","0.100273","0.077444"],
  ["100lb text gloss","paper","8.5x11","1/1","0.4314","0.2876","0.25165","0.2157","0.204915","0.173279","0.153147","0.141643","0.109288"],
  ["100lb text gloss","paper","11x17","S/S","0.512","0.256","0.224","0.20032","0.1824","0.15424","0.13632","0.12608","0.121695"],
  ["100lb text gloss","paper","11x17","D/S","0.5728","0.2864","0.2506","0.224108","0.20406","0.172556","0.152508","0.141052","0.13604"],
  ["100lb text gloss","paper","11x17","4/0","0.6852","0.4568","0.3997","0.3426","0.32547","0.275222","0.243246","0.224974","0.173584"],
  ["100lb text gloss","paper","11x17","4/4","1.0314","0.6876","0.60165","0.5157","0.489915","0.414279","0.366147","0.338643","0.261288"],
  ["100lb text gloss","paper","11x17","1/0","0.4644","0.3096","0.2709","0.2322","0.22059","0.186534","0.164862","0.152478","0.117724"],
  ["100lb text gloss","paper","11x17","1/1","0.5904","0.3936","0.3444","0.2952","0.28044","0.237144","0.209592","0.193848","0.149568"],
  ["100lb text gloss","paper","12x18","S/S","0.512","0.256","0.224","0.20032","0.1824","0.15424","0.13632","0.12608","0.121695"],
  ["100lb text gloss","paper","12x18","D/S","0.5728","0.2864","0.2506","0.224108","0.20406","0.172556","0.152508","0.141052","0.13604"],
  ["100lb text gloss","paper","12x18","4/0","0.6852","0.4568","0.3997","0.3426","0.32547","0.275222","0.243246","0.224974","0.173584"],
  ["100lb text gloss","paper","12x18","4/4","1.0314","0.6876","0.60165","0.5157","0.489915","0.414279","0.366147","0.338643","0.261288"],
  ["100lb text gloss","paper","12x18","1/0","0.4644","0.3096","0.2709","0.2322","0.22059","0.186534","0.164862","0.152478","0.117724"],
  ["100lb text gloss","paper","12x18","1/1","0.5904","0.3936","0.3444","0.2952","0.28044","0.237144","0.209592","0.193848","0.149568"],
  ["10pt gloss","cover","8.5x11","4/0","0.6162","0.4108","0.34918","0.323505","0.302965","0.25675","0.22594","0.210535","0.156104"],
  ["10pt gloss","cover","8.5x11","4/4","0.9624","0.6416","0.54536","0.50526","0.47318","0.401","0.35288","0.32882","0.243808"],
  ["10pt gloss","cover","8.5x11","1/0","0.3954","0.2636","0.22406","0.207585","0.194405","0.16475","0.14498","0.135095","0.100244"],
  ["10pt gloss","cover","8.5x11","1/1","0.5214","0.3476","0.29546","0.273735","0.256355","0.21725","0.19118","0.178145","0.132088"],
  ["10pt gloss","cover","11x17","4/0","1.1388","0.7592","0.64532","0.59787","0.55991","0.4745","0.41756","0.38909","0.288496"],
  ["10pt gloss","cover","11x17","4/4","1.485","0.99","0.8415","0.779625","0.730125","0.61875","0.5445","0.507375","0.3762"],
  ["10pt gloss","cover","11x17","1/0","0.918","0.612","0.5202","0.48195","0.45135","0.3825","0.3366","0.31365","0.232636"],
  ["10pt gloss","cover","11x17","1/1","1.044","0.696","0.5916","0.5481","0.5133","0.435","0.3828","0.3567","0.26448"],
  ["10pt gloss","cover","12x18","4/0","1.1388","0.7592","0.64532","0.59787","0.55991","0.4745","0.41756","0.38909","0.288496"],
  ["10pt gloss","cover","12x18","4/4","1.485","0.99","0.8415","0.779625","0.730125","0.61875","0.5445","0.507375","0.3762"],
  ["10pt gloss","cover","12x18","1/0","0.918","0.612","0.5202","0.48195","0.45135","0.3825","0.3366","0.31365","0.232636"],
  ["10pt gloss","cover","12x18","1/1","1.044","0.696","0.5916","0.5481","0.5133","0.435","0.3828","0.3567","0.26448"],
  ["12pt Gloss","cover","8.5x11","4/0","0.7662","0.5108","0.43418","0.402255","0.376715","0.31925","0.28094","0.261785","0.19"],
  ["12pt Gloss","cover","8.5x11","4/4","1.1124","0.7416","0.63036","0.58401","0.54693","0.4635","0.40788","0.38007","0.28"],
  ["12pt Gloss","cover","8.5x11","1/0","0.5454","0.3636","0.30906","0.286335","0.268155","0.22725","0.19998","0.186345","0.14"],
  ["12pt Gloss","cover","8.5x11","1/1","0.6714","0.4476","0.38046","0.352485","0.330105","0.27975","0.24618","0.229395","0.17"],
  ["12pt Gloss","cover","11x17","4/0","1.2402","0.8268","0.70278","0.651105","0.609765","0.51675","0.45474","0.423735","0.314184"],
  ["12pt Gloss","cover","11x17","4/4","1.5864","1.0576","0.89896","0.83286","0.77998","0.661","0.58168","0.54202","0.401888"],
  ["12pt Gloss","cover","11x17","1/0","1.0194","0.6796","0.57766","0.535185","0.501205","0.42475","0.37378","0.348295","0.258324"],
  ["12pt Gloss","cover","11x17","1/1","1.1454","0.7636","0.64906","0.601335","0.563155","0.47725","0.41998","0.391345","0.290168"],
  ["12pt Gloss","cover","12x18","4/0","1.2402","0.8268","0.70278","0.651105","0.609765","0.51675","0.45474","0.423735","0.314184"],
  ["12pt Gloss","cover","12x18","4/4","1.5864","1.0576","0.89896","0.83286","0.77998","0.661","0.58168","0.54202","0.401888"],
  ["12pt Gloss","cover","12x18","1/0","1.0194","0.6796","0.57766","0.535185","0.501205","0.42475","0.37378","0.348295","0.258324"],
  ["12pt Gloss","cover","12x18","1/1","1.1454","0.7636","0.64906","0.601335","0.563155","0.47725","0.41998","0.391345","0.290168"],
  ["14pt gloss","cover","8.5x11","4/0","0.7962","0.5308","0.45118","0.418005","0.391465","0.33175","0.29194","0.272035","0.201704"],
  ["14pt gloss","cover","8.5x11","4/4","1.1424","0.7616","0.64736","0.59976","0.56168","0.476","0.41888","0.39032","0.289408"],
  ["14pt gloss","cover","8.5x11","1/0","0.5754","0.3836","0.32606","0.302085","0.282905","0.23975","0.21098","0.196595","0.145844"],
  ["14pt gloss","cover","8.5x11","1/1","0.7014","0.4676","0.39746","0.368235","0.344855","0.29225","0.25718","0.239645","0.177688"],
  ["14pt gloss","cover","11x17","4/0","1.4808","0.9872","0.83912","0.77742","0.72806","0.617","0.54296","0.50594","0.375136"],
  ["14pt gloss","cover","11x17","4/4","1.827","1.218","1.0353","0.959175","0.898275","0.76125","0.6699","0.624225","0.46284"],
  ["14pt gloss","cover","11x17","1/0","1.26","0.84","0.714","0.6615","0.6195","0.525","0.462","0.4305","0.319276"],
  ["14pt gloss","cover","11x17","1/1","1.386","0.924","0.7854","0.72765","0.68145","0.5775","0.5082","0.47355","0.35112"],
  ["14pt gloss","cover","12x18","4/0","1.4808","0.9872","0.83912","0.77742","0.72806","0.617","0.54296","0.50594","0.375136"],
  ["14pt gloss","cover","12x18","4/4","1.827","1.218","1.0353","0.959175","0.898275","0.76125","0.6699","0.624225","0.46284"],
  ["14pt gloss","cover","12x18","1/0","1.26","0.84","0.714","0.6615","0.6195","0.525","0.462","0.4305","0.319276"],
  ["14pt gloss","cover","12x18","1/1","1.386","0.924","0.7854","0.72765","0.68145","0.5775","0.5082","0.47355","0.35112"],
  ["14pt offset","cover","8.5x11","4/0","0.8322","0.5548","0.47158","0.436905","0.409165","0.34675","0.30514","0.284335","0.210824"],
  ["14pt offset","cover","8.5x11","4/4","1.1784","0.7856","0.66776","0.61866","0.57938","0.491","0.43208","0.40262","0.298528"],
  ["14pt offset","cover","8.5x11","1/0","0.6114","0.4076","0.34646","0.320985","0.300605","0.25475","0.22418","0.208895","0.154964"],
  ["14pt offset","cover","8.5x11","1/1","0.7374","0.4916","0.41786","0.387135","0.362555","0.30725","0.27038","0.251945","0.186808"],
  ["14pt offset","cover","11x17","4/0","1.3362","0.8908","0.75718","0.701505","0.656965","0.55675","0.48994","0.456535","0.338504"],
  ["14pt offset","cover","11x17","4/4","1.6824","1.1216","0.95336","0.88326","0.82718","0.701","0.61688","0.57482","0.426208"],
  ["14pt offset","cover","11x17","1/0","1.1154","0.7436","0.63206","0.585585","0.548405","0.46475","0.40898","0.381095","0.282644"],
  ["14pt offset","cover","11x17","1/1","1.2414","0.8276","0.70346","0.651735","0.610355","0.51725","0.45518","0.424145","0.314488"],
  ["14pt offset","cover","12x18","4/0","1.3362","0.8908","0.75718","0.701505","0.656965","0.55675","0.48994","0.456535","0.338504"],
  ["14pt offset","cover","12x18","4/4","1.6824","1.1216","0.95336","0.88326","0.82718","0.701","0.61688","0.57482","0.426208"],
  ["14pt offset","cover","12x18","1/0","1.1154","0.7436","0.63206","0.585585","0.548405","0.46475","0.40898","0.381095","0.282644"],
  ["14pt offset","cover","12x18","1/1","1.2414","0.8276","0.70346","0.651735","0.610355","0.51725","0.45518","0.424145","0.314488"],
  ["20lb offset - White","paper","8.5x11","S/S","0.1336","0.0668","0.05845","0.052271","0.047595","0.040247","0.035571","0.032899","0.031825"],
  ["20lb offset - White","paper","8.5x11","D/S","0.1944","0.0972","0.08505","0.076059","0.069255","0.058563","0.051759","0.047871","0.04617"],
  ["20lb offset - White","paper","8.5x11","4/0","0.4014","0.2676","0.23415","0.2007","0.190665","0.161229","0.142497","0.131793","0.101688"],
  ["20lb offset - White","paper","8.5x11","4/4","0.7476","0.4984","0.4361","0.3738","0.35511","0.300286","0.265398","0.245462","0.189392"],
  ["20lb offset - White","paper","8.5x11","1/0","0.1806","0.1204","0.10535","0.0903","0.085785","0.072541","0.064113","0.059297","0.045828"],
  ["20lb offset - White","paper","8.5x11","1/1","0.3066","0.2044","0.17885","0.1533","0.145635","0.123151","0.108843","0.100667","0.077672"],
  ["20lb offset - White","paper","11x17","S/S","0.1992","0.0996","0.08715","0.077937","0.070965","0.060009","0.053037","0.049053","0.047405"],
  ["20lb offset - White","paper","11x17","D/S","0.26","0.13","0.11375","0.101725","0.092625","0.078325","0.069225","0.064025","0.06175"],
  ["20lb offset - White","paper","11x17","4/0","0.4506","0.3004","0.26285","0.2253","0.214035","0.180991","0.159963","0.147947","0.114152"],
  ["20lb offset - White","paper","11x17","4/4","0.7968","0.5312","0.4648","0.3984","0.37848","0.320048","0.282864","0.261616","0.201856"],
  ["20lb offset - White","paper","11x17","1/0","0.2298","0.1532","0.13405","0.1149","0.109155","0.092303","0.081579","0.075451","0.058292"],
  ["20lb offset - White","paper","11x17","1/1","0.3558","0.2372","0.20755","0.1779","0.169005","0.142913","0.126309","0.116821","0.090136"],
  ["20lb offset - White","paper","12x18","S/S","0.2944","0.1472","0.1288","0.11584","0.10488","0.088688","0.078384","0.072496","0.070015"],
  ["20lb offset - White","paper","12x18","D/S","0.3552","0.1776","0.1554","0.138972","0.12654","0.107004","0.094572","0.087468","0.08436"],
  ["20lb offset - White","paper","12x18","4/0","0.522","0.348","0.3045","0.261","0.24795","0.20967","0.18531","0.17139","0.13224"],
  ["20lb offset - White","paper","12x18","4/4","0.8682","0.5788","0.50645","0.4341","0.412395","0.348727","0.308211","0.285059","0.219944"],
  ["20lb offset - White","paper","12x18","1/0","0.3012","0.2008","0.1757","0.1506","0.14307","0.120982","0.106926","0.098894","0.07638"],
  ["20lb offset - White","paper","12x18","1/1","0.4272","0.2848","0.2492","0.2136","0.20292","0.171592","0.151656","0.140264","0.108224"],
  ["60 Lb","paper","8.5x11","S/S","0.18","0.09","0.07875","0.070425","0.064125","0.054225","0.047925","0.044325","0.042845"],
  ["60 Lb","paper","8.5x11","D/S","0.2408","0.1204","0.10535","0.094213","0.085785","0.072541","0.064113","0.059297","0.05719"],
  ["60 Lb","paper","8.5x11","4/0","0.4362","0.2908","0.25445","0.2181","0.207195","0.175207","0.154851","0.143219","0.110504"],
  ["60 Lb","paper","8.5x11","4/4","0.7824","0.5216","0.4564","0.3912","0.37164","0.314264","0.277752","0.256888","0.198208"],
  ["60 Lb","paper","8.5x11","1/0","0.2154","0.1436","0.12565","0.1077","0.102315","0.086519","0.076467","0.070723","0.054644"],
  ["60 Lb","paper","8.5x11","1/1","0.3414","0.2276","0.19915","0.1707","0.162165","0.137129","0.121197","0.112093","0.086488"],
  ["60 Lb","paper","11x17","S/S","0.296","0.148","0.1295","0.11581","0.10545","0.08917","0.07881","0.07289","0.070395"],
  ["60 Lb","paper","11x17","D/S","0.3568","0.1784","0.1561","0.139598","0.12711","0.107486","0.094998","0.087862","0.08474"],
  ["60 Lb","paper","11x17","4/0","0.5232","0.3488","0.3052","0.2616","0.24852","0.210152","0.185736","0.171784","0.132544"],
  ["60 Lb","paper","11x17","4/4","0.8694","0.5796","0.50715","0.4347","0.412965","0.349209","0.308637","0.285453","0.220248"],
  ["60 Lb","paper","11x17","1/0","0.3024","0.2016","0.1764","0.1512","0.14364","0.121464","0.107352","0.099288","0.076684"],
  ["60 Lb","paper","11x17","1/1","0.4284","0.2856","0.2499","0.2142","0.20349","0.172074","0.152082","0.140658","0.108528"],
  ["60 Lb","paper","12x18","S/S","0.3368","0.1684","0.14735","0.131773","0.119985","0.101461","0.089673","0.082937","0.080085"],
  ["60 Lb","paper","12x18","D/S","0.3976","0.1988","0.17395","0.155561","0.141645","0.119777","0.105861","0.097909","0.09443"],
  ["60 Lb","paper","12x18","4/0","0.5538","0.3692","0.32305","0.2769","0.263055","0.222443","0.196599","0.181831","0.140296"],
  ["60 Lb","paper","12x18","4/4","0.9","0.6","0.525","0.45","0.4275","0.3615","0.3195","0.2955","0.228"],
  ["60 Lb","paper","12x18","1/0","0.333","0.222","0.19425","0.1665","0.158175","0.133755","0.118215","0.109335","0.084436"],
  ["60 Lb","paper","12x18","1/1","0.459","0.306","0.26775","0.2295","0.218025","0.184365","0.162945","0.150705","0.11628"],
  ["67 cover (white)","cover","8.5x11","4/0","0.5382","0.3588","0.30498","0.282555","0.264615","0.22425","0.19734","0.183885","0.136344"],
  ["67 cover (white)","cover","8.5x11","4/4","0.8844","0.5896","0.50116","0.46431","0.43483","0.3685","0.32428","0.30217","0.224048"],
  ["67 cover (white)","cover","8.5x11","1/0","0.3174","0.2116","0.17986","0.166635","0.156055","0.13225","0.11638","0.108445","0.080484"],
  ["67 cover (white)","cover","8.5x11","1/1","0.4434","0.2956","0.25126","0.232785","0.218005","0.18475","0.16258","0.151495","0.112328"],
  ["67 cover (white)","cover","11x17","4/0","0.7242","0.4828","0.41038","0.380205","0.356065","0.30175","0.26554","0.247435","0.183464"],
  ["67 cover (white)","cover","11x17","4/4","1.0704","0.7136","0.60656","0.56196","0.52628","0.446","0.39248","0.36572","0.271168"],
  ["67 cover (white)","cover","11x17","1/0","0.5034","0.3356","0.28526","0.264285","0.247505","0.20975","0.18458","0.171995","0.127604"],
  ["67 cover (white)","cover","11x17","1/1","0.6294","0.4196","0.35666","0.330435","0.309455","0.26225","0.23078","0.215045","0.159448"],
  ["80 cover gloss","cover","8.5x11","4/0","0.5682","0.3788","0.32198","0.298305","0.279365","0.23675","0.20834","0.194135","0.143944"],
  ["80 cover gloss","cover","8.5x11","4/4","0.9144","0.6096","0.51816","0.48006","0.44958","0.381","0.33528","0.31242","0.231648"],
  ["80 cover gloss","cover","8.5x11","1/0","0.3474","0.2316","0.19686","0.182385","0.170805","0.14475","0.12738","0.118695","0.088084"],
  ["80 cover gloss","cover","8.5x11","1/1","0.4734","0.3156","0.26826","0.248535","0.232755","0.19725","0.17358","0.161745","0.119928"],
  ["80 cover gloss","cover","11x17","4/0","1.0416","0.6944","0.59024","0.54684","0.51212","0.434","0.38192","0.35588","0.263872"],
  ["80 cover gloss","cover","11x17","4/4","1.3878","0.9252","0.78642","0.728595","0.682335","0.57825","0.50886","0.474165","0.351576"],
  ["80 cover gloss","cover","11x17","1/0","0.8208","0.5472","0.46512","0.43092","0.40356","0.342","0.30096","0.28044","0.208012"],
  ["80 cover gloss","cover","11x17","1/1","0.9468","0.6312","0.53652","0.49707","0.46551","0.3945","0.34716","0.32349","0.239856"],
  ["80 cover gloss","cover","12x18","4/0","1.0416","0.6944","0.59024","0.54684","0.51212","0.434","0.38192","0.35588","0.263872"],
  ["80 cover gloss","cover","12x18","4/4","1.3878","0.9252","0.78642","0.728595","0.682335","0.57825","0.50886","0.474165","0.351576"],
  ["80 cover gloss","cover","12x18","1/0","0.8208","0.5472","0.46512","0.43092","0.40356","0.342","0.30096","0.28044","0.208012"],
  ["80 cover gloss","cover","12x18","1/1","0.9468","0.6312","0.53652","0.49707","0.46551","0.3945","0.34716","0.32349","0.239856"],
  ["80lb text gloss","paper","8.5x11","S/S","0.22","0.11","0.09625","0.086075","0.078375","0.078325","0.069225","0.064025","0.061845"],
  ["80lb text gloss","paper","8.5x11","D/S","0.2808","0.1404","0.12285","0.109863","0.100035","0.096641","0.085413","0.078997","0.07619"],
  ["80lb text gloss","paper","8.5x11","4/0","0.4662","0.3108","0.27195","0.2331","0.221445","0.199307","0.176151","0.162919","0.125704"],
  ["80lb text gloss","paper","8.5x11","4/4","0.8124","0.5416","0.4739","0.4062","0.38589","0.338364","0.299052","0.276588","0.213408"],
  ["80lb text gloss","paper","8.5x11","1/0","0.2454","0.1636","0.14315","0.1227","0.116565","0.110619","0.097767","0.090423","0.069844"],
  ["80lb text gloss","paper","8.5x11","1/1","0.3714","0.2476","0.21665","0.1857","0.176415","0.161229","0.142497","0.131793","0.101688"],
  ["80lb text gloss","paper","11x17","S/S","0.452","0.226","0.19775","0.176845","0.161025","0.136165","0.120345","0.111305","0.107445"],
  ["80lb text gloss","paper","11x17","D/S","0.5128","0.2564","0.22435","0.200633","0.182685","0.154481","0.136533","0.126277","0.12179"],
  ["80lb text gloss","paper","11x17","4/0","0.6402","0.4268","0.37345","0.3201","0.304095","0.257147","0.227271","0.210199","0.162184"],
  ["80lb text gloss","paper","11x17","4/4","0.9864","0.6576","0.5754","0.4932","0.46854","0.396204","0.350172","0.323868","0.249888"],
  ["80lb text gloss","paper","11x17","1/0","0.4194","0.2796","0.24465","0.2097","0.199215","0.168459","0.148887","0.137703","0.106324"],
  ["80lb text gloss","paper","11x17","1/1","0.5454","0.3636","0.31815","0.2727","0.259065","0.219069","0.193617","0.179073","0.138168"],
  ["80lb text gloss","paper","12x18","S/S","0.452","0.226","0.19775","0.176845","0.161025","0.136165","0.120345","0.111305","0.107445"],
  ["80lb text gloss","paper","12x18","D/S","0.5128","0.2564","0.22435","0.200633","0.182685","0.154481","0.136533","0.126277","0.12179"],
  ["80lb text gloss","paper","12x18","4/0","0.6402","0.4268","0.37345","0.3201","0.304095","0.257147","0.227271","0.210199","0.162184"],
  ["80lb text gloss","paper","12x18","4/4","0.9864","0.6576","0.5754","0.4932","0.46854","0.396204","0.350172","0.323868","0.249888"],
  ["80lb text gloss","paper","12x18","1/0","0.4194","0.2796","0.24465","0.2097","0.199215","0.168459","0.148887","0.137703","0.106324"],
  ["80lb text gloss","paper","12x18","1/1","0.5454","0.3636","0.31815","0.2727","0.259065","0.219069","0.193617","0.179073","0.138168"],
]

// ─── Build Paper Catalog ─────────────────────────────────
type PricingTiers = Record<string, number>
interface CatalogEntry { type: string; pricing: PricingTiers }
type PaperCatalog = Record<string, Record<string, Record<string, CatalogEntry>>>

function buildCatalog(): PaperCatalog {
  const catalog: PaperCatalog = {}
  for (const row of PRICING_DATA) {
    const [paperName, type, sizeId, sides, ...prices] = row
    if (!catalog[paperName]) catalog[paperName] = {}
    if (!catalog[paperName][sizeId]) catalog[paperName][sizeId] = {}
    const tierKeys = LEVEL_TIERS.map((t) => t.key)
    const pricing: PricingTiers = {}
    tierKeys.forEach((k, i) => { pricing[k] = parseFloat(prices[i]) })
    catalog[paperName][sizeId][sides] = { type, pricing }
  }
  return catalog
}

export const PAPER_CATALOG = buildCatalog()

// ─── Public helpers ──────────────────────────────────────
export function getPaperNames(): string[] {
  return Object.keys(PAPER_CATALOG).sort((a, b) => {
    const aNum = parseInt(a, 10) || 0
    const bNum = parseInt(b, 10) || 0
    if (aNum !== bNum) return aNum - bNum
    return a.localeCompare(b)
  })
}

export function getAvailableSizes(paperName: string): string[] {
  return Object.keys(PAPER_CATALOG[paperName] || {})
}

export function getAvailableSides(paperName: string, sizeId?: string): string[] {
  if (!PAPER_CATALOG[paperName]) return []
  if (sizeId && sizeId !== "cheapest" && PAPER_CATALOG[paperName][sizeId]) {
    return Object.keys(PAPER_CATALOG[paperName][sizeId]).sort()
  }
  // Union of all sides across all sizes
  const sides = new Set<string>()
  for (const sz of Object.values(PAPER_CATALOG[paperName])) {
    for (const s of Object.keys(sz)) sides.add(s)
  }
  return Array.from(sides).sort()
}

export function getPaperType(paperName: string): string {
  const sizes = PAPER_CATALOG[paperName]
  if (!sizes) return "paper"
  const firstSize = Object.values(sizes)[0]
  if (!firstSize) return "paper"
  const firstEntry = Object.values(firstSize)[0]
  return firstEntry?.type || "paper"
}

// ─── Price lookup ────────────────────────────────────────
function roundByLevel(price: number, levelName: string): number {
  const num = parseInt(levelName.replace("Level ", ""), 10)
  if (num <= 6) return parseFloat(price.toFixed(2))
  if (num === 7) return parseFloat(price.toFixed(3))
  return parseFloat(price.toFixed(4))
}

export function getPriceInfo(paperName: string, sizeId: string, sides: string, quantity: number, forcedLevel?: string): { price: number; levelName: string; autoLevelName: string } {
  const entry = PAPER_CATALOG[paperName]?.[sizeId]?.[sides]
  if (!entry) return { price: 0, levelName: "N/A", autoLevelName: "N/A" }

  // Always compute the auto level from quantity
  let autoLevelName = ""
  for (const t of LEVEL_TIERS) {
    if (quantity >= t.min && quantity <= t.max) { autoLevelName = t.level; break }
  }
  if (!autoLevelName) autoLevelName = LEVEL_TIERS[LEVEL_TIERS.length - 1].level

  let levelName = ""
  let tierKey = ""

  if (forcedLevel) {
    const tier = LEVEL_TIERS.find((t) => t.level === forcedLevel)
    if (tier) { levelName = tier.level; tierKey = tier.key }
  }

  if (!tierKey) {
    for (const t of LEVEL_TIERS) {
      if (quantity >= t.min && quantity <= t.max) { levelName = t.level; tierKey = t.key; break }
    }
  }

  if (!tierKey) { tierKey = LEVEL_TIERS[LEVEL_TIERS.length - 1].key; levelName = LEVEL_TIERS[LEVEL_TIERS.length - 1].level }

  const raw = entry.pricing[tierKey] || 0
  return { price: roundByLevel(raw, levelName), levelName, autoLevelName }
}

// ─── Binding price lookup ────────────────────────────────
export function getBindingPrice(sheetsPerBook: number, bookQty: number): number {
  if (sheetsPerBook <= 0) return 0
  let tier = BINDING_TABLE.find((t) => sheetsPerBook >= t.min && sheetsPerBook <= t.max)
  if (!tier && sheetsPerBook < BINDING_TABLE[0].min) tier = BINDING_TABLE[0]
  if (!tier) return 0
  if (bookQty <= 10) return tier.q1_10
  if (bookQty <= 26) return tier.q11_26
  if (bookQty <= 100) return tier.q26_100
  return tier.q101_1000
}

// ─── Sheet layout (how many pages fit on one sheet) ──────
export function calculateLayout(sheetW: number, sheetH: number, pageW: number, pageH: number, hasBleed: boolean): { maxUps: number; isRotated: boolean } {
  const gutter = hasBleed ? GUTTER_AMOUNT : 0
  const bleedTotal = hasBleed ? BLEED_MARGIN * 2 : 0
  const pW = sheetW - bleedTotal
  const pH = sheetH - bleedTotal
  if (pW < 0 || pH < 0) return { maxUps: 0, isRotated: false }
  const fit = (area: number, item: number, g: number) => (item > area + EPSILON) ? 0 : 1 + Math.floor(((area - item) / (item + g)) + EPSILON)
  const portrait = fit(pW, pageW, gutter) * fit(pH, pageH, gutter)
  const landscape = fit(pW, pageH, gutter) * fit(pH, pageW, gutter)
  return { maxUps: Math.max(portrait, landscape), isRotated: landscape > portrait }
}

// ─── Calculate a single part ─────────────────────────────
export function calculatePart(
  partName: string,
  bookQty: number,
  pageWidth: number,
  pageHeight: number,
  sheetsPerPart: number,
  part: SpiralPartInputs,
  forcedLevel?: string,
): SpiralPartResult | { error: string } | null {
  const { paperName, sheetSize, sides, hasBleed } = part
  if (!paperName || !sheetSize || !sides) {
    if (partName === "inside") return { error: `Please fill out the '${partName} pages' section completely.` }
    return null
  }

  let finalW: number, finalH: number, maxUps: number, isRotated: boolean, finalSizeId: string

  if (sheetSize === "cheapest") {
    let best: { name: string; w: number; h: number; maxUps: number; isRotated: boolean; totalSheets: number } | null = null
    for (const sizeId of Object.keys(PAPER_CATALOG[paperName] || {})) {
      const dim = SHEET_DIMS[sizeId]
      if (!dim) continue
      // Only consider sizes where sides option is available
      if (!PAPER_CATALOG[paperName][sizeId][sides]) continue
      const layout = calculateLayout(dim.w, dim.h, pageWidth, pageHeight, hasBleed)
      if (layout.maxUps > 0) {
        const total = Math.ceil(bookQty / layout.maxUps) * sheetsPerPart
        if (!best || total < best.totalSheets || (total === best.totalSheets && dim.w * dim.h < best.w * best.h)) {
          best = { name: sizeId, w: dim.w, h: dim.h, maxUps: layout.maxUps, isRotated: layout.isRotated, totalSheets: total }
        }
      }
    }
    if (!best) return { error: `Page size too large for any available sheet for ${partName}.` }
    finalW = best.w; finalH = best.h; maxUps = best.maxUps; isRotated = best.isRotated; finalSizeId = best.name
  } else {
    const dim = SHEET_DIMS[sheetSize]
    if (!dim) return { error: `Unknown sheet size: ${sheetSize}` }
    finalW = dim.w; finalH = dim.h; finalSizeId = sheetSize
    const layout = calculateLayout(finalW, finalH, pageWidth, pageHeight, hasBleed)
    maxUps = layout.maxUps; isRotated = layout.isRotated
  }

  if (maxUps === 0) return { error: `Page size too large for selected sheet for ${partName}.` }

  const totalSheets = Math.ceil(bookQty / maxUps) * sheetsPerPart
  const info = getPriceInfo(paperName, finalSizeId, sides, totalSheets, forcedLevel)

  return {
    name: partName,
    cost: info.price * totalSheets,
    sheets: totalSheets,
    sheetSize: finalSizeId,
    paper: paperName,
    sides,
    bleed: hasBleed,
    isRotated,
    finalSheetWidth: finalW,
    finalSheetHeight: finalH,
    maxUps,
    pricePerSheet: info.price,
    levelName: info.levelName,
    autoLevelName: info.autoLevelName,
    // P/L cost breakdown - spiral uses pre-baked prices, so no separate breakdown
    paperCostPerSheet: 0,
    clickCostPerSheet: 0,
    totalPaperCost: 0,
    totalClickCost: 0,
  }
}

// ─── Main entry point ─────────��──────────────────────────
export function calculateSpiral(inputs: SpiralInputs): SpiralCalcResult | { error: string } {
  const { bookQty, pagesPerBook, pageWidth, pageHeight } = inputs
  if (!bookQty || !pagesPerBook || !pageWidth || !pageHeight) {
    return { error: "Please fill in all fields." }
  }

  const isDS = ["D/S", "4/4", "1/1"].includes(inputs.inside.sides)
  const sidesMultiplier = isDS ? 2 : 1
  const sheetsPerBook = Math.ceil(pagesPerBook / sidesMultiplier)

  if (sheetsPerBook > 290) {
    return { error: `Inside pages require ${sheetsPerBook} sheets -- too thick to bind (max 290).` }
  }

  // Determine level override: explicit custom > broker default > auto
  const userLevel = inputs.customLevel !== "auto" ? inputs.customLevel : inputs.isBroker ? "Level 10" : undefined

  const insideResult = calculatePart("inside", bookQty, pageWidth, pageHeight, sheetsPerBook, inputs.inside, userLevel)
  if (!insideResult || "error" in insideResult) return { error: (insideResult as { error: string })?.error || "Inside calculation failed." }

  const forcedLevel = insideResult.levelName

  let frontResult: SpiralPartResult | null = null
  if (inputs.useFrontCover) {
    const fr = calculatePart("front", bookQty, pageWidth, pageHeight, 1, inputs.front, forcedLevel)
    if (fr && "error" in fr) return { error: fr.error }
    frontResult = fr as SpiralPartResult | null
  }

  let backResult: SpiralPartResult | null = null
  if (inputs.useBackCover) {
    const br = calculatePart("back", bookQty, pageWidth, pageHeight, 1, inputs.back, forcedLevel)
    if (br && "error" in br) return { error: br.error }
    backResult = br as SpiralPartResult | null
  }

  let totalPrinting = insideResult.cost
  if (frontResult) totalPrinting += frontResult.cost
  if (backResult) totalPrinting += backResult.cost

  const bindingPerBook = getBindingPrice(sheetsPerBook, bookQty)
  const totalBinding = bindingPerBook * bookQty

  const extraPerBook = (inputs.clearPlastic ? EXTRA_COVER_PRICES.plastic : 0) + (inputs.blackVinyl ? EXTRA_COVER_PRICES.vinyl : 0)
  const totalExtras = extraPerBook * bookQty

  const grandTotal = Math.ceil(totalPrinting + totalBinding + totalExtras)

  return {
    insideResult,
    frontResult,
    backResult,
    sheetsPerBook,
    totalPrintingCost: totalPrinting,
    bindingPricePerBook: bindingPerBook,
    totalBindingPrice: totalBinding,
    extraCoversCostPerBook: extraPerBook,
    totalExtrasCost: totalExtras,
    grandTotal,
    pricePerBook: bookQty > 0 ? grandTotal / bookQty : 0,
    levelName: insideResult.levelName,
    autoLevelName: insideResult.autoLevelName,
    hasClearPlastic: inputs.clearPlastic,
    hasBlackVinyl: inputs.blackVinyl,
    bookQty,
    pagesPerBook,
    pageWidth,
    pageHeight,
  }
}
