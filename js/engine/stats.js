/**
 * Stats Module - Implements random distributions and matrix operations.
 */

let _seededRandom = null;
// Box-Muller cache: each call produces two independent normals;
// we cache the second one so we halve the number of log/sqrt/cos calls.
let _boxMullerSpare = null;
let _boxMullerHasSpare = false;

window.Stats = {
    seed(seedValue) {
        if (seedValue === null || seedValue === undefined) {
            _seededRandom = null;
        } else {
            let state = seedValue >>> 0;
            _seededRandom = function () {
                state |= 0; state = state + 0x6D2B79F5 | 0;
                let t = Math.imul(state ^ state >>> 15, 1 | state);
                t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
        }
        // Reset cache on seed change to avoid cross-seed contamination
        _boxMullerHasSpare = false;
        _boxMullerSpare = null;
    },

    _random() {
        return _seededRandom ? _seededRandom() : Math.random();
    },

    random() {
        return this._random();
    },

    randomNormal(mean = 0, std = 1) {
        // Return cached second sample when available
        if (_boxMullerHasSpare) {
            _boxMullerHasSpare = false;
            return mean + _boxMullerSpare * std;
        }
        let u = 0, v = 0;
        while (u === 0) u = this._random();
        while (v === 0) v = this._random();
        const mag = Math.sqrt(-2.0 * Math.log(u));
        const angle = 2.0 * Math.PI * v;
        // Cache the sin component for the next call
        _boxMullerSpare = mag * Math.sin(angle);
        _boxMullerHasSpare = true;
        return mean + (mag * Math.cos(angle)) * std;
    },

    randomT(df) {
        // Student's t-distribution with df degrees of freedom
        // T = Z / sqrt(V/df) where Z ~ N(0,1) and V ~ Chi-Squared(df)
        // V = sum(Z_i^2) for i=1..df
        const z = this.randomNormal(0, 1);
        let v = 0;
        for (let i = 0; i < df; i++) {
            const zi = this.randomNormal(0, 1);
            v += zi * zi;
        }
        return z / Math.sqrt(v / df);
    },



    choleskyDecomposition(corrMatrix) {
        const n = corrMatrix.length;
        const L = Array(n).fill(0).map(() => Array(n).fill(0));
        for (let i = 0; i < n; i++) {
            for (let j = 0; j <= i; j++) {
                let sum = 0;
                for (let k = 0; k < j; k++) {
                    sum += L[i][k] * L[j][k];
                }
                if (i === j) {
                    L[i][j] = Math.sqrt(Math.max(0, corrMatrix[i][i] - sum));
                } else {
                    L[i][j] = (corrMatrix[i][j] - sum) / (L[j][j] + 1e-10);
                }
            }
        }
        return L;
    }
};
