class SparseMap {
    constructor() {
        this.map = new Map();
    }

    getKey(...indices) {
        return indices.join(",");
    }

    get(...indices) {
        const key = this.getKey(...indices);
        return this.map.get(key) || 0;
    }

    set(value, ...indices) {
        const key = this.getKey(...indices);
        if (value === 0) {
            this.map.delete(key);
        } else {
            this.map.set(key, value);
        }
    }
}

function _equal(a, b) {
    return a === b;
}

var exports = module.exports = function (deps, exports) {
    let equal = (deps && deps.equal) || _equal;
    exports = exports || {};

    function* iterate(dimensions) {
        const indices = Array(dimensions.length).fill(0);
        while (true) {
            yield indices.slice();
            let i;
            for (i = dimensions.length - 1; i >= 0; i--) {
                indices[i]++;
                if (indices[i] < dimensions[i]) {
                    break;
                }
                indices[i] = 0;
            }
            if (i < 0) {
                break;
            }
        }
    }

    function subIndex(array, subarray, startIndex = 0) {
        for (let i = startIndex; i < array.length - subarray.length + 1; i++) {
            let found = true;
            for (let j = 0; j < subarray.length; j++) {
                if (!equal(array[i + j], subarray[j])) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return i;
            }
        }
        return -1;
    }

    function checkOverlap(a, b) {
        const d = a.length - 1;
        for (let i = 0; i < d; i++) {
            const start1 = a[i];
            const end1 = start1 + a[d];
            const start2 = b[i];
            const end2 = start2 + b[d];
            if (Math.max(start1, start2) < Math.min(end1, end2)) {
                return true;
            }
        }
        return false;
    }

    function clearOverlap(result, item) {
        let overlap = false;
        const length = item.length - 1;
        for (let j = 0; j < result.length; j++) {
            if (checkOverlap(item, result[j])) {
                let allDimensionsEqual = true;
                let oneDimensionEqual = false;
                let itemDimensionDistance = 0;
                let resultDimensionDistance = 0;
                for (let k = 0; k < length; k++) {
                    if (item[k] !== result[j][k]) {
                        allDimensionsEqual = false;
                    }
                    if (item[k] === result[j][k] && item[length] === result[j][length]) {
                        oneDimensionEqual = true;
                        for (let w = 0; w < item.length - 1; w++) {
                            const itemDistance = Math.abs(item[k] - item[w]);
                            const resultDistance = Math.abs(result[j][k] - result[j][w]);
                            itemDimensionDistance = Math.max(itemDimensionDistance, itemDistance);
                            resultDimensionDistance = Math.max(resultDimensionDistance, resultDistance);
                        }
                    }
                }
                if (allDimensionsEqual) {
                    if (item[length] > result[j][length]) {
                        result[j][length] = item[length];
                    }
                    overlap = true;
                    break;
                } else if (oneDimensionEqual) {
                    if (itemDimensionDistance < resultDimensionDistance) {
                        result[j] = item;
                    }
                    overlap = true;
                    break;
                } else {
                    overlap = true;
                    break;
                }
            }
        }
        if (!overlap) {
            result.push(item);
        }
    }

    function filterUnordered(array) {
        for (let i = 1; i < array.length - 1; i++) {
            let currentItem = array[i];
            let previousItem = array[i - 1];
            let nextItem = array[i + 1];

            let isInvalid = false;
            for (let j = 0; j < currentItem.length - 1; j++) {
                if (currentItem[j] <= previousItem[j] || currentItem[j] >= nextItem[j]) {
                    isInvalid = true;
                    break;
                }
            }

            if (isInvalid) {
                array.splice(i, 1);
                i--;
            }
        }
    }

    function* commonGen(a, b, mn, mx, dt) {
        const dp = new SparseMap();

        for (const [i, j] of iterate([a.length, b.length])) {
            if (equal(a[i], b[j])) {
                const dist = Math.abs(i - j);
                const prev = dp.get(i - 1, j - 1);
                const value = prev + 1;
                dp.set(value, i, j);

                if (mn <= value && value < mx && dist < dt) {
                    yield [i - value + 1, j - value + 1, value];
                }
            } else {
                dp.set(0, i, j);
            }
        }
    }

    function common(a, b, mn, mx, dt) {
        const result = [];
        for (let res of commonGen(a, b, mn, mx, dt)) clearOverlap(result, res);
        filterUnordered(result);
        return result;
    }

    function* common3Gen(a, b, c, mn, mx, dt) {
        const dp = new SparseMap();

        for (const [i, j, k] of iterate([a.length, b.length, c.length])) {
            if (equal(a[i], b[j]) && equal(b[j], c[k])) {
                const dist = Math.max(Math.abs(i - j), Math.abs(i - k), Math.abs(j - k));
                const prev = dp.get(i - 1, j - 1, k - 1);
                const value = prev + 1;
                dp.set(value, i, j, k);

                if (mn <= value && value < mx && dist < dt) {
                    yield [i - value + 1, j - value + 1, k - value + 1, value];
                }
            } else {
                dp.set(0, i, j, k);
            }
        }
    }

    function common3(a, b, c, mn, mx, dt) {
        const result = [];
        for (let res of common3Gen(a, b, c, mn, mx, dt)) clearOverlap(result, res);
        filterUnordered(result);
        return result;
    }

    function subm(a, b, common) {
        const outputA = [];
        const outputB = [];

        const binaryArray = [];

        let aIndex = 0;
        let bIndex = 0;

        common.forEach(([aStart, bStart, length]) => {
            // Handle differing subsequences before the common subsequences
            if (aStart - aIndex > 0 || bStart - bIndex > 0) {
                outputA.push(a.slice(aIndex, aStart));
                outputB.push(b.slice(bIndex, bStart));
                binaryArray.push(0);
            }

            // Handle common subsequences
            const commonSub = a.slice(aStart, aStart + length);
            outputA.push(commonSub);
            outputB.push(commonSub);
            binaryArray.push(1);

            aIndex = aStart + length;
            bIndex = bStart + length;
        });

        if (aIndex < a.length || bIndex < b.length) {
            outputA.push(a.slice(aIndex));
            outputB.push(b.slice(bIndex));
            binaryArray.push(0);
        }

        return [outputA, outputB, binaryArray];
    }

    function subm3(a, b, c, common) {
        const outputA = [];
        const outputB = [];
        const outputC = [];

        const binaryArray = [];

        let aIndex = 0;
        let bIndex = 0;
        let cIndex = 0;

        common.forEach(([aStart, bStart, cStart, length]) => {
            // Handle differing subsequences before the common subsequences
            if (aStart - aIndex > 0 || bStart - bIndex > 0 || cStart - cIndex > 0) {
                outputA.push(a.slice(aIndex, aStart));
                outputB.push(b.slice(bIndex, bStart));
                outputC.push(c.slice(cIndex, cStart));
                binaryArray.push(0);
            }

            // Handle common subsequences
            const commonSub = a.slice(aStart, aStart + length);
            outputA.push(commonSub);
            outputB.push(commonSub);
            outputC.push(commonSub);
            binaryArray.push(1);

            aIndex = aStart + length;
            bIndex = bStart + length;
            cIndex = cStart + length;
        });

        // Handle differing subsequences after the common subsequences
        if (aIndex < a.length || bIndex < b.length || cIndex < c.length) {
            outputA.push(a.slice(aIndex));
            outputB.push(b.slice(bIndex));
            outputC.push(c.slice(cIndex));
            binaryArray.push(0);
        }

        return [outputA, outputB, outputC, binaryArray];
    }

    exports.sm = function (a, b, mn = 1, mx = Number.MAX_SAFE_INTEGER, dt = Number.MAX_SAFE_INTEGER) {
        const result = common(a, b, mn, mx, dt);
        return subm(a, b, result);
    }

    exports.sm3 = function (a, b, c, mn = 1, mx = Number.MAX_SAFE_INTEGER, dt = Number.MAX_SAFE_INTEGER) {
        const result = common3(a, b, c, mn, mx, dt);
        return subm3(a, b, c, result);
    }

    exports.sm3f = function (a, b, c, mn = 1, mx = Number.MAX_SAFE_INTEGER, dt = Number.MAX_SAFE_INTEGER) {
        const smAB = exports.sm(a, b, mn, mx, dt);
        const result = [];

        let offsetA = 0;
        let offsetB = 0;
        let offsetC = 0;
        for (let i = 0; i < smAB[0].length; i++) {
            offsetA += smAB[0][i].length;
            offsetB += smAB[1][i].length;
            if (smAB[2][i] === 0) {
                continue;
            }

            const smDC = exports.sm(smAB[0][i], c, mn, mx, dt);

            let offsetD = 0;
            for (let j = 0; j < smDC[0].length; j++) {
                offsetD += smDC[1][j].length;
                if (smDC[2][j] === 1) {
                    const indexInA = subIndex(a, smAB[0][i], offsetA - smAB[0][i].length);
                    const indexInB = subIndex(b, smAB[1][i], offsetB - smAB[1][i].length);
                    const indexInC = subIndex(c, smDC[1][j], offsetC - smDC[1][j].length);

                    if (indexInA !== -1 && indexInB !== -1 && indexInC !== -1) {
                        const res = [indexInA, indexInB, indexInC, smAB[0][i].length];
                        clearOverlap(result, res);
                        offsetC += offsetD;
                    }
                }
            }
        }

        filterUnordered(result);
        return subm3(a, b, c, result);
    }

    return exports;
}

exports(null, exports);