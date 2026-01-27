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
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        const filteredData = data.filter(w => w < 100_000_000).map(w => w / 1e6);
        if (filteredData.length === 0) return;

        const min = 0;
        const max = Math.max(...filteredData);
        const bins = 50;
        const counts = new Array(bins).fill(0);
        filteredData.forEach(val => {
            let b = Math.floor(((val - min) / (max - min)) * bins);
            if (b >= bins) b = bins - 1;
            counts[b]++;
        });

        const maxCount = Math.max(...counts);
        const padding = 40;
        const chartW = canvas.width - 2 * padding;
        const chartH = canvas.height - 2 * padding;

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
            ctx.fillRect(padding + i * barW, padding + chartH - h, barW - 1, h);
        });

        ctx.globalAlpha = 1.0; ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter'; ctx.textAlign = 'center';
        for (let i = 0; i <= 5; i++) {
            const val = (min + (max - min) * (i / 5)).toFixed(1);
            ctx.fillText(val + "M", padding + (i / 5) * chartW, canvas.height - 20);
        }
        ctx.fillText("Wealth Distribution (Million $)", canvas.width / 2, canvas.height - 5);
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
