/**
 * Renderer Module
 */

window.Renderer = {
    renderHistogram(data, targetDivId) {
        const div = document.getElementById(targetDivId);
        if (!div) return;

        div.innerHTML = '<canvas id="hist-canvas" class="w-full h-[300px]"></canvas>';
        const canvas = document.getElementById('hist-canvas');
        const ctx = canvas.getContext('2d');

        // Get device pixel ratio for high DPI displays
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        // Set canvas size accounting for device pixel ratio
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        // Scale context to match device pixel ratio
        ctx.scale(dpr, dpr);

        // Use CSS size for layout
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';

        // Use 95th percentile to determine cutoff, but cap at 500M to avoid compressing the chart too much
        // If we just filter < 100M, we lose all the "moon bags" in crypto scenarios.
        // Let's take all data, sort it, find P95.
        const sorted = [...data].sort((a, b) => a - b);
        const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
        const visualMax = Math.min(Math.max(p95, 10_000_000), 500_000_000); // At least 10M, max 500M

        // Filter for visualization
        const filteredData = data.filter(w => w <= visualMax).map(w => w / 1e6);

        // Dynamic Binning (Sturges' formula or Sqrt rule)
        // For N=1000, sqrt is ~31. For N=50, sqrt is ~7.
        // We constrain between 10 and 50 to look good on UI.
        const dataCount = filteredData.length;
        if (dataCount === 0) return;

        const calculatedBins = Math.ceil(Math.sqrt(dataCount));
        const bins = Math.max(10, Math.min(50, calculatedBins));

        const min = 0;
        const max = Math.max(...filteredData);
        // Avoid division by zero if all values are 0
        const range = max - min || 1;

        const counts = new Array(bins).fill(0);
        filteredData.forEach(val => {
            let b = Math.floor(((val - min) / range) * bins);
            if (b >= bins) b = bins - 1;
            counts[b]++;
        });

        const maxCount = Math.max(...counts);
        const padding = 40;
        const chartW = rect.width - 2 * padding;
        const chartH = rect.height - 2 * padding;

        // Draw Grid
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            let y = padding + chartH - (i / 5) * chartH;
            ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(padding + chartW, y); ctx.stroke();
        }

        const barW = chartW / bins;
        ctx.fillStyle = '#f7931a';
        ctx.globalAlpha = 0.8;
        counts.forEach((c, i) => {
            const h = (c / maxCount) * chartH;
            ctx.fillRect(padding + i * barW, padding + chartH - h, Math.max(1, barW - 1), h);
        });

        ctx.globalAlpha = 1.0; ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter'; ctx.textAlign = 'center';

        // X-axis labels
        for (let i = 0; i <= 5; i++) {
            const val = (min + (max - min) * (i / 5)).toFixed(1);
            ctx.fillText(val + " Million", padding + (i / 5) * chartW, rect.height - 20);
        }
        ctx.fillText("Wealth Distribution (Million $)", rect.width / 2, rect.height - 5);

        // Y-axis labels
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
            const val = Math.round((maxCount * i) / 5);
            ctx.fillText(val.toString(), padding - 5, padding + chartH - (i / 5) * chartH + 4);
        }

        // Y-axis label (rotated)
        ctx.save();
        ctx.translate(15, rect.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText("Number of Simulations", 0, 0);
        ctx.restore();
    },

    updateSuccessBar(successRate, targetSuccess) {
        const successBar = document.getElementById("res-success-bar");
        if (!successBar) return;

        const successPct = successRate * 100;
        const targetPct = targetSuccess * 100;

        if (successPct < (targetPct - 0.1)) {
            successBar.classList.remove("bg-[#F7931A]", "bg-green-500");
            successBar.classList.add("bg-red-500");
            successBar.style.boxShadow = "0 0 15px rgba(239, 68, 68, 0.4)";
        } else {
            successBar.classList.remove("bg-red-500", "bg-[#F7931A]");
            successBar.classList.add("bg-green-500");
            successBar.style.boxShadow = "0 0 15px rgba(34, 197, 94, 0.4)";
        }
        successBar.style.width = successPct + "%";
    }
};
