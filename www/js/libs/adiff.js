function last(arr) {
    return arr[arr.length - 1];
}

function hasLength(elem) {
    return elem.length;
}

function any(ary, test) {
    for (let i = 0; i < ary.length; i++) {
        if (test(ary[i])) {
            return true;
        }
    }
    return false;
}

function score(arr) {
    return arr.reduce(function (sum, elem) {
        return sum + elem.length + elem[1] + 1;
    }, 0);
}

function best(a, b) {
    return score(a) <= score(b) ? a : b;
}

function _equal(a, b) {
    if (a && !b) return false;
    if (Array.isArray(a)) if (a.length !== b.length) return false;
    if (a && 'object' == typeof a) {
        for (let i in a) if (!_equal(a[i], b[i])) return false;
        for (let i in b) if (!_equal(a[i], b[i])) return false;
        return true;
    }
    return a === b;
}

function getArgs(args) {
    return args.length === 1 ? args[0] : Array.prototype.slice.call(args);
}

function oddElement(ary, cmp) {
    let c;

    function guess(a) {
        let odd = -1;
        c = 0;
        let skip = Array(ary.length).fill(0);
        let last = {};
        for (let i = a; i < ary.length; i++) {
            if (last[ary[i]] !== undefined) {
                skip[last[ary[i]]] = i - last[ary[i]];
            }
            last[ary[i]] = i;
        }
        let j = 0;
        while (a + j < ary.length) {
            if (j === odd) {
                return -1;
            }
            if (!cmp(ary[a], ary[a + j])) {
                odd = a + j;
                j += skip[a + j] || 1;
                c++;
            } else {
                j++;
            }
        }
        return c > 1 ? -1 : odd;
    }

    let g = guess(0);
    if (g !== -1) {
        return g;
    }
    guess(1);
    return c === 0 ? 0 : -1;
}

var exports = module.exports = function (deps, exports) {
    let equal = (deps && deps.equal) || _equal;
    exports = exports || {};

    exports.lss = function (a, b) {
        let l = Math.min(a.length, b.length);
        let s = [];

        for (let i = 0; i < l; i++) {
            if (a[i] === b[i]) {
                s.push(a[i]);
            } else break;
        }

        return s;
    }

    exports.lcs = function () {
        let args = getArgs(arguments);
        while (args.length > 2) {
            let pairs = [];
            for (let i = 0; i < args.length; i += 2) {
                let a = args[i];
                let b = i + 1 < args.length ? args[i + 1] : [];
                pairs.push(exports.lcs(a, b));
            }
            args = pairs;
        }
        let a = args[0], b = args[1];
        let m = a.length, n = b.length;
        let dp = Array.from(Array(m + 1), () => Array(n + 1).fill(0));

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (a[i - 1] === b[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        let seq = [];
        let i = m, j = n;
        while (i > 0 && j > 0) {
            if (a[i - 1] === b[j - 1]) {
                seq.unshift(a[i - 1]);
                i--;
                j--;
            } else if (dp[i - 1][j] > dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
        }

        return seq;
    }

    exports.chunk = function (q, build) {
        var q = q.map(function (elem) {
            return elem.slice();
        });
        let lcs = exports.lcs.apply(null, q);
        let all = [lcs].concat(q);

        function matchLcs(elem) {
            if ((elem.length && !lcs.length) || (!elem.length && lcs.length)) {
                return false;
            }
            return equal(last(elem), last(lcs)) || elem.length + lcs.length === 0;
        }

        while (any(q, hasLength)) {
            while (q.every(matchLcs) && q.every(hasLength)) {
                all.forEach(function (elem) {
                    elem.pop();
                });
            }
            let changes = false;
            let unstable = q.map(function (elem) {
                let change = [];
                while (!matchLcs(elem)) {
                    change.unshift(elem.pop());
                    changes = true;
                }
                return change;
            });
            if (changes) build(q[0].length, unstable);
        }
    };

    exports.optimisticDiff = function (a, b) {
        let M = Math.max(a.length, b.length);
        let m = Math.min(a.length, b.length);
        let patch = [];
        for (let i = 0; i < M; i++) {
            if (a[i] !== b[i]) {
                let cur = [i, 0], deletes = 0;
                while (a[i] !== b[i] && i < m) {
                    cur[1] = ++deletes;
                    cur.push(b[i++]);
                }
                if (i >= m) {
                    if (a.length > b.length) cur[1] += a.length - b.length; else if (a.length < b.length) cur.push(...b.slice(a.length));
                }
                patch.push(cur);
            }
        }
        return patch;
    };

    exports.diff = function (a, b) {
        let optimistic = exports.optimisticDiff(a, b);
        let changes = [];
        exports.chunk([a, b], function (index, unstable) {
            let del = unstable.shift().length;
            let insert = unstable.shift();
            changes.push([index, del, ...insert]);
        });
        return best(optimistic, changes);
    };

    exports.patch = function (a, changes, mutate) {
        if (!mutate) a = a.slice();
        changes.forEach(function (change) {
            a.splice(change[0], change[1], ...change.slice(2));
        });
        return a;
    };

    return exports;
}

exports(null, exports);