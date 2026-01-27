// REMOVED IMPORT: formatNumberWithDots, parseFormattedValue from ./formatters.js
// DEPENDENCIES: window.Formatters

window.Handlers = {
    handleCurrencyInput(e) {
        const el = e.target;
        let cursor = el.selectionStart;
        let oldLen = el.value.length;

        el.value = Formatters.formatNumberWithDots(el.value);

        let newLen = el.value.length;
        el.setSelectionRange(cursor + (newLen - oldLen), cursor + (newLen - oldLen));

        window.Handlers.updateTotalCapital();
    },

    updateTotalCapital() {
        const invested = Formatters.parseFormattedValue(document.getElementById('inp-initial').value);
        const buffer = Formatters.parseFormattedValue(document.getElementById('inp-buffer').value);
        const total = invested + buffer;
        const el = document.getElementById('disp-total-capital');
        if (el) el.innerText = "$ " + total.toLocaleString('de-DE');
    },

    updateFloorTooltips() {
        const target = Formatters.parseFormattedValue(document.getElementById('inp-target-annual').value);
        const cutPct = parseInt(document.getElementById('inp-floor-cut').value) || 0;
        const invested = Formatters.parseFormattedValue(document.getElementById('inp-initial').value);

        // 1. Min Limit Display
        const floorFactor = Math.max(0, 100 - cutPct) / 100;
        const minLimit = target * floorFactor;
        const elLimit = document.getElementById('disp-floor-limit');
        if (elLimit) elLimit.innerText = "$ " + minLimit.toLocaleString('de-DE');

        // 2. Tooltip Example
        // 2. Example Text
        const elTip = document.getElementById('tip-floor-example');
        if (elTip) {
            if (cutPct === 0) {
                elTip.classList.add('hidden');
            } else {
                elTip.classList.remove('hidden');
                // Rule: Floor activates when Variable Spend < Floor.
                const triggerPortfolio = invested * (1 - (cutPct / 100));

                elTip.innerHTML = `<b>Rule:</b> If Portfolio drops <b>-${cutPct}%</b> (to $${(triggerPortfolio / 1000).toFixed(0)}k), your spending is cut to <b>$${(minLimit / 1000).toFixed(1)}k</b>.`;
            }
        }
    },

    updateCeilingTooltips() {
        const target = Formatters.parseFormattedValue(document.getElementById('inp-target-annual').value);
        const invested = Formatters.parseFormattedValue(document.getElementById('inp-initial').value);

        const ceilingEarly = parseInt(document.getElementById('inp-ceiling-early').value) || 100;
        const ceilingLate = parseInt(document.getElementById('inp-ceiling-late').value) || 100;

        const elTip = document.getElementById('tip-ceiling-example');
        if (elTip) {
            if (ceilingEarly <= 100 && ceilingLate <= 100) {
                elTip.classList.add('hidden');
            } else {
                elTip.classList.remove('hidden');

                const getRuleText = (pct, prefix) => {
                    const pctVal = pct || 100;
                    if (pctVal <= 100) return `${prefix} Cap fixed at Target (<b>$${(target / 1000).toFixed(1)}k</b>).`;
                    const trigger = invested * (pctVal / 100);
                    const cap = target * (pctVal / 100);
                    return `${prefix} If Portfolio > <b>$${(trigger / 1000).toFixed(0)}k</b> (+${pctVal - 100}%), spend capped at <b>$${(cap / 1000).toFixed(1)}k</b>.`;
                };

                if (ceilingEarly === ceilingLate) {
                    const trigger = invested * (ceilingEarly / 100);
                    const cap = target * (ceilingEarly / 100);
                    elTip.innerHTML = `<b>Rule:</b> If Portfolio grows to <b>$${(trigger / 1000).toFixed(0)}k</b> (+${ceilingEarly - 100}%), spend capped at <b>$${(cap / 1000).toFixed(1)}k</b>.`;
                } else {
                    elTip.innerHTML = `
                        <div class="space-y-1">
                            <div>${getRuleText(ceilingEarly, "<b>Y1-10:</b>")}</div>
                            <div>${getRuleText(ceilingLate, "<b>Y11+:</b>")}</div>
                        </div>
                    `;
                }
            }
        }
    },

    updateAllocations(source) {
        const cryptoEl = document.getElementById('inp-alloc-crypto-pct');
        const stocksEl = document.getElementById('inp-alloc-stocks-pct');
        const bondsEl = document.getElementById('inp-alloc-bonds-pct');

        let cVal = parseInt(cryptoEl.value) || 0;
        let sVal = parseInt(stocksEl.value) || 0;
        let bVal = parseInt(bondsEl.value) || 0;

        const total = cVal + sVal + bVal;

        if (total !== 100) {
            const diff = total - 100;
            if (source === 'stocks') {
                if (diff > 0) {
                    let toTake = Math.min(bVal, diff);
                    bVal -= toTake;
                    cVal -= (diff - toTake);
                } else {
                    bVal -= diff;
                }
            } else if (source === 'crypto') {
                if (diff > 0) {
                    let toTake = Math.min(sVal, diff);
                    sVal -= toTake;
                    bVal -= (diff - toTake);
                } else {
                    sVal -= diff;
                }
            } else if (source === 'bonds') {
                if (diff > 0) {
                    let toTake = Math.min(sVal, diff);
                    sVal -= toTake;
                    cVal -= (diff - toTake);
                } else {
                    sVal -= diff;
                }
            }
        }

        cVal = Math.max(0, Math.min(100, cVal));
        sVal = Math.max(0, Math.min(100, sVal));
        bVal = 100 - cVal - sVal;

        cryptoEl.value = cVal;
        stocksEl.value = sVal;
        bondsEl.value = bVal;

        document.getElementById('lbl-crypto-pct').innerText = cVal + "%";
        document.getElementById('lbl-stocks-pct').innerText = sVal + "%";
        document.getElementById('lbl-bonds-pct').innerText = bVal + "%";

        const labelBonds = document.getElementById('lbl-bonds-pct');
        labelBonds.className = bVal < 20 ? "font-mono font-bold text-red-500" : "font-mono font-bold text-green-600";
    },

    toggleAdvanced() {
        const panel = document.getElementById('pnl-advanced');
        const icon = document.getElementById('icon-advanced');
        panel.classList.toggle('open');
        icon.style.transform = panel.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
    }
};

// Global aliases for inline onclick/oninput handlers
window.updateAllocations = window.Handlers.updateAllocations;
window.toggleAdvanced = window.Handlers.toggleAdvanced;
