"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const $ = (selector) => document.querySelector(selector);

    const expressionInput = $("#expression");
    const lowerBoundInput = $("#lower-bound");
    const upperBoundInput = $("#upper-bound");
    const limitPointInput = $("#limit-point");
    const limitDirectionInput = $("#limit-direction");

    const form = $("#calculator-form");
    const calculateButton = $("#calculate-button");
    const clearButton = $("#clear-button");
    const backspaceButton = $("#backspace-button");

    const boundsPanel = $("#integral-bounds");
    const limitPanel = $("#limit-options");
    const inputHelp = $("#input-help");
    const inputStatus = $("#input-status");

    const modeLabel = $("#mode-label");
    const problemFormula = $("#problem-formula");
    const answerDisplay = $("#answer");
    const answerNote = $("#answer-note");
    const answerCard = $("#answer-card");
    const stepsContainer = $("#solution-steps");

    const graphSection = $("#graph-section");
    const graphCanvas = $("#graph");
    const graphCaption = $("#graph-caption");

    const historyList = $("#history-list");
    const engineStatus = $("#engine-status");

    let currentMode = "indefinite";
    let history = [];

    const modeNames = {
        indefinite: "Tak Tentu",
        definite: "Tentu",
        limit: "Limit"
    };

    const modeInstructions = {
        indefinite: "Masukkan fungsi yang ingin diintegralkan.",
        definite: "Masukkan fungsi dan batas bawah serta batas atas.",
        limit: "Masukkan fungsi dan nilai yang didekati variabel x."
    };

    // =====================================================
    // PEMERIKSAAN LIBRARY
    // =====================================================

    const mathReady =
        typeof window.math !== "undefined" &&
        typeof window.math.evaluate === "function";

    const nerdamerReady =
        typeof window.nerdamer === "function";

    if (mathReady && nerdamerReady) {
        engineStatus.textContent = "Mesin matematika siap";
    } else if (mathReady) {
        engineStatus.textContent = "Mode numerik tersedia";
    } else {
        engineStatus.textContent = "Library belum tersedia";
    }

    // =====================================================
    // MODE PERHITUNGAN
    // =====================================================

    function setMode(mode) {
        currentMode = mode;

        document.querySelectorAll(".mode-button").forEach((button) => {
            button.classList.toggle(
                "active",
                button.dataset.mode === mode
            );
        });

        boundsPanel.classList.toggle("hidden", mode !== "definite");
        limitPanel.classList.toggle("hidden", mode !== "limit");

        modeLabel.textContent = modeNames[mode];
        inputHelp.textContent = modeInstructions[mode];

        if (mode === "indefinite") {
            expressionInput.placeholder = "Contoh: x^2 + 3*x";
        } else if (mode === "definite") {
            expressionInput.placeholder = "Contoh: 2*x + 3";
        } else {
            expressionInput.placeholder = "Contoh: √(2*x + 6)";
        }

        setStatus("Siap menerima ekspresi matematika.", "normal");
    }

    document.querySelectorAll(".mode-button").forEach((button) => {
        button.addEventListener("click", () => {
            setMode(button.dataset.mode);
        });
    });

    // =====================================================
    // PENYISIPAN SIMBOL
    // =====================================================

    document.querySelectorAll("[data-insert]").forEach((button) => {
        button.addEventListener("click", () => {
            insertAtCursor(button.dataset.insert);
        });
    });

    function insertAtCursor(text) {
        const input = expressionInput;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;

        input.setRangeText(text, start, end, "end");
        input.focus();

        setStatus("Simbol dimasukkan.", "normal");
    }

    clearButton.addEventListener("click", () => {
        expressionInput.value = "";
        expressionInput.focus();

        setStatus("Input telah dihapus.", "normal");
    });

    backspaceButton.addEventListener("click", () => {
        const input = expressionInput;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;

        if (start !== end) {
            input.setRangeText("", start, end, "end");
        } else if (start > 0) {
            input.setRangeText("", start - 1, start, "end");
        }

        input.focus();
    });

    // =====================================================
    // FORMAT DAN VALIDASI EKSPRESI
    // =====================================================

    function normalizeExpression(raw) {
        let expr = String(raw ?? "").trim();

        if (!expr) {
            throw new Error(
                "Masukkan fungsi matematika terlebih dahulu."
            );
        }

        expr = expr
            .replace(/−/g, "-")
            .replace(/×/g, "*")
            .replace(/÷/g, "/")
            .replace(/π/g, "pi")
            .replace(/√\s*\(/g, "sqrt(")
            .replace(/√\s*([a-zA-Z0-9.]+)/g, "sqrt($1)")
            .replace(/²/g, "^2")
            .replace(/³/g, "^3")
            .replace(/∞/g, "Infinity");

        expr = expr.replace(/\s+/g, "");

        if (!/^[0-9a-zA-Z_+\-*/^().,!%]+$/.test(expr)) {
            throw new Error(
                "Ekspresi mengandung simbol yang belum didukung."
            );
        }

        expr = expr
            .replace(/(\d)(x|pi|e)\b/gi, "$1*$2")
            .replace(/(\d)\(/g, "$1*(")
            .replace(/\)(\d|x|pi|e)\b/gi, ")*$1")
            .replace(/\)\(/g, ")*(")
            .replace(/\b(x|pi|e)\(/gi, "$1*(");

        return expr;
    }

    function validateExpression(expr) {
        if (!mathReady) {
            throw new Error(
                "Library matematika belum berhasil dimuat. Periksa koneksi internet lalu muat ulang halaman."
            );
        }

        let node;

        try {
            node = math.parse(expr);
        } catch {
            throw new Error(
                "Format fungsi tidak valid. Periksa tanda kurung dan operator."
            );
        }

        const allowedFunctions = new Set([
            "sqrt", "cbrt", "abs",
            "sin", "cos", "tan",
            "asin", "acos", "atan",
            "sinh", "cosh", "tanh",
            "log", "ln", "exp",
            "sign", "floor", "ceil", "round",
            "min", "max", "pow"
        ]);

        const allowedSymbols = new Set([
            "x", "pi", "e", "Infinity", "NaN",
            ...allowedFunctions
        ]);

        node.traverse((child) => {
            if (child.isFunctionNode) {
                const name = child.fn.name;

                if (!allowedFunctions.has(name)) {
                    throw new Error(
                        `Fungsi "${name}" belum didukung.`
                    );
                }
            }

            if (child.isSymbolNode) {
                const name = child.name;

                if (!allowedSymbols.has(name)) {
                    throw new Error(
                        `Simbol "${name}" belum didukung. Gunakan variabel x.`
                    );
                }
            }
        });

        return node;
    }

    function parseExpression(raw) {
        const expr = normalizeExpression(raw);
        validateExpression(expr);
        return expr;
    }

    // =====================================================
    // EVALUASI NUMERIK
    // =====================================================

    function evaluateAt(expr, x) {
        const value = math.evaluate(expr, { x });

        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new Error(
                "Fungsi tidak menghasilkan bilangan real berhingga pada titik tersebut."
            );
        }

        return value;
    }

    function formatNumber(value) {
        if (!Number.isFinite(value)) {
            return String(value);
        }

        if (Math.abs(value) < 1e-12) {
            value = 0;
        }

        return Number(value.toPrecision(12)).toString();
    }

    function formatMath(expression) {
        return String(expression)
            .replace(/\*/g, " \\cdot ")
            .replace(/\bpi\b/g, "\\pi ")
            .replace(/\bsqrt\(([^()]*)\)/g, "\\sqrt{$1}")
            .replace(/\^([0-9]+)/g, "^{$1}");
    }

    function setMath(element, latex) {
        element.textContent = `\\[${latex}\\]`;

        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([element]).catch(() => {
                element.textContent = latex;
            });
        }
    }

    function setStatus(message, type = "normal") {
        inputStatus.textContent = message;
        inputStatus.className = "input-status";

        if (type === "error") {
            inputStatus.classList.add("error");
        } else if (type === "success") {
            inputStatus.classList.add("success");
        }
    }

    function clearResult() {
        problemFormula.textContent = "Masukkan fungsi matematika.";
        answerDisplay.textContent = "—";
        answerNote.textContent =
            "Hasil akan ditampilkan setelah perhitungan.";

        stepsContainer.innerHTML =
            '<p class="empty-message">Masukkan fungsi, kemudian tekan Hitung Sekarang.</p>';

        graphSection.classList.add("hidden");
        answerCard.classList.remove("error-card");
    }

    function addStep(title, description, latex = null) {
        const wrapper = document.createElement("div");
        wrapper.className = "step-item";

        const number = document.createElement("div");
        number.className = "step-number";

        number.textContent =
            String(stepsContainer.querySelectorAll(".step-item").length + 1);

        const content = document.createElement("div");
        content.className = "step-content";

        const heading = document.createElement("h4");
        heading.textContent = title;

        const paragraph = document.createElement("p");
        paragraph.textContent = description;

        content.append(heading, paragraph);

        if (latex) {
            const formula = document.createElement("div");
            formula.className = "step-math";
            formula.textContent = `\\[${latex}\\]`;
            content.appendChild(formula);
        }

        wrapper.append(number, content);
        stepsContainer.appendChild(wrapper);
    }

    function startSteps() {
        stepsContainer.innerHTML = "";
    }

    function finishMath() {
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([
                problemFormula,
                answerDisplay,
                stepsContainer
            ]).catch(() => {});
        }
    }

    // =====================================================
    // INTEGRAL TAK TENTU
    // =====================================================

    function calculateIndefinite(expr) {
        if (!nerdamerReady) {
            throw new Error(
                "Mesin integral simbolik belum tersedia. Periksa koneksi internet."
            );
        }

        const result = nerdamer(`integrate(${expr},x)`).toString();

        if (
            !result ||
            result.includes("integrate(") ||
            result.includes("undefined")
        ) {
            throw new Error(
                "Integral simbolik untuk fungsi ini belum berhasil ditemukan."
            );
        }

        problemFormula.textContent =
            `\\[\\int ${formatMath(expr)}\\,dx\\]`;

        answerDisplay.textContent =
            `\\[${formatMath(result)}+C\\]`;

        answerNote.textContent = "Hasil integral tak tentu.";

        startSteps();

        addStep(
            "Identifikasi fungsi",
            "Fungsi yang akan diintegralkan terhadap variabel x.",
            `\\int ${formatMath(expr)}\\,dx`
        );

        addStep(
            "Mencari antiturunan",
            "Mesin simbolik mencari fungsi yang turunannya sama dengan fungsi masukan.",
            `F'(x)=f(x)`
        );

        addStep(
            "Hasil integral",
            "Konstanta integrasi C ditambahkan pada hasil integral tak tentu.",
            `\\boxed{${formatMath(result)}+C}`
        );

        setStatus("Integral berhasil diproses.", "success");
        drawGraph(expr);

        return result + " + C";
    }

    // =====================================================
    // INTEGRAL TENTU
    // =====================================================

    function calculateDefinite(expr) {
        const a = Number(lowerBoundInput.value);
        const b = Number(upperBoundInput.value);

        if (
            lowerBoundInput.value.trim() === "" ||
            upperBoundInput.value.trim() === "" ||
            !Number.isFinite(a) ||
            !Number.isFinite(b)
        ) {
            throw new Error(
                "Masukkan batas bawah dan batas atas yang valid."
            );
        }

        if (a > b) {
            throw new Error(
                "Batas bawah tidak boleh lebih besar daripada batas atas."
            );
        }

        problemFormula.textContent =
            `\\[\\int_{${a}}^{${b}} ${formatMath(expr)}\\,dx\\]`;

        startSteps();

        addStep(
            "Identifikasi integral tentu",
            `Fungsi diintegralkan pada interval dari ${a} sampai ${b}.`,
            `\\int_{${a}}^{${b}} f(x)\\,dx`
        );

        let symbolicResult = null;
        let numericResult = null;

        if (nerdamerReady) {
            try {
                symbolicResult =
                    nerdamer(`integrate(${expr},x)`).toString();

                if (
                    symbolicResult &&
                    !symbolicResult.includes("integrate(") &&
                    !symbolicResult.includes("undefined")
                ) {
                    const upperValue = Number(
                        nerdamer(symbolicResult).evaluate({ x: b }).text()
                    );

                    const lowerValue = Number(
                        nerdamer(symbolicResult).evaluate({ x: a }).text()
                    );

                    if (
                        Number.isFinite(upperValue) &&
                        Number.isFinite(lowerValue)
                    ) {
                        numericResult = upperValue - lowerValue;
                    }
                }
            } catch {
                symbolicResult = null;
                numericResult = null;
            }
        }

        let usedNumerical = false;

        if (!Number.isFinite(numericResult)) {
            numericResult = simpsonIntegral(expr, a, b);
            usedNumerical = true;
        }

        answerDisplay.textContent =
            `\\[${formatNumber(numericResult)}\\]`;

        answerNote.textContent = usedNumerical
            ? "Hasil pendekatan numerik metode Simpson."
            : "Hasil diperoleh dari antiturunan simbolik.";

        if (symbolicResult && !usedNumerical) {
            addStep(
                "Mencari antiturunan",
                "Fungsi antiturunan diperoleh menggunakan mesin simbolik.",
                `F(x)=${formatMath(symbolicResult)}`
            );

            addStep(
                "Menerapkan batas integral",
                "Gunakan teorema dasar kalkulus, yaitu F(b) dikurangi F(a).",
                `F(${b})-F(${a})`
            );
        } else {
            addStep(
                "Metode numerik",
                "Antiturunan simbolik tidak berhasil diperoleh. Nilai dihitung dengan metode Simpson dan mengasumsikan fungsi cukup teratur pada interval tersebut.",
                `\\int_{${a}}^{${b}} f(x)\\,dx\\approx ${formatNumber(numericResult)}`
            );
        }

        addStep(
            "Hasil akhir",
            "Nilai integral tentu pada batas yang dimasukkan.",
            `\\boxed{${formatNumber(numericResult)}}`
        );

        setStatus("Integral tentu berhasil dihitung.", "success");
        drawGraph(expr, a, b);

        return formatNumber(numericResult);
    }

    function simpsonIntegral(expr, a, b) {
        if (a === b) return 0;

        const n = 2000;
        const h = (b - a) / n;

        let sum = evaluateAt(expr, a) + evaluateAt(expr, b);

        for (let i = 1; i < n; i++) {
            const x = a + i * h;
            const value = evaluateAt(expr, x);

            sum += (i % 2 === 0 ? 2 : 4) * value;
        }

        return sum * h / 3;
    }

    // =====================================================
    // LIMIT FUNGSI
    // =====================================================

    function calculateLimit(expr) {
        const c = Number(limitPointInput.value);
        const direction = limitDirectionInput.value;

        if (
            limitPointInput.value.trim() === "" ||
            !Number.isFinite(c)
        ) {
            throw new Error(
                "Masukkan nilai pendekatan limit yang valid."
            );
        }

        problemFormula.textContent =
            `\\[\\lim_{x\\to ${c}}\\left(${formatMath(expr)}\\right)\\]`;

        startSteps();

        addStep(
            "Identifikasi limit",
            `Variabel x mendekati ${c}.`,
            `\\lim_{x\\to ${c}} f(x)`
        );

        let symbolicResult = null;

        if (nerdamerReady) {
            try {
                const limitExpression =
                    direction === "left"
                        ? `limit(${expr},x,${c},-1)`
                        : direction === "right"
                            ? `limit(${expr},x,${c},1)`
                            : `limit(${expr},x,${c})`;

                const result = nerdamer(limitExpression).toString();

                if (
                    result &&
                    !result.includes("limit(") &&
                    !result.includes("undefined")
                ) {
                    symbolicResult = result;
                }
            } catch {
                symbolicResult = null;
            }
        }

        let resultText;
        let numericValue = null;

        if (symbolicResult !== null) {
            resultText = symbolicResult;

            const parsed = Number(symbolicResult);

            if (Number.isFinite(parsed)) {
                numericValue = parsed;
            }

            addStep(
                "Analisis limit simbolik",
                "Mesin simbolik mencoba menentukan nilai limit berdasarkan ekspresi yang dimasukkan.",
                `\\lim_{x\\to ${c}} f(x)`
            );
        } else {
            const left = estimateLimit(expr, c, -1);
            const right = estimateLimit(expr, c, 1);

            if (direction === "left") {
                numericValue = left;
            } else if (direction === "right") {
                numericValue = right;
            } else if (
                Number.isFinite(left) &&
                Number.isFinite(right) &&
                Math.abs(left - right) <
                    1e-5 * Math.max(1, Math.abs(left), Math.abs(right))
            ) {
                numericValue = (left + right) / 2;
            }

            if (!Number.isFinite(numericValue)) {
                throw new Error(
                    "Limit tidak berhasil ditentukan secara numerik. Nilainya mungkin tidak ada, tak hingga, atau memerlukan metode simbolik."
                );
            }

            resultText = formatNumber(numericValue);

            addStep(
                "Pendekatan numerik",
                "Nilai fungsi diamati dari titik-titik yang semakin dekat dengan nilai pendekatan. Ini merupakan perkiraan numerik, bukan bukti simbolik.",
                `\\lim_{x\\to ${c}} f(x)\\approx ${resultText}`
            );
        }

        answerDisplay.textContent =
            `\\[${formatMath(resultText)}\\]`;

        answerNote.textContent =
            symbolicResult !== null
                ? "Hasil yang dikembalikan mesin simbolik; periksa kembali jika bentuknya tidak sederhana."
                : "Hasil pendekatan numerik.";

        addStep(
            "Hasil limit",
            `Pendekatan yang digunakan: ${
                direction === "both"
                    ? "dua arah"
                    : direction === "left"
                        ? "dari kiri"
                        : "dari kanan"
            }.`,
            `\\boxed{${formatMath(resultText)}}`
        );

        setStatus("Limit berhasil diproses.", "success");
        drawGraph(expr, c - 5, c + 5);

        return resultText;
    }

    function estimateLimit(expr, c, direction) {
        const distances = [
            1e-2, 1e-3, 1e-4, 1e-5, 1e-6, 1e-7
        ];

        const values = [];

        for (const distance of distances) {
            try {
                values.push(
                    evaluateAt(expr, c + direction * distance)
                );
            } catch {
                // Lewati titik yang tidak terdefinisi.
            }
        }

        if (values.length < 3) {
            return NaN;
        }

        const tail = values.slice(-3);

        const mean =
            tail.reduce((sum, value) => sum + value, 0) / tail.length;

        const consistent = tail.every(
            (value) =>
                Math.abs(value - mean) <
                1e-3 * Math.max(1, Math.abs(mean))
        );

        return consistent ? mean : NaN;
    }

    // =====================================================
    // GRAFIK FUNGSI
    // =====================================================

    function drawGraph(expr, minX = -10, maxX = 10) {
        if (!mathReady) {
            graphSection.classList.add("hidden");
            return;
        }

        const canvas = graphCanvas;
        const ctx = canvas.getContext("2d");

        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const margin = 48;

        const points = [];

        let minY = Infinity;
        let maxY = -Infinity;

        const samples = 250;

        for (let i = 0; i <= samples; i++) {
            const x = minX + (maxX - minX) * i / samples;

            try {
                const y = evaluateAt(expr, x);

                if (Number.isFinite(y) && Math.abs(y) < 1e7) {
                    points.push({ x, y });

                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                } else {
                    points.push(null);
                }
            } catch {
                points.push(null);
            }
        }

        if (points.filter(Boolean).length < 3) {
            graphSection.classList.add("hidden");
            return;
        }

        if (minY === maxY) {
            minY -= 1;
            maxY += 1;
        }

        const padding = (maxY - minY) * 0.12;

        minY -= padding;
        maxY += padding;

        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = "#fbfcff";
        ctx.fillRect(0, 0, width, height);

        const plotWidth = width - margin * 2;
        const plotHeight = height - margin * 2;

        const px = (x) =>
            margin + (x - minX) / (maxX - minX) * plotWidth;

        const py = (y) =>
            height - margin -
            (y - minY) / (maxY - minY) * plotHeight;

        ctx.strokeStyle = "#e8edf7";
        ctx.lineWidth = 1;

        for (let i = 0; i <= 10; i++) {
            const x = margin + plotWidth * i / 10;
            const y = margin + plotHeight * i / 10;

            ctx.beginPath();
            ctx.moveTo(x, margin);
            ctx.lineTo(x, height - margin);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(margin, y);
            ctx.lineTo(width - margin, y);
            ctx.stroke();
        }

        // Sumbu x dan y.
        ctx.strokeStyle = "#aebbd1";
        ctx.lineWidth = 1.5;

        if (minY <= 0 && maxY >= 0) {
            ctx.beginPath();
            ctx.moveTo(margin, py(0));
            ctx.lineTo(width - margin, py(0));
            ctx.stroke();
        }

        if (minX <= 0 && maxX >= 0) {
            ctx.beginPath();
            ctx.moveTo(px(0), margin);
            ctx.lineTo(px(0), height - margin);
            ctx.stroke();
        }

        // Kurva fungsi.
        ctx.strokeStyle = "#5145ed";
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();

        let started = false;

        points.forEach((point) => {
            if (!point) {
                started = false;
                return;
            }

            const x = px(point.x);
            const y = py(point.y);

            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                started = false;
                return;
            }

            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        ctx.fillStyle = "#71809a";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";

        ctx.fillText(
            `x: ${formatNumber(minX)}`,
            margin,
            height - 12
        );

        ctx.fillText(
            `x: ${formatNumber(maxX)}`,
            width - margin,
            height - 12
        );

        graphCaption.textContent =
            `Grafik fungsi pada rentang x dari ${formatNumber(minX)} sampai ${formatNumber(maxX)}. Grafik ini merupakan visualisasi numerik.`;

        graphSection.classList.remove("hidden");
    }

    // =====================================================
    // RIWAYAT
    // =====================================================

    function addHistory(mode, expression, result) {
        history.unshift({
            mode: modeNames[mode],
            expression,
            result: String(result),
            time: new Date().toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit"
            })
        });

        history = history.slice(0, 10);
        renderHistory();
    }

    function renderHistory() {
        historyList.innerHTML = "";

        if (history.length === 0) {
            const empty = document.createElement("p");
            empty.className = "empty-message";
            empty.textContent = "Belum ada riwayat perhitungan.";

            historyList.appendChild(empty);
            return;
        }

        history.forEach((item) => {
            const wrapper = document.createElement("div");
            wrapper.className = "history-item";

            const expression = document.createElement("div");
            expression.className = "history-expression";
            expression.textContent =
                `${item.mode}: ${item.expression}`;

            const result = document.createElement("div");
            result.className = "history-result";
            result.textContent = `Hasil: ${item.result}`;

            const time = document.createElement("div");
            time.className = "history-time";
            time.textContent = item.time;

            wrapper.append(expression, result, time);
            historyList.appendChild(wrapper);
        });
    }

    $("#clear-history").addEventListener("click", () => {
        history = [];
        renderHistory();

        setStatus("Riwayat perhitungan dihapus.", "normal");
    });

    // =====================================================
    // TOMBOL HITUNG
    // =====================================================

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        if (!mathReady) {
            setStatus(
                "Library matematika tidak tersedia. Pastikan internet aktif, kemudian muat ulang halaman.",
                "error"
            );
            return;
        }

        const rawExpression = expressionInput.value;

        calculateButton.disabled = true;
        calculateButton.textContent = "Menghitung...";

        try {
            const expr = parseExpression(rawExpression);

            clearResult();

            let result;

            if (currentMode === "indefinite") {
                result = calculateIndefinite(expr);
            } else if (currentMode === "definite") {
                result = calculateDefinite(expr);
            } else {
                result = calculateLimit(expr);
            }

            addHistory(currentMode, rawExpression, result);
            finishMath();
        } catch (error) {
            answerDisplay.textContent = "Tidak dapat dihitung";
            answerNote.textContent = error.message;

            problemFormula.textContent =
                rawExpression || "Ekspresi kosong";

            stepsContainer.innerHTML = "";

            addStep(
                "Perhitungan belum berhasil",
                error.message
            );

            graphSection.classList.add("hidden");
            setStatus(error.message, "error");
        } finally {
            calculateButton.disabled = false;
            calculateButton.innerHTML =
                "<span>▶</span> Hitung Sekarang";
        }
    });

    // =====================================================
    // MULAI APLIKASI
    // =====================================================

    setMode("indefinite");
    renderHistory();
    clearResult();
});