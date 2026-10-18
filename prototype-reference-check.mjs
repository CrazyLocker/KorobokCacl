import fs from 'node:fs';

const html = fs.readFileSync('prototype/Расчет Заказа.html', 'utf8');
const state = JSON.parse(fs.readFileSync('Паллена 9 Тест.json', 'utf8'));

function extractFunction(src, name) {
    const start = src.indexOf(`function ${name}(`);
    if (start < 0) throw new Error(`Function not found: ${name}`);
    const braceStart = src.indexOf('{', start);
    let depth = 0;
    for (let i = braceStart; i < src.length; i++) {
        if (src[i] === '{') depth++;
        if (src[i] === '}') {
            depth--;
            if (depth === 0) return src.slice(start, i + 1);
        }
    }
    throw new Error(`Unbalanced function: ${name}`);
}

const names = [
    'calcPrintCost',
    'calcCostPriceDet',
    'calcPrintPerUnitNoVat',
    'calcBasePrice',
    'getBranchInfo',
    'getCoefficient',
    'getCorrection',
    'applyPriceList',
    'generatePrices',
];

const source = names.map((name) => extractFunction(html, name)).join('\n');
const PRINT_TABLES = {
    1: {
        name: '500×350', w: 500, h: 350,
        steps: [
            { minQty: 100, price: 5500 }, { minQty: 300, price: 7500 },
            { minQty: 500, price: 9000 }, { minQty: 1000, price: 10500 },
            { minQty: 1500, price: 12000 }, { minQty: 2000, price: 13500 },
            { minQty: 3000, price: 15000 },
        ],
        stepAfter3000: 1500,
    },
};

const factory = new Function(
    'PRINT_TABLES', 'details', 'extras', 'printSettings', 'workPrice',
    'marginValue', 'priceList', 'VAT_RATE',
    `${source}
     return { calcPrintCost, calcCostPriceDet, calcPrintPerUnitNoVat, calcBasePrice, getBranchInfo, generatePrices };`
);

const api = factory(
    PRINT_TABLES,
    state.details,
    state.extras,
    state.printSettings,
    state.workPrice,
    state.marginValue,
    state.priceList,
    0.11
);

let total = 0;
const detailRows = [];
for (const detail of state.details) {
    if (!detail.enabled || detail.countOnSheet === 0) continue;
    let cost = api.calcCostPriceDet(detail);
    const parts = [api.calcCostPriceDet(detail)];
    for (const extra of state.extras) {
        if (detail['has' + extra.name]) {
            cost += extra.cost;
            parts.push(extra.cost);
        }
    }
    if (detail.isPrinted && state.printSettings.enabled) {
        const print = api.calcPrintPerUnitNoVat(state.printSettings, detail);
        cost += print;
        parts.push(print);
        detailRows.push({ name: detail.name, pps: detail.partsPerSheetOnPrint, print });
    }
    total += cost;
}

const roundedCost = Math.round(total);
console.log(JSON.stringify({
    detailRows,
    total,
    roundedCost,
    basePrice: api.calcBasePrice(roundedCost),
    branch: api.getBranchInfo(roundedCost),
    basePriceWithVAT: Math.round(api.calcBasePrice(roundedCost) * 1.11),
    prices: api.generatePrices(total),
}, null, 2));
