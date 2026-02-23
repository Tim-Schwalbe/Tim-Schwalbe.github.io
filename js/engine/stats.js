/**
 * Stats Module - Implements random distributions and matrix operations.
 */

let _seededRandom = null;

window.Stats = {
    seed(seedValue) {
        if (seedValue === null || seedValue === undefined) {
            _seededRandom = null;
            return;
        }
        let state = seedValue >>> 0;
        _seededRandom = function () {
            state |= 0; state = state + 0x6D2B79F5 | 0;
            let t = Math.imul(state ^ state >>> 15, 1 | state);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    },

    _random() {
        return _seededRandom ? _seededRandom() : Math.random();
    },

    random() {
        return this._random();
    },

    randomNormal(mean = 0, std = 1) {
        let u = 0, v = 0;
        while (u === 0) u = this._random();
        while (v === 0) v = this._random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return mean + z * std;
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
