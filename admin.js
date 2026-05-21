import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const fallbackData = {
    users: {
        cashier: { name: "Кассир", pass: "2012" },
        evgeniy: { name: "Евгений", pass: "0186", manager: true },
        vadim: { name: "Вадим", pass: "2385", manager: true }
    },
    news: {
        badge: "НОВОСТЬ ДЛЯ КОМАНДЫ",
        title: "🚀 Команда, для вас хорошие новости",
        text: `Запускаем <b>Бонусный проект</b> — систему накопительных скидок.<br><br>Привязка клиента:<br>• по ФИО<br>• по номеру телефона<br><br>Все покупки сохраняются автоматически.`,
        endDate: "2026-06-20T00:00:00"
    },
    calculators: [
        { title: "КАЛЬКУЛЯТОР РАССРОЧКИ", bank: "АГРОПРОМБАНК", rows: [["3 мес.", 0.955], ["6 мес.", 0.93], ["9 мес.", 0.90], ["12 мес.", 0.875]] },
        { title: "КАЛЬКУЛЯТОР РАССРОЧКИ", bank: "ЭКСИМБАНК", rows: [["3 мес.", 0.955], ["6 мес.", 0.93], ["9 мес.", 0.90], ["12 мес.", 0.886]] },
        { title: "КАЛЬКУЛЯТОР РАССРОЧКИ", bank: "СБЕРБАНК", rows: [["3 мес.", 0.96], ["6 мес.", 0.93], ["9 мес.", 0.90], ["12 мес.", 0.88]] }
    ],
    menu: [
        { href: "beznal.html", icon: "💳", title: "Безнал", desc: "Оформление безналичной оплаты и документов." },
        { href: "smena.html", icon: "📊", title: "Закрытие смены", desc: "Быстрое оформление и завершение смены." },
        { href: "discount.html", icon: "🎫", title: "Скидочная карта", desc: "Создание и печать анкеты клиента." },
        { href: "baza.html", icon: "📚", title: "База знаний", desc: "Инструкции, масла и техническая информация." },
        { href: "pass.html", icon: "🔐", title: "Пароли", desc: "Доступы и служебная информация." },
        { href: "close-shift.html", icon: "📊", title: "Закрытие смен", desc: "Ссылка на отчет по закрытию смены", managerOnly: true },
        { href: "cash-diff.html", icon: "💰", title: "Расхождение по кассе", desc: "Контроль расхождения наличности.", managerOnly: true },
        { href: "#", icon: "🚪", title: "Выход", desc: "Завершить текущую сессию пользователя.", action: "logout" }
    ]
};

let db = null;
let data = structuredClone(fallbackData);
const $ = (id) => document.getElementById(id);

function isFirebaseReady() {
    return firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("PASTE_");
}

function setStatus(text, type = "") {
    const el = $("statusText");
    el.textContent = text;
    el.className = type ? `status-${type}` : "";
}

function toDatetimeLocal(value) {
    if (!value) return "";
    return String(value).slice(0, 16);
}

function collectDataFromForm() {
    data.news = {
        badge: $("newsBadge").value.trim(),
        title: $("newsTitle").value.trim(),
        text: $("newsText").value,
        endDate: $("newsEndDate").value ? `${$("newsEndDate").value}:00` : ""
    };

    data.calculators = [...document.querySelectorAll("[data-calc]")].map(card => ({
        title: card.querySelector("[data-calc-title]").value.trim(),
        bank: card.querySelector("[data-calc-bank]").value.trim(),
        rows: [...card.querySelectorAll("[data-calc-row]")].map(row => [
            row.querySelector("[data-term]").value.trim(),
            Number(row.querySelector("[data-coef]").value)
        ]).filter(row => row[0] && !Number.isNaN(row[1]))
    }));

    data.menu = [...document.querySelectorAll("[data-menu]")].map(card => ({
        icon: card.querySelector("[data-menu-icon]").value.trim(),
        title: card.querySelector("[data-menu-title]").value.trim(),
        desc: card.querySelector("[data-menu-desc]").value.trim(),
        href: card.querySelector("[data-menu-href]").value.trim() || "#",
        managerOnly: card.querySelector("[data-menu-manager]").checked,
        action: card.querySelector("[data-menu-action]").value.trim() || undefined
    })).filter(item => item.title);

    const users = {};
    [...document.querySelectorAll("[data-user]")].forEach(card => {
        const key = card.querySelector("[data-user-key]").value.trim();
        if (!key) return;
        users[key] = {
            name: card.querySelector("[data-user-name]").value.trim(),
            pass: card.querySelector("[data-user-pass]").value.trim(),
            manager: card.querySelector("[data-user-manager]").checked
        };
    });
    data.users = users;

    $("jsonEditor").value = JSON.stringify(data, null, 4);
}

function renderAll() {
    $("newsBadge").value = data.news?.badge || "";
    $("newsTitle").value = data.news?.title || "";
    $("newsText").value = data.news?.text || "";
    $("newsEndDate").value = toDatetimeLocal(data.news?.endDate);
    renderCalculators();
    renderMenu();
    renderUsers();
    $("jsonEditor").value = JSON.stringify(data, null, 4);
}

function renderCalculators() {
    $("calculatorsEditor").innerHTML = (data.calculators || []).map((calc, i) => `
        <div class="editor-card" data-calc>
            <div class="card-title-line">
                <strong>${calc.bank || "Банк"}</strong>
                <button class="danger-btn" data-remove-calc>Удалить</button>
            </div>
            <div class="editor-grid">
                <div><label>Название блока</label><input data-calc-title value="${escapeAttr(calc.title || "")}"></div>
                <div><label>Банк</label><input data-calc-bank value="${escapeAttr(calc.bank || "")}"></div>
            </div>
            <div class="row-list">
                ${(calc.rows || []).map(([term, coef]) => rowTemplate(term, coef)).join("")}
            </div>
            <button class="small-btn" data-add-row>+ Срок</button>
        </div>`).join("");
}

function rowTemplate(term = "3 мес.", coef = 0.95) {
    return `<div class="row-item" data-calc-row>
        <input data-term placeholder="Срок" value="${escapeAttr(term)}">
        <input data-coef type="number" step="0.001" placeholder="Коэффициент" value="${coef}">
        <button class="danger-btn" data-remove-row>×</button>
    </div>`;
}

function renderMenu() {
    $("menuEditor").innerHTML = (data.menu || []).map(item => `
        <div class="editor-card" data-menu>
            <div class="card-title-line">
                <strong>${item.icon || "🔗"} ${item.title || "Карточка"}</strong>
                <button class="danger-btn" data-remove-menu>Удалить</button>
            </div>
            <div class="menu-item">
                <div><label>Иконка</label><input data-menu-icon value="${escapeAttr(item.icon || "")}"></div>
                <div><label>Название</label><input data-menu-title value="${escapeAttr(item.title || "")}"></div>
                <div><label>Ссылка</label><input data-menu-href value="${escapeAttr(item.href || "#")}"></div>
            </div>
            <label>Описание</label><input data-menu-desc value="${escapeAttr(item.desc || "")}">
            <div class="editor-grid">
                <label class="checkbox-line"><input type="checkbox" data-menu-manager ${item.managerOnly ? "checked" : ""}> Только менеджерам</label>
                <div><label>Action, например logout</label><input data-menu-action value="${escapeAttr(item.action || "")}"></div>
            </div>
        </div>`).join("");
}

function renderUsers() {
    $("usersEditor").innerHTML = Object.entries(data.users || {}).map(([key, user]) => `
        <div class="editor-card" data-user>
            <div class="card-title-line">
                <strong>${user.name || key}</strong>
                <button class="danger-btn" data-remove-user>Удалить</button>
            </div>
            <div class="editor-grid three">
                <div><label>ID</label><input data-user-key value="${escapeAttr(key)}"></div>
                <div><label>Имя</label><input data-user-name value="${escapeAttr(user.name || "")}"></div>
                <div><label>Пароль</label><input data-user-pass value="${escapeAttr(user.pass || "")}"></div>
            </div>
            <label class="checkbox-line"><input type="checkbox" data-user-manager ${user.manager ? "checked" : ""}> Менеджер</label>
        </div>`).join("");
}

function escapeAttr(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function loadData() {
    if (!isFirebaseReady()) {
        setStatus("Firebase config не заполнен. Сейчас админка работает только с локальным шаблоном.", "error");
        data = structuredClone(fallbackData);
        renderAll();
        return;
    }

    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        const snap = await getDoc(doc(db, "site", "main"));
        data = snap.exists() ? { ...structuredClone(fallbackData), ...snap.data() } : structuredClone(fallbackData);
        renderAll();
        setStatus("Данные загружены из Firebase.", "ok");
    } catch (error) {
        console.error(error);
        data = structuredClone(fallbackData);
        renderAll();
        setStatus("Не удалось загрузить Firebase. Проверь config и правила Firestore.", "error");
    }
}

async function saveData() {
    collectDataFromForm();

    if (!db) {
        setStatus("Сохранение недоступно: сначала заполни firebase-config.js.", "error");
        return;
    }

    try {
        await setDoc(doc(db, "site", "main"), data, { merge: true });
        setStatus("Сохранено в Firebase. Обнови главную страницу.", "ok");
    } catch (error) {
        console.error(error);
        setStatus("Ошибка сохранения. Проверь правила Firestore.", "error");
    }
}

function bindEvents() {
    document.querySelectorAll(".admin-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            collectDataFromForm();
            document.querySelectorAll(".admin-tab").forEach(x => x.classList.remove("active"));
            document.querySelectorAll(".admin-panel").forEach(x => x.classList.remove("active"));
            btn.classList.add("active");
            $(`tab-${btn.dataset.tab}`).classList.add("active");
        });
    });

    $("saveBtn").onclick = saveData;
    $("reloadBtn").onclick = loadData;

    $("addCalculatorBtn").onclick = () => {
        collectDataFromForm();
        data.calculators.push({ title: "КАЛЬКУЛЯТОР РАССРОЧКИ", bank: "НОВЫЙ БАНК", rows: [["3 мес.", 0.95]] });
        renderAll();
    };

    $("addMenuBtn").onclick = () => {
        collectDataFromForm();
        data.menu.push({ href: "#", icon: "🔗", title: "Новая карточка", desc: "Описание" });
        renderAll();
    };

    $("addUserBtn").onclick = () => {
        collectDataFromForm();
        data.users[`user${Object.keys(data.users).length + 1}`] = { name: "Новый пользователь", pass: "0000", manager: false };
        renderAll();
    };

    $("applyJsonBtn").onclick = () => {
        try {
            data = JSON.parse($("jsonEditor").value);
            renderAll();
            setStatus("JSON применён. Теперь можно сохранить в Firebase.", "ok");
        } catch {
            setStatus("Ошибка в JSON. Проверь запятые и кавычки.", "error");
        }
    };

    document.body.addEventListener("click", (e) => {
        if (e.target.matches("[data-remove-calc]")) { e.target.closest("[data-calc]").remove(); collectDataFromForm(); renderAll(); }
        if (e.target.matches("[data-add-row]")) e.target.previousElementSibling.insertAdjacentHTML("beforeend", rowTemplate());
        if (e.target.matches("[data-remove-row]")) { e.target.closest("[data-calc-row]").remove(); collectDataFromForm(); }
        if (e.target.matches("[data-remove-menu]")) { e.target.closest("[data-menu]").remove(); collectDataFromForm(); renderAll(); }
        if (e.target.matches("[data-remove-user]")) { e.target.closest("[data-user]").remove(); collectDataFromForm(); renderAll(); }
    });
}

bindEvents();
loadData();
