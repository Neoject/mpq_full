import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import pdfMake from "pdfmake/build/pdfmake";
import "pdfmake/build/vfs_fonts";

const MCGILL_CATEGORIES = [
    { id: 1,  type: "sensory",      words: ["Мерцающая", "Дрожащая", "Пульсирующая", "Тупо-пульсирующая", "Бьющая", "Сильная пульсирующая"] },
    { id: 2,  type: "sensory",      words: ["Дергающая", "Вспыхивающая", "Стреляющая"] },
    { id: 3,  type: "sensory",      words: ["Колющая", "Сверлящая", "Пронзающая", "Режуще-колющая", "Пронзительная"] },
    { id: 4,  type: "sensory",      words: ["Острая", "Режущая", "Разрывающая"] },
    { id: 5,  type: "sensory",      words: ["Щемящая", "Давящая", "Грызущая", "Схваткообразная", "Сдавливающая"] },
    { id: 6,  type: "sensory",      words: ["Тянущая", "Тянущая (растягивающая)", "Выкручивающая"] },
    { id: 7,  type: "sensory",      words: ["Горячая", "Жгучая", "Обжигающая", "Пекущая"] },
    { id: 8,  type: "sensory",      words: ["Покалывающая", "Зудящая", "Щиплющая", "Жалящая"] },
    { id: 9,  type: "sensory",      words: ["Тупая", "Болезненная", "Ноющая", "Ломящая", "Тяжелая"] },
    { id: 10, type: "sensory",      words: ["Болезненная при прикосновении", "Натянутая", "Шероховатая", "Раскалывающая"] },
    { id: 11, type: "affective",    words: ["Изматывающая", "Истощающая"] },
    { id: 12, type: "affective",    words: ["Тошнотворная", "Удушающая"] },
    { id: 13, type: "affective",    words: ["Пугающая", "Ужасающая", "Леденящая"] },
    { id: 14, type: "affective",    words: ["Карательная", "Мучительная", "Жестокая", "Зверская", "Убивающая"] },
    { id: 15, type: "affective",    words: ["Отвратительная", "Ослепляющая"] },
    { id: 16, type: "evaluative",   words: ["Раздражающая", "Досаждающая", "Мучительная", "Интенсивная", "Невыносимая"] },
    { id: 17, type: "miscellaneous", words: ["Распространяющаяся", "Иррадиирующая", "Проникающая", "Пронзающая"] },
    { id: 18, type: "miscellaneous", words: ["Стягивающая", "Онемевшая", "Тянущая", "Сжимающая", "Разрывающая"] },
    { id: 19, type: "miscellaneous", words: ["Прохладная", "Холодная", "Леденящая"] },
    { id: 20, type: "miscellaneous", words: ["Ноющая", "Тошнотворная", "Агонизирующая", "Ужасная", "Пыточная"] },
];

const PPI_OPTIONS = [
    { value: 0, label: "Нет боли" },
    { value: 1, label: "Легкая" },
    { value: 2, label: "Некомфортная" },
    { value: 3, label: "Напрягающая" },
    { value: 4, label: "Ужасная" },
    { value: 5, label: "Невыносимая" },
];

const LEVEL_CONFIG = [
    { label: "Нет",     color: "#22d3a5", bg: "rgba(34,211,165,0.12)", border: "rgba(34,211,165,0.4)" },
    { label: "Легкая",     color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.4)" },
    { label: "Умеренная", color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.4)" },
    { label: "Сильная",   color: "#ef4444", bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.5)" },
];

const ACCORDION_SECTIONS = [
    { key: "about", title: "Об опроснике",
        body: <>Опросник McGill Pain Questionnaire (MPQ, Melzack, 1975) включает 20 групп дескрипторов боли: сенсорные (1–10), аффективные (11–15), оценочные (16) и прочие (17–20). В каждой группе выбирается одно слово, наиболее подходящее к ощущению; ранг слова равен его позиции в группе. Сумма рангов даёт индекс оценки боли (PRI). Интенсивность боли в настоящий момент (PPI) оценивается по шкале 0–5.</> },
];

function mcgillMaxPRI() {
    return MCGILL_CATEGORIES.reduce((s, c) => s + c.words.length, 0);
}

const BODY_VIEWBOX = { w: 120, h: 280 };
const BODY_IMAGES = {
    front: "/assets/front.png",
    back: "/assets/back.png",
};

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => {
            if (typeof window === "undefined") return;
            setIsMobile(window.innerWidth <= 768);
        };
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);
    return isMobile;
}

async function loadImageDataUrl(src) {
    if (typeof window === "undefined") return null;
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                resolve(null);
                return;
            }
            ctx.drawImage(img, 0, 0);
            try {
                const dataUrl = canvas.toDataURL("image/png");
                resolve(dataUrl);
            } catch (e) {
                resolve(null);
            }
        };
        img.onerror = () => reject(new Error("Failed to load image " + src));
        img.src = src;
    });
}

function drawBodyPathsOnContext(ctx, paths, scaleX, scaleY) {
    if (!Array.isArray(paths)) return;
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3 * scaleX;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    paths.forEach((d) => {
        if (typeof d !== "string" || !d.startsWith("M")) return;
        const tokens = d.trim().split(/\s+/);
        let i = 0;
        ctx.beginPath();
        while (i < tokens.length) {
            const cmd = tokens[i++];
            if (cmd !== "M" && cmd !== "L") break;
            const x = parseFloat(tokens[i++] ?? "0") * scaleX;
            const y = parseFloat(tokens[i++] ?? "0") * scaleY;
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            if (cmd === "M") {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    });
}

async function buildBodyMapImage(view, paths) {
    if (typeof window === "undefined") return null;
    const baseSrc = BODY_IMAGES[view];
    if (!baseSrc || !Array.isArray(paths) || paths.length === 0) return null;
    const img = new Image();
    img.crossOrigin = "anonymous";
    const loadPromise = new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error("Failed to load base body image"));
    });
    img.src = baseSrc;
    await loadPromise;

    const targetWidth = 300;
    const scale = targetWidth / img.width;
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / BODY_VIEWBOX.w;
    const scaleY = canvas.height / BODY_VIEWBOX.h;
    drawBodyPathsOnContext(ctx, paths, scaleX, scaleY);

    try {
        return canvas.toDataURL("image/png");
    } catch {
        return null;
    }
}

function BodySilhouette({ type }) {
    const { w, h } = BODY_VIEWBOX;
    const cx = w / 2;
    const headR = 18;
    const neckW = 14;
    const neckH = 12;
    const torsoTop = 50;
    const torsoBottom = 155;
    const torsoW = 44;
    const armY = 58;
    const armW = 12;
    const armLen = 38;
    const legTop = 155;
    const legW = 16;
    const legLen = 95;
    const legGap = 10;

    if (type === "front") {
        return (
            <g fill="none" stroke="var(--border)" strokeWidth="1.5">
                <ellipse cx={cx} cy={headR + 4} rx={headR} ry={headR + 2} />
                <path d={`M ${cx - neckW/2} ${headR*2 + 4} L ${cx + neckW/2} ${headR*2 + 4} L ${cx + torsoW/2} ${torsoTop} L ${cx + torsoW/2} ${torsoBottom} L ${cx + legGap/2} ${legTop} L ${cx + legGap/2} ${h} L ${cx - legGap/2} ${h} L ${cx - legGap/2} ${legTop} L ${cx - torsoW/2} ${torsoBottom} L ${cx - torsoW/2} ${torsoTop} Z`} />
                <path d={`M ${cx - torsoW/2 - 2} ${armY} L ${cx - torsoW/2 - armLen} ${armY + armLen*0.6} L ${cx - torsoW/2 - armLen - armW} ${armY + armLen*0.6} L ${cx - torsoW/2 - armLen} ${armY} L ${cx - torsoW/2} ${armY} Z`} />
                <path d={`M ${cx + torsoW/2 + 2} ${armY} L ${cx + torsoW/2 + armLen} ${armY + armLen*0.6} L ${cx + torsoW/2 + armLen + armW} ${armY + armLen*0.6} L ${cx + torsoW/2 + armLen} ${armY} L ${cx + torsoW/2} ${armY} Z`} />
                <path d={`M ${cx - legGap/2} ${legTop} L ${cx - legGap/2 - legW} ${h} L ${cx - legGap/2} ${h} L ${cx - legGap/2} ${legTop} Z`} />
                <path d={`M ${cx + legGap/2} ${legTop} L ${cx + legGap/2} ${h} L ${cx + legGap/2 + legW} ${h} L ${cx + legGap/2} ${legTop} Z`} />
            </g>
        );
    }
    // back
    return (
        <g fill="none" stroke="var(--border)" strokeWidth="1.5">
            <ellipse cx={cx} cy={headR + 4} rx={headR} ry={headR + 2} />
            <path d={`M ${cx - neckW/2} ${headR*2 + 4} L ${cx + neckW/2} ${headR*2 + 4} L ${cx + torsoW/2} ${torsoTop} L ${cx + torsoW/2} ${torsoBottom} L ${cx + legGap/2} ${legTop} L ${cx + legGap/2} ${h} L ${cx - legGap/2} ${h} L ${cx - legGap/2} ${legTop} L ${cx - torsoW/2} ${torsoBottom} L ${cx - torsoW/2} ${torsoTop} Z`} />
            <path d={`M ${cx - torsoW/2 - 2} ${armY} L ${cx - torsoW/2 - armLen} ${armY + armLen*0.6} L ${cx - torsoW/2 - armLen - armW} ${armY + armLen*0.6} L ${cx - torsoW/2 - armLen} ${armY} L ${cx - torsoW/2} ${armY} Z`} />
            <path d={`M ${cx + torsoW/2 + 2} ${armY} L ${cx + torsoW/2 + armLen} ${armY + armLen*0.6} L ${cx + torsoW/2 + armLen + armW} ${armY + armLen*0.6} L ${cx + torsoW/2 + armLen} ${armY} L ${cx + torsoW/2} ${armY} Z`} />
            <path d={`M ${cx - legGap/2} ${legTop} L ${cx - legGap/2 - legW} ${h} L ${cx - legGap/2} ${h} L ${cx - legGap/2} ${legTop} Z`} />
            <path d={`M ${cx + legGap/2} ${legTop} L ${cx + legGap/2} ${h} L ${cx + legGap/2 + legW} ${h} L ${cx + legGap/2} ${legTop} Z`} />
        </g>
    );
}

function BodyMapCanvas({ paths, onPathsChange, label, interactive = true, width = 160, height = 320, onRequestFullscreen }) {
    const svgRef = useRef(null);
    const [currentPath, setCurrentPath] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const view = label === "Вид спереди" ? "front" : "back";
    const imageSrc = BODY_IMAGES[view];

    const getCoords = (e) => {
        if (!svgRef.current) return null;
        const rect = svgRef.current.getBoundingClientRect();
        const { w, h } = BODY_VIEWBOX;
        const x = ((e.clientX ?? e.touches?.[0]?.clientX) - rect.left) / rect.width * w;
        const y = ((e.clientY ?? e.touches?.[0]?.clientY) - rect.top) / rect.height * h;
        return { x, y };
    };

    const startDraw = (e) => {
        if (!interactive) {
            if (onRequestFullscreen) onRequestFullscreen();
            return;
        }
        e.preventDefault();
        const p = getCoords(e);
        if (!p) return;
        setIsDrawing(true);
        setCurrentPath([p]);
    };

    const moveDraw = (e) => {
        e.preventDefault();
        if (!interactive || !isDrawing) return;
        const p = getCoords(e);
        if (!p) return;
        setCurrentPath(prev => [...prev, p]);
    };

    const endDraw = (e) => {
        e.preventDefault();
        if (!interactive || !isDrawing) return;
        setIsDrawing(false);
        if (currentPath.length >= 2) {
            const d = "M " + currentPath.map(({ x, y }) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ");
            onPathsChange([...paths, d]);
        }
        setCurrentPath([]);
    };

    const clearPaths = () => onPathsChange([]);

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{label}</div>
            <div
                style={{
                    position: "relative",
                    cursor: interactive ? "crosshair" : "pointer",
                    touchAction: "none",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "var(--surface2)"
                }}
                onPointerDown={startDraw}
                onPointerMove={interactive ? moveDraw : undefined}
                onPointerUp={interactive ? endDraw : undefined}
                onPointerLeave={interactive ? endDraw : undefined}
                onTouchStart={startDraw}
                onTouchMove={interactive ? moveDraw : undefined}
                onTouchEnd={interactive ? endDraw : undefined}
            >
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${BODY_VIEWBOX.w} ${BODY_VIEWBOX.h}`}
                    width={width}
                    height={height}
                    style={{ display: "block", touchAction: "none" }}
                >
                    <image
                        href={imageSrc}
                        x="0"
                        y="0"
                        width={BODY_VIEWBOX.w}
                        height={BODY_VIEWBOX.h}
                        preserveAspectRatio="xMidYMid meet"
                    />
                    <g fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity={0.85}>
                        {paths.map((d, i) => <path key={i} d={d} />)}
                        {currentPath.length >= 2 && (
                            <path d={"M " + currentPath.map(({ x, y }) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")} />
                        )}
                    </g>
                </svg>
            </div>
            {interactive && (
                <button type="button" className="lvl-btn" onClick={clearPaths} style={{ fontSize: 12 }}>
                    Очистить области
                </button>
            )}
        </div>
    );
}

function BodyMap({ value, onChange }) {
    const front = value?.front ?? [];
    const back = value?.back ?? [];
    const isMobile = useIsMobile();
    const [fullscreenView, setFullscreenView] = useState(null); // 'front' | 'back' | null

    return (
        <>
            <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
                <BodyMapCanvas
                    paths={front}
                    onPathsChange={(p) => onChange({ ...value, front: p })}
                    label="Вид спереди"
                    interactive={!isMobile}
                    onRequestFullscreen={isMobile ? () => setFullscreenView("front") : undefined}
                />
                <BodyMapCanvas
                    paths={back}
                    onPathsChange={(p) => onChange({ ...value, back: p })}
                    label="Вид сзади"
                    interactive={!isMobile}
                    onRequestFullscreen={isMobile ? () => setFullscreenView("back") : undefined}
                />
            </div>

            {isMobile && fullscreenView && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.75)",
                        zIndex: 50,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 16
                    }}
                    onClick={() => setFullscreenView(null)}
                >
                    <div
                        style={{ alignSelf: "flex-end", marginBottom: 8 }}
                        onClick={(e) => { e.stopPropagation(); setFullscreenView(null); }}
                    >
                        <button className="lvl-btn" style={{ fontSize: 12 }}>Закрыть</button>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                        {fullscreenView === "front" ? (
                            <BodyMapCanvas
                                paths={front}
                                onPathsChange={(p) => onChange({ ...value, front: p })}
                                label="Вид спереди"
                                interactive={true}
                                width={260}
                                height={520}
                            />
                        ) : (
                            <BodyMapCanvas
                                paths={back}
                                onPathsChange={(p) => onChange({ ...value, back: p })}
                                label="Вид сзади"
                                interactive={true}
                                width={260}
                                height={520}
                            />
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

function McGillCategoryRow({ category, value, onChange }) {
    // value: 0 = none, 1..n = 1-based rank (selected word index)
    const selectedWord = value > 0 ? category.words[value - 1] : null;
    return (
        <div className="descriptor-row mcgill-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <span className="desc-num">{category.id}</span>
            <div style={{ flex: 1, minWidth: 200 }}>
                <div className="desc-buttons" style={{ flexWrap: "wrap", gap: 6 }}>
                    <button
                        key={0}
                        className="lvl-btn"
                        onClick={() => onChange(0)}
                        style={value === 0 ? { background: "var(--surface2)", borderColor: "var(--border)", fontWeight: 500 } : {}}
                    >
                        — не выбирать
                    </button>
                    {category.words.map((word, i) => {
                        const rank = i + 1;
                        const isSelected = value === rank;
                        return (
                            <button
                                key={rank}
                                className="lvl-btn"
                                onClick={() => onChange(rank)}
                                style={isSelected ? { background: "rgba(59,130,246,0.15)", borderColor: "rgba(59,130,246,0.5)", color: "#3b82f6", fontWeight: 500 } : {}}
                            >
                                {word}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function Admin() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const [authChecking, setAuthChecking] = useState(true);
    const [isAuthed, setIsAuthed] = useState(false);
    const [authError, setAuthError] = useState(null);
    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [loginLoading, setLoginLoading] = useState(false);

    const [listLoading, setListLoading] = useState(false);
    const [listError, setListError] = useState(null);
    const [assessments, setAssessments] = useState([]);

    const [selected, setSelected] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const exportSelectedToPDF = async () => {
        if (!selected || selected.error) return;

        const fullName = selected.full_name || "Без имени";
        const createdAt = selected.created_at || "";
        const priTotal = selected.total_score ?? selected.pri ?? 0;
        const priSensory = selected.sensory_score ?? selected.pri_sensory ?? 0;
        const priAffective = selected.affective_score ?? selected.pri_affective ?? 0;
        const priEvaluative = selected.evaluative_score ?? selected.pri_evaluative ?? 0;
        const priMisc = selected.misc_score ?? selected.pri_misc ?? 0;
        const ppiVal = selected.ppi_score ?? selected.ppi ?? 0;
        const vasVal = selected.vas_score ?? null;
        const typeLabel = (t) => ({ sensory: "Сенсорная", affective: "Аффективная", evaluative: "Оценочная", miscellaneous: "Прочие" })[t] || t;
        const tableBody = [
            ["№", "Тип", "Характер боли", "Ранг"],
            ...MCGILL_CATEGORIES.map((c) => {
                const rank = (selected.pain_descriptors && selected.pain_descriptors[c.id]) || 0;
                const word = rank > 0 ? c.words[rank - 1] : "—";
                return [c.id.toString(), typeLabel(c.type), word, rank.toString()];
            }),
        ];

        const content = [
            { text: "McGill Pain Questionnaire (MPQ)", style: "header" },
            {
                text: `Пациент: ${fullName}`,
                style: "subheader",
                margin: [0, 2, 0, 0],
            },
            {
                text: `Дата заполнения: ${createdAt}`,
                style: "subheader",
                margin: [0, 0, 0, 2],
            },
            { text: "Итоговые показатели (MPQ)", style: "sectionTitle" },
            {
                ul: [
                    `PRI (индекс боли): ${priTotal}`,
                    `Сенсорная (1–10): ${priSensory}`,
                    `Аффективная (11–15): ${priAffective}`,
                    `Оценочная (16): ${priEvaluative || "—"}`,
                    `Прочие (17–20): ${priMisc || "—"}`,
                    `PPI (интенсивность): ${ppiVal} / 5`,
                    (vasVal != null ? `VAS: ${vasVal} / 10` : null),
                ].filter(Boolean),
                margin: [0, 0, 0, 4],
            },
        ];

        // Рисунок областей боли (если есть)
        let frontImg = null;
        let backImg = null;
        if (selected.body_map) {
            if (Array.isArray(selected.body_map.front) && selected.body_map.front.length > 0) {
                frontImg = await buildBodyMapImage("front", selected.body_map.front);
            }
            if (Array.isArray(selected.body_map.back) && selected.body_map.back.length > 0) {
                backImg = await buildBodyMapImage("back", selected.body_map.back);
            }
        }
        if (frontImg || backImg) {
            content.push(
                { text: "Области боли", style: "sectionTitle", margin: [0, 4, 0, 4] },
                {
                    columns: [
                        frontImg ? { image: frontImg, width: 90, margin: [0, 4, 8, 8] } : null,
                        backImg ? { image: backImg, width: 90, margin: [8, 4, 0, 8] } : null,
                    ].filter(Boolean),
                }
            );
        }

        content.push(
            { text: "Детальные результаты", style: "sectionTitle", margin: [4, 6, 0, 4] },
            {
                table: {
                    headerRows: 1,
                    widths: ["auto", "auto", "*", "auto"],
                    body: tableBody,
                },
                layout: "lightHorizontalLines",
                fontSize: 9,
            }
        );

        const docDefinition = {
            content,
            defaultStyle: {
                font: "Roboto",
                fontSize: 10,
            },
            styles: {
                header: {
                    fontSize: 14,
                    bold: true,
                    margin: [0, 0, 0, 4],
                },
                subheader: {
                    fontSize: 10,
                    color: "#555555",
                },
                sectionTitle: {
                    fontSize: 12,
                    bold: true,
                    margin: [0, 2, 0, 2],
                },
            },
        };

        const safeName = fullName.replace(/\s+/g, "_");
        pdfMake.createPdf(docDefinition).download(`MPQ_${safeName || "Patient"}_${selected.id}.pdf`);
    };

    const deleteSelected = async () => {
        if (!selected || selected.error || deleteLoading) return;
        if (!window.confirm("Удалить этот результат?")) return;

        setDeleteLoading(true);
        try {
            const res = await fetch("/backend/delete_assessment.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                credentials: "include",
                body: JSON.stringify({ id: selected.id }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Не удалось удалить результат");
            }
            setSelected(null);
            await loadAssessments();
        } catch (e) {
            alert(e.message);
        } finally {
            setDeleteLoading(false);
        }
    };

    const initDb = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch("/backend/admin_init.php", {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                },
            });
            const data = await res.json();
            setResult({ ok: res.ok && data.success, data });
        } catch (e) {
            setResult({ ok: false, data: { error: e.message } });
        } finally {
            setLoading(false);
        }
    };

    const loadAssessments = async () => {
        setListLoading(true);
        setListError(null);
        try {
            const res = await fetch("/backend/list_assessments.php", {
                headers: { Accept: "application/json" },
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Не удалось загрузить ответы");
            }
            setAssessments(data.items || []);
        } catch (e) {
            setListError(e.message);
        } finally {
            setListLoading(false);
        }
    };

    const loadDetail = async (id) => {
        setDetailLoading(true);
        setSelected(null);
        try {
            const res = await fetch(`/backend/get_assessment.php?id=${id}`, {
                headers: { Accept: "application/json" },
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Не удалось загрузить детали");
            }
            setSelected(data.assessment);
        } catch (e) {
            setSelected({ error: e.message });
        } finally {
            setDetailLoading(false);
        }
    };

    const checkAuth = async () => {
        setAuthChecking(true);
        setAuthError(null);
        try {
            const res = await fetch("/backend/check_auth.php", {
                headers: { Accept: "application/json" },
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Ошибка проверки авторизации");
            }
            setIsAuthed(!!data.authenticated);
        } catch (e) {
            setAuthError(e.message);
            setIsAuthed(false);
        } finally {
            setAuthChecking(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginLoading(true);
        setAuthError(null);
        try {
            const res = await fetch("/backend/login.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                credentials: "include",
                body: JSON.stringify({ login, password }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Неверный логин или пароль");
            }
            setIsAuthed(true);
            setPassword("");
        } catch (e) {
            setAuthError(e.message);
            setIsAuthed(false);
        } finally {
            setLoginLoading(false);
        }
    };

    useEffect(() => {
        checkAuth().then(() => {
            // если авторизован — грузим ответы
            if (isAuthed) {
                loadAssessments();
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isAuthed) {
            loadAssessments();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthed]);

    if (!isAuthed) {
        return (
            <div className="app">
                <div className="header">
                    <div className="header-eyebrow">NeurologyToolKit · Админка</div>
                    <h1>Авторизация администратора</h1>
                </div>
                <div className="content">
                    <div className="section" style={{ maxWidth: 420, margin: "0 auto" }}>
                        <div className="section-title">Вход</div>
                        <form onSubmit={handleLogin} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                            <input
                                type="text"
                                placeholder="Логин"
                                value={login}
                                onChange={(e) => setLogin(e.target.value)}
                                style={{
                                    background: "var(--surface2)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 12,
                                    padding: "10px 14px",
                                    color: "var(--text)",
                                    margin: 0
                                }}
                            />
                            <input
                                type="password"
                                placeholder="Пароль"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    background: "var(--surface2)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 12,
                                    padding: "10px 14px",
                                    color: "var(--text)",
                                }}
                            />
                            <button
                                type="submit"
                                className="export-btn"
                                disabled={loginLoading}
                                style={{ marginTop: 4 }}
                            >
                                {loginLoading ? "Вход..." : "Войти"}
                            </button>
                        </form>
                        {authChecking && (
                            <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
                                Проверка сессии...
                            </div>
                        )}
                        {authError && (
                            <div
                                className="alert"
                                style={{
                                    marginTop: 12,
                                    background: "rgba(239,68,68,0.08)",
                                    border: "1px solid rgba(239,68,68,0.3)",
                                }}
                            >
                                <div className="alert-title" style={{ color: "#ef4444" }}>Ошибка</div>
                                <div className="alert-body">{authError}</div>
                            </div>
                        )}
                        <a href="/" className="export-btn" style={{ display: "inline-flex", marginTop: 24 }}>
                            ← На анкету
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="app">
            <div className="header" style={{ width: '100vw' }}>
                <div className="header-eyebrow">NeurologyToolKit · Админка</div>
                <h1>
                    <a href={'/'}>Анкета боли</a>
                </h1>
            </div>
            <div className="content" style={{ width: '80vw', maxWidth: 'unset' }}>
            {/*    <div className="section">*/}
                    {/*<button*/}
                    {/*    className="export-btn"*/}
                    {/*    onClick={initDb}*/}
                    {/*    disabled={loading}*/}
                    {/*    style={{ marginTop: 16 }}*/}
                    {/*>*/}
                    {/*    {loading ? "Выполняется..." : "Создать / обновить структуру БД"}*/}
                    {/*</button>*/}
                    {result && (
                        <div
                            className="alert"
                            style={{
                                marginTop: 16,
                                background: result.ok
                                    ? "rgba(34,211,165,0.06)"
                                    : "rgba(239,68,68,0.08)",
                                border: result.ok
                                    ? "1px solid rgba(34,211,165,0.25)"
                                    : "1px solid rgba(239,68,68,0.3)",
                            }}
                        >
                            <div
                                className="alert-title"
                                style={{ color: result.ok ? "#22d3a5" : "#ef4444" }}
                            >
                                {result.ok ? "Готово" : "Ошибка"}
                            </div>
                            <div className="alert-body">
                                {result.data?.message || result.data?.error || "хз"}
                            </div>
                        </div>
                    )}
                {/*</div>*/}

                <div className="section">
                    <div className="section-title">Ответы</div>

                    {listLoading && (
                        <div style={{ marginTop: 12, fontSize: 14, color: "var(--muted)" }}>
                            Загрузка ответов...
                        </div>
                    )}
                    {listError && (
                        <div
                            className="alert"
                            style={{
                                marginTop: 12,
                                background: "rgba(239,68,68,0.08)",
                                border: "1px solid rgba(239,68,68,0.3)",
                            }}
                        >
                            <div className="alert-title" style={{ color: "#ef4444" }}>Ошибка загрузки</div>
                            <div className="alert-body">{listError}</div>
                        </div>
                    )}

                    {!listLoading && !listError && assessments.length === 0 && (
                        <div style={{ marginTop: 12, fontSize: 14, color: "var(--muted)" }}>
                            Пока нет сохранённых ответов.
                        </div>
                    )}

                    {!listLoading && assessments.length > 0 && (
                        <div style={{ marginTop: 16, display: "flex", gap: 20, alignItems: "flex-start" }}>
                            <div style={{ flex: 1, maxHeight: 360, overflowY: "auto" }}>
                                {assessments.map((a) => {
                                    const dt = a.created_at ? new Date(a.created_at.replace(" ", "T")) : null;
                                    const labelDate = dt
                                        ? dt.toLocaleString("ru-RU", {
                                              day: "2-digit",
                                              month: "2-digit",
                                              year: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                          })
                                        : "Без даты";
                                    const name = a.full_name || "Без имени";
                                    const isActive = selected && selected.id === a.assessment_id;

                                    return (
                                        <button
                                            key={a.assessment_id}
                                            onClick={() => loadDetail(a.assessment_id)}
                                            style={{
                                                width: "100%",
                                                textAlign: "left",
                                                padding: "10px 12px",
                                                borderRadius: 10,
                                                border: "1px solid var(--border)",
                                                background: isActive ? "var(--surface2)" : "var(--surface1)",
                                                marginBottom: 8,
                                                cursor: "pointer",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                gap: 12,
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8 }}>{name}</div>
                                                <div style={{ fontSize: 12, color: "var(--muted)" }}>{labelDate}</div>
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    padding: "4px 8px",
                                                    width: "22%",
                                                    borderRadius: 999,
                                                    background: "rgba(59,130,246,0.1)",
                                                    color: "#3b82f6",
                                                }}
                                            >
                                                PRI {a.total_score ?? a.pri ?? "—"}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div style={{ flex: 1.3 }}>
                                {detailLoading && (
                                    <div style={{ fontSize: 14, color: "var(--muted)" }}>
                                        Загрузка подробностей...
                                    </div>
                                )}
                                {!detailLoading && selected && selected.error && (
                                    <div
                                        className="alert"
                                        style={{
                                            background: "rgba(239,68,68,0.08)",
                                            border: "1px solid rgba(239,68,68,0.3)",
                                        }}
                                    >
                                        <div className="alert-title" style={{ color: "#ef4444" }}>
                                            Ошибка загрузки
                                        </div>
                                        <div className="alert-body">{selected.error}</div>
                                    </div>
                                )}
                                {!detailLoading && selected && !selected.error && (
                                    <div
                                        style={{
                                            borderRadius: 16,
                                            border: "1px solid var(--border)",
                                            padding: 16,
                                            background: "var(--surface1)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                fontSize: 13,
                                                color: "var(--muted)",
                                                textTransform: "uppercase",
                                                letterSpacing: "1.5px",
                                                marginBottom: 16,
                                            }}
                                        >
                                            Результат
                                            <button
                                                className="del-btn"
                                                title={"Удалить"}
                                                onClick={deleteSelected}
                                                disabled={deleteLoading}
                                                style={{
                                                    background: "#dc2626" ,
                                                    marginLeft: 'auto'
                                            }}
                                            >
                                                <span className="export-icon">🗑</span>
                                            </button>
                                        </div>
                                        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                                            {selected.full_name || "Без имени"}
                                        </div>
                                        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                                            {selected.created_at}
                                        </div>

                                        <div className="summary-grid" style={{ marginBottom: 16 }}>
                                            {[
                                                ["PRI", selected.total_score ?? selected.pri, mcgillMaxPRI()],
                                                ["Сенсор.", selected.sensory_score ?? selected.pri_sensory, MCGILL_CATEGORIES.filter(c => c.type === "sensory").reduce((s, c) => s + c.words.length, 0)],
                                                ["Аффект.", selected.affective_score ?? selected.pri_affective, MCGILL_CATEGORIES.filter(c => c.type === "affective").reduce((s, c) => s + c.words.length, 0)],
                                                ["Оценка", selected.pri_evaluative ?? 0, MCGILL_CATEGORIES.find(c => c.type === "evaluative")?.words.length ?? 0],
                                                ["Прочие", selected.pri_misc ?? 0, MCGILL_CATEGORIES.filter(c => c.type === "miscellaneous").reduce((s, c) => s + c.words.length, 0)],
                                                ["PPI", selected.ppi_score ?? selected.ppi, 5],
                                                ...(selected.vas_score != null ? [["VAS", selected.vas_score, 10]] : []),
                                            ].map(([l, v, m]) => (
                                                <div key={l} className="stat-card">
                                                    <div className="stat-label">{l}</div>
                                                    <div className="stat-val">
                                                        {v ?? "—"}
                                                        {m != null && <span>/{m}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {Array.isArray(MCGILL_CATEGORIES) && selected.pain_descriptors && (
                                            <div style={{ marginTop: 8 }}>
                                                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Выбранные дескрипторы</div>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                    {MCGILL_CATEGORIES.map((c) => {
                                                        const rank = selected.pain_descriptors[c.id] || 0;
                                                        const word = rank > 0 ? c.words[rank - 1] : null;
                                                        if (!word) return null;
                                                        return (
                                                            <div
                                                                key={c.id}
                                                                style={{
                                                                    padding: "6px 8px",
                                                                    borderRadius: 999,
                                                                    border: "1px solid var(--border)",
                                                                    background: "var(--surface2)",
                                                                    fontSize: 11,
                                                                }}
                                                            >
                                                                {c.id}. {word} (ранг {rank})
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {selected.body_map && (selected.body_map.front?.length > 0 || selected.body_map.back?.length > 0) && (
                                            <div style={{ marginTop: 16 }}>
                                                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Карта тела</div>
                                                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                                                    {selected.body_map.front?.length > 0 && (
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Спереди</div>
                                                            <svg viewBox={`0 0 ${BODY_VIEWBOX.w} ${BODY_VIEWBOX.h}`} width={120} height={240} style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
                                                                <image
                                                                    href={BODY_IMAGES.front}
                                                                    x="0"
                                                                    y="0"
                                                                    width={BODY_VIEWBOX.w}
                                                                    height={BODY_VIEWBOX.h}
                                                                    preserveAspectRatio="xMidYMid meet"
                                                                />
                                                                <g fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity={0.85}>
                                                                    {selected.body_map.front.map((d, i) => <path key={i} d={d} />)}
                                                                </g>
                                                            </svg>
                                                        </div>
                                                    )}
                                                    {selected.body_map.back?.length > 0 && (
                                                        <div>
                                                            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Сзади</div>
                                                            <svg viewBox={`0 0 ${BODY_VIEWBOX.w} ${BODY_VIEWBOX.h}`} width={120} height={240} style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
                                                                <image
                                                                    href={BODY_IMAGES.back}
                                                                    x="0"
                                                                    y="0"
                                                                    width={BODY_VIEWBOX.w}
                                                                    height={BODY_VIEWBOX.h}
                                                                    preserveAspectRatio="xMidYMid meet"
                                                                />
                                                                <g fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity={0.85}>
                                                                    {selected.body_map.back.map((d, i) => <path key={i} d={d} />)}
                                                                </g>
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                                            <button
                                                className="export-btn"
                                                onClick={exportSelectedToPDF}
                                                style={{ background: "#1d4ed8" }}
                                            >
                                                <span className="export-icon">📄</span>
                                                Экспортировать в PDF
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {!detailLoading && !selected && assessments.length > 0 && (
                                    <div style={{ fontSize: 13, color: "var(--muted)" }}>
                                        Выберите запись слева, чтобы увидеть подробный отчёт.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function App() {
    const isAdmin = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
    const [patientName, setPatientName] = useState("");
    const [scores, setScores] = useState(Object.fromEntries(MCGILL_CATEGORIES.map(c => [c.id, 0])));
    const [vas, setVas] = useState(0);
    const [ppi, setPpi] = useState(0);
    const [bodyMap, setBodyMap] = useState({ front: [], back: [] });
    const [open, setOpen] = useState(null);

    const priSensory = MCGILL_CATEGORIES.filter(c => c.type === "sensory").reduce((s, c) => s + (scores[c.id] || 0), 0);
    const priAffective = MCGILL_CATEGORIES.filter(c => c.type === "affective").reduce((s, c) => s + (scores[c.id] || 0), 0);
    const priEvaluative = MCGILL_CATEGORIES.filter(c => c.type === "evaluative").reduce((s, c) => s + (scores[c.id] || 0), 0);
    const priMisc = MCGILL_CATEGORIES.filter(c => c.type === "miscellaneous").reduce((s, c) => s + (scores[c.id] || 0), 0);
    const priTotal = priSensory + priAffective + priEvaluative + priMisc;
    const priMax = mcgillMaxPRI();
    const pct = priMax > 0 ? (priTotal / priMax) * 100 : 0;

    const chosenWords = MCGILL_CATEGORIES.filter(c => (scores[c.id] || 0) > 0).map(c => ({ ...c, rank: scores[c.id], word: c.words[scores[c.id] - 1] }));

    const exportToExcel = () => {
        const now = new Date();
        const dateStr = now.toLocaleDateString("ru-RU");
        const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
        const typeLabel = (t) => ({ sensory: "Сенсорная", affective: "Аффективная", evaluative: "Оценочная", miscellaneous: "Прочие" })[t] || t;

        const detailRows = [
            ["McGill Pain Questionnaire (MPQ)"],
            [`Пациент: ${patientName || "Не указано"}`],
            [`Дата: ${dateStr}  Время: ${timeStr}`],
            [],
            ["№", "Тип", "Характер боли", "Ранг"],
            ...MCGILL_CATEGORIES.map(c => {
                const rank = scores[c.id] || 0;
                const word = rank > 0 ? c.words[rank - 1] : "—";
                return [c.id, typeLabel(c.type), word, rank];
            }),
            [],
            ["PPI (интенсивность боли в настоящий момент)", "", "", ppi, PPI_OPTIONS[ppi].label],
            ["VAS", "", "", vas, `${vas} / 10`],
        ];

        const summaryRows = [
            ["MPQ — Итоговые показатели"],
            [`Пациент: ${patientName || "Не указано"}`],
            [`Дата: ${dateStr}  Время: ${timeStr}`],
            [],
            ["Показатель", "Балл", "Максимум"],
            ["PRI (индекс боли)", priTotal, priMax],
            ["PRI сенсорная (1–10)", priSensory, MCGILL_CATEGORIES.filter(c => c.type === "sensory").reduce((s, c) => s + c.words.length, 0)],
            ["PRI аффективная (11–15)", priAffective, MCGILL_CATEGORIES.filter(c => c.type === "affective").reduce((s, c) => s + c.words.length, 0)],
            ["PRI оценочная (16)", priEvaluative, MCGILL_CATEGORIES.find(c => c.type === "evaluative")?.words.length ?? 0],
            ["PRI прочие (17–20)", priMisc, MCGILL_CATEGORIES.filter(c => c.type === "miscellaneous").reduce((s, c) => s + c.words.length, 0)],
            ["PPI", ppi, 5],
            ["VAS", vas, 10],
            [],
            ["Выбранные дескрипторы:"],
            ...chosenWords.map(w => [`  ${w.id}. ${w.word} (ранг ${w.rank})`]),
            chosenWords.length === 0 ? ["  Нет"] : [],
        ];

        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.aoa_to_sheet(detailRows);
        ws1["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 22 }, { wch: 8 }];
        XLSX.utils.book_append_sheet(wb, ws1, "Детали");
        const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
        ws2["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws2, "Итог");
        XLSX.writeFile(wb, `MPQ_${patientName ? patientName.replace(/\s+/g, "_") : "Patient"}_${dateStr.replace(/\./g, "-")}.xlsx`);
    };

    const [saveStatus, setSaveStatus] = useState(null);

    const saveToDb = async () => {
        setSaveStatus({ loading: true });
        try {
            const res = await fetch("/backend/save_assessment.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify({
                    patientName,
                    total: priTotal,
                    pri: priTotal,
                    sensory: priSensory,
                    affective: priAffective,
                    pri_evaluative: priEvaluative,
                    pri_misc: priMisc,
                    vas,
                    ppi,
                    scores,
                    bodyMap,
                }),
            });
            const data = await res.json();
            setSaveStatus({
                loading: false,
                ok: res.ok && data.success,
                message: data.message || data.error || "Неизвестный ответ",
            });
        } catch (e) {
            setSaveStatus({
                loading: false,
                ok: false,
                message: e.message,
            });
        }
    };

    if (isAdmin) {
        return <Admin />;
    }

    return (
        <div className="app">
            <div className="header">
                <div className="header-eyebrow">NeurologyToolKit · Оценка боли</div>
                <h1>Оценка боли McGill</h1>
                <div className="header-sub">MPQ · Melzack (1975) · 20 групп дескрипторов · PRI + PPI</div>
            </div>

            <div className="content">
                {/* Блок информации о пациенте в едином стиле */}
                <div className="section" style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            fontSize: '24px',
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: 'var(--surface2)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent)'
                        }}>
                            👤
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{
                                fontSize: '11px',
                                color: 'var(--muted)',
                                letterSpacing: '2px',
                                textTransform: 'uppercase',
                                marginBottom: '4px'
                            }}>
                                Информация о пациенте
                            </div>
                            <input
                                id="patientName"
                                type="text"
                                value={patientName}
                                onChange={(e) => setPatientName(e.target.value)}
                                placeholder="Введите фамилию, имя, отчество"
                                style={{
                                    width: '100%',
                                    background: 'var(--surface2)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px',
                                    padding: '12px 16px',
                                    fontSize: '15px',
                                    color: 'var(--text)',
                                    fontFamily: 'var(--font-sans)',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                            />
                        </div>
                    </div>
                </div>

                <div className="section">
                    <div className="section-title">Карта тела</div>
                    <div className="section-subtitle">Отметьте области боли</div>
                    <BodyMap value={bodyMap} onChange={setBodyMap} />
                </div>

                <div className="accordion">
                    {ACCORDION_SECTIONS.map(sec => (
                        <div key={sec.key} className="acc-item">
                            <button className="acc-btn" onClick={() => setOpen(open === sec.key ? null : sec.key)}>
                                {sec.title}
                                <span className={`acc-chevron ${open === sec.key ? "open" : ""}`}>▼</span>
                            </button>
                            {open === sec.key && <div className="acc-body">{sec.body}</div>}
                        </div>
                    ))}
                </div>

                <div className="score-bar">
                    <div className="score-top">
                        <div className="score-main">PRI (индекс боли): <span>{priTotal}</span> / {priMax}</div>
                        <div className="score-subs">
                            <span>Сенсорная (1–10): <b>{priSensory}</b></span>
                            <span>Аффективная (11–15): <b>{priAffective}</b></span>
                            <span>Оценочная (16): <b>{priEvaluative}</b></span>
                            <span>Прочие (17–20): <b>{priMisc}</b></span>
                            <span>PPI: <b>{ppi}/5</b></span>
                            <span>VAS: <b>{vas}/10</b></span>
                        </div>
                    </div>
                    <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="progress-labels"><span>Нет боли</span><span>Макс. PRI</span></div>
                </div>

                <div className="section">
                    <div className="section-title">Сенсорные дескрипторы (1–10)</div>
                    <div className="section-subtitle">Выберите по одному варианту в каждой группе или «не выбирать» · Сумма рангов: {priSensory}</div>
                    {MCGILL_CATEGORIES.filter(c => c.type === "sensory").map(cat => (
                        <McGillCategoryRow key={cat.id} category={cat} value={scores[cat.id] ?? 0}
                            onChange={v => setScores(p => ({ ...p, [cat.id]: v }))} />
                    ))}
                </div>

                <div className="section">
                    <div className="section-title">Аффективные дескрипторы (11–15)</div>
                    <div className="section-subtitle">Сумма рангов: {priAffective}</div>
                    {MCGILL_CATEGORIES.filter(c => c.type === "affective").map(cat => (
                        <McGillCategoryRow key={cat.id} category={cat} value={scores[cat.id] ?? 0}
                            onChange={v => setScores(p => ({ ...p, [cat.id]: v }))} />
                    ))}
                </div>

                <div className="section">
                    <div className="section-title">Оценочный дескриптор (16)</div>
                    <div className="section-subtitle">Сумма рангов: {priEvaluative}</div>
                    {MCGILL_CATEGORIES.filter(c => c.type === "evaluative").map(cat => (
                        <McGillCategoryRow key={cat.id} category={cat} value={scores[cat.id] ?? 0}
                            onChange={v => setScores(p => ({ ...p, [cat.id]: v }))} />
                    ))}
                </div>

                <div className="section">
                    <div className="section-title">Прочие дескрипторы (17–20)</div>
                    <div className="section-subtitle">Сумма рангов: {priMisc}</div>
                    {MCGILL_CATEGORIES.filter(c => c.type === "miscellaneous").map(cat => (
                        <McGillCategoryRow key={cat.id} category={cat} value={scores[cat.id] ?? 0}
                            onChange={v => setScores(p => ({ ...p, [cat.id]: v }))} />
                    ))}
                </div>

                <div className="section">
                    <div className="section-title">Шкала оценки боли</div>
                    <div className="section-subtitle">Интенсивность боли · 0 – 10</div>
                    <div className="vas-wrap">
                        <input type="range" min={0} max={10} value={vas} onChange={e => setVas(Number(e.target.value))} />
                    </div>
                    <div className="vas-value">
                        <span className="vas-number" style={{ color: vas === 0 ? "#22d3a5" : vas <= 5 ? "#f59e0b" : "#ef4444" }}>
                            {vas}<span className="vas-denom"> / 10</span>
                        </span>
                    </div>
                    <div className="vas-labels"><span>Нет боли (0)</span><span>Наисильнейшая боль (10)</span></div>
                </div>

                <div className="section">
                    <div className="section-title">Интенсивность боли</div>
                    <div className="section-subtitle">Текущий уровень · 0 – 5</div>
                    <div className="ppi-grid">
                        {PPI_OPTIONS.map(opt => (
                            <button key={opt.value} className="ppi-btn" onClick={() => setPpi(opt.value)}
                                    style={ppi === opt.value ? {
                                        background: LEVEL_CONFIG[Math.min(opt.value, 3)].bg,
                                        borderColor: LEVEL_CONFIG[Math.min(opt.value, 3)].border,
                                        color: LEVEL_CONFIG[Math.min(opt.value, 3)].color,
                                        fontWeight: 500,
                                    } : {}}>
                                <span style={{ fontSize: 10, opacity: 0.5, marginRight: 6 }}>{opt.value}</span>{opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="section">
                    <div className="section-title">Итоговые показатели</div>
                    <div className="section-subtitle">PRI (индекс оценки боли) и PPI</div>

                    <div className="summary-grid">
                        {[
                            ["PRI (всего)", priTotal, priMax],
                            ["Сенсорная", priSensory, MCGILL_CATEGORIES.filter(c => c.type === "sensory").reduce((s, c) => s + c.words.length, 0)],
                            ["Аффективная", priAffective, MCGILL_CATEGORIES.filter(c => c.type === "affective").reduce((s, c) => s + c.words.length, 0)],
                            ["Оценочная", priEvaluative, MCGILL_CATEGORIES.find(c => c.type === "evaluative")?.words.length ?? 0],
                            ["Прочие", priMisc, MCGILL_CATEGORIES.filter(c => c.type === "miscellaneous").reduce((s, c) => s + c.words.length, 0)],
                            ["PPI", ppi, 5],
                            ["VAS", vas, 10],
                        ].map(([l, v, m]) => (
                            <div key={l} className="stat-card">
                                <div className="stat-label">{l}</div>
                                <div className="stat-val">{v}<span>/{m}</span></div>
                            </div>
                        ))}
                    </div>

                    {chosenWords.length > 0 && (
                        <div className="alert" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                            <div className="alert-title">Выбранные дескрипторы</div>
                            <div className="alert-body" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{chosenWords.map(w => <span key={w.id} style={{ padding: "4px 8px", borderRadius: 999, background: "var(--surface1)", fontSize: 12 }}>{w.id}. {w.word}</span>)}</div>
                        </div>
                    )}

                    <div style={{ marginTop: 20, display: 'flex', gap: '10px' }}>
                        {!(saveStatus && saveStatus.ok && !saveStatus.loading) && (
                            <button
                                className="export-btn"
                                onClick={saveToDb}
                                style={{ background: '#16a34a' }}
                            >
                                {saveStatus?.loading ? "Сохранение..." : "Сохранить"}
                            </button>
                        )}
                    </div>
                    {saveStatus && !saveStatus.loading && (
                        <div
                            className="alert"
                            style={{
                                marginTop: 16,
                                background: saveStatus.ok
                                    ? "rgba(34,211,165,0.06)"
                                    : "rgba(239,68,68,0.08)",
                                border: saveStatus.ok
                                    ? "1px solid rgba(34,211,165,0.25)"
                                    : "1px solid rgba(239,68,68,0.3)",
                            }}
                        >
                            <div
                                className="alert-title"
                                style={{
                                    color: saveStatus.ok ? "#22d3a5" : "#ef4444",
                                    display: 'flex',
                                    justifyContent: 'center',
                                    cursor: saveStatus.ok ? 'pointer' : 'default',
                                }}
                                onClick={() => {
                                    if (saveStatus?.ok) {
                                        setSaveStatus(null);
                                    }
                                }}
                            >
                                {saveStatus.ok ? "Сохранено" : "Ошибка сохранения"}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}