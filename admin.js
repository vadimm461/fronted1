const clone = (obj) => JSON.parse(JSON.stringify(obj));

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
let fb = null;
let data = clone(fallbackData);
let products = [];
let deletedProductIds = [];

const $ = (id) => document.getElementById(id);

function withTimeout(promise, ms = 9000) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Firebase timeout")), ms))
    ]);
}

async function getFirebaseConfig() {
    try {
        const module = await import("./firebase-config.js?ts=" + Date.now());
        const config = module.firebaseConfig || {};
        if (!config.apiKey || String(config.apiKey).includes("PASTE_")) return null;
        return config;
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function initFirebase() {
    const config = await getFirebaseConfig();

    if (!config) {
        setStatus("Firebase config не заполнен или файл с ошибкой. Работает локальный шаблон.", "error");
        return false;
    }

    try {
        const appMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
        const fsMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

        fb = fsMod;
        const app = appMod.initializeApp(config);
        db = fsMod.getFirestore(app);

        return true;
    } catch (error) {
        console.error(error);
        setStatus("Firebase не подключился. Проверь firebase-config.js и интернет.", "error");
        return false;
    }
}

function setStatus(text, type = "") {
    const el = $("statusText");
    if (!el) return;
    el.textContent = text;
    el.className = type ? `status-${type}` : "";
}

function toDatetimeLocal(value) {
    return value ? String(value).slice(0, 16) : "";
}

function escapeAttr(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function normalizeCalculatorRows(rows) {
    return (rows || []).map(row => {
        if (Array.isArray(row)) return [row[0], Number(row[1])];
        return [row.term || row.title || "", Number(row.coef ?? row.value ?? 0)];
    }).filter(row => row[0] && !Number.isNaN(row[1]));
}

function normalizeSiteData(siteData) {
    const result = { ...clone(fallbackData), ...(siteData || {}) };
    result.calculators = (result.calculators || []).map(calc => ({
        ...calc,
        rows: normalizeCalculatorRows(calc.rows)
    }));
    return result;
}

function prepareSiteDataForFirestore(sourceData) {
    const result = clone(sourceData);

    // Firestore НЕ поддерживает массивы внутри массивов.
    // Поэтому rows: [["3 мес.", 0.95]] сохраняем как rows: [{term:"3 мес.", coef:0.95}]
    result.calculators = (result.calculators || []).map(calc => ({
        ...calc,
        rows: normalizeCalculatorRows(calc.rows).map(([term, coef]) => ({ term, coef }))
    }));

    return result;
}

function collectDataFromForm() {
    if (!$("newsBadge")) return;

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
    if ($("jsonEditor")) $("jsonEditor").value = JSON.stringify(data, null, 4);
}

function collectProductsFromForm() {
    products = [...document.querySelectorAll("[data-product]")].map(card => ({
        id: card.dataset.id || "",
        code: card.querySelector("[data-product-code]")?.value.trim() || "",
        name: card.querySelector("[data-product-name]").value.trim(),
        group: card.querySelector("[data-product-group]").value.trim(),
        bonus: Number(card.querySelector("[data-product-bonus]").value) || 0,
        plan: Number(card.querySelector("[data-product-plan]").value) || 0,
        sold: Number(card.querySelector("[data-product-sold]").value) || 0
    })).filter(item => item.name);
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
    $("calculatorsEditor").innerHTML = (data.calculators || []).map(calc => `
        <div class="editor-card" data-calc>
            <div class="card-title-line">
                <strong>${escapeAttr(calc.bank || "Банк")}</strong>
                <button class="danger-btn" data-remove-calc>Удалить</button>
            </div>
            <div class="editor-grid">
                <div><label>Название блока</label><input data-calc-title value="${escapeAttr(calc.title || "")}"></div>
                <div><label>Банк</label><input data-calc-bank value="${escapeAttr(calc.bank || "")}"></div>
            </div>
            <div class="row-list">${normalizeCalculatorRows(calc.rows).map(([term, coef]) => rowTemplate(term, coef)).join("")}</div>
            <button class="small-btn" data-add-row>+ Срок</button>
        </div>
    `).join("");
}

function rowTemplate(term = "3 мес.", coef = 0.95) {
    return `
        <div class="row-item" data-calc-row>
            <input data-term placeholder="Срок" value="${escapeAttr(term)}">
            <input data-coef type="number" step="0.001" placeholder="Коэффициент" value="${escapeAttr(coef)}">
            <button class="danger-btn" data-remove-row>×</button>
        </div>
    `;
}

function renderMenu() {
    $("menuEditor").innerHTML = (data.menu || []).map(item => `
        <div class="editor-card" data-menu>
            <div class="card-title-line"><strong>${escapeAttr(item.icon || "🔗")} ${escapeAttr(item.title || "Карточка")}</strong><button class="danger-btn" data-remove-menu>Удалить</button></div>
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
        </div>
    `).join("");
}

function renderUsers() {
    $("usersEditor").innerHTML = Object.entries(data.users || {}).map(([key, user]) => `
        <div class="editor-card" data-user>
            <div class="card-title-line"><strong>${escapeAttr(user.name || key)}</strong><button class="danger-btn" data-remove-user>Удалить</button></div>
            <div class="editor-grid three">
                <div><label>ID</label><input data-user-key value="${escapeAttr(key)}"></div>
                <div><label>Имя</label><input data-user-name value="${escapeAttr(user.name || "")}"></div>
                <div><label>Пароль</label><input data-user-pass value="${escapeAttr(user.pass || "")}"></div>
            </div>
            <label class="checkbox-line"><input type="checkbox" data-user-manager ${user.manager ? "checked" : ""}> Менеджер</label>
        </div>
    `).join("");
}

function getProductGroups() {
    return [...new Set(products.map(item => String(item.group || "Без группы").trim() || "Без группы"))]
        .sort((a, b) => a.localeCompare(b, "ru"));
}

function renderProducts() {
    const box = $("productsEditor");
    if (!box) return;

    const groups = getProductGroups();

    if (!products.length) {
        box.innerHTML = `
            <div class="products-toolbar"><button class="small-btn" id="addProductGroupInlineBtn">+ Группа</button></div>
            <div class="warning-box">Товары не загружены. Если во вкладке «Премия» они есть, проверь правила Firestore для коллекции <b>products</b> и нажми «Обновить».</div>
        `;
        bindProductGroupButton();
        return;
    }

    box.innerHTML = `
        <div class="products-toolbar">
            <button class="small-btn" id="addProductGroupInlineBtn">+ Группа</button>
            <span class="hint">Группы создаются автоматически, когда ты добавляешь товар с новой группой.</span>
        </div>
        ${groups.map(group => {
            const groupProducts = products
                .filter(item => (String(item.group || "Без группы").trim() || "Без группы") === group)
                .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ru"));

            return `
                <div class="product-group-block">
                    <div class="product-group-head">
                        <div><strong>${escapeAttr(group)}</strong><span>${groupProducts.length} тов.</span></div>
                        <button class="small-btn" data-add-product-to-group="${escapeAttr(group)}">+ Товар</button>
                    </div>
                    <div class="product-compact-list">${groupProducts.map(item => productTemplate(item, groups)).join("")}</div>
                </div>
            `;
        }).join("")}
    `;

    bindProductGroupButton();
}

function bindProductGroupButton() {
    const btn = $("addProductGroupInlineBtn");
    if (!btn) return;

    btn.onclick = () => {
        const group = prompt("Название новой группы:");
        if (!group || !group.trim()) return;

        collectProductsFromForm();
        products.push({ id: "", code: "", name: "Новый товар", group: group.trim(), bonus: 0, plan: 0, sold: 0 });
        renderProducts();
    };
}

function productTemplate(item = {}, groups = []) {
    const cleanGroup = String(item.group || "Без группы").trim() || "Без группы";
    const groupOptions = groups.map(group => `
        <option value="${escapeAttr(group)}" ${group === cleanGroup ? "selected" : ""}>${escapeAttr(group)}</option>
    `).join("");

    return `
        <div class="editor-card product-card-compact" data-product data-id="${escapeAttr(item.id || "")}">
            <div class="product-row-main">
                <input class="product-code-input" data-product-code placeholder="Код" value="${escapeAttr(item.code || "")}">
                <input class="product-name-input" data-product-name placeholder="Название" value="${escapeAttr(item.name || "")}">
                <select data-product-group>${groupOptions}</select>
                <input type="number" data-product-bonus placeholder="Бонус" value="${escapeAttr(item.bonus ?? 0)}">
                <input type="number" data-product-plan placeholder="План" value="${escapeAttr(item.plan ?? 0)}">
                <input type="number" data-product-sold placeholder="Продано" value="${escapeAttr(item.sold ?? 0)}">
                <button class="danger-btn compact-delete" data-remove-product>Удалить</button>
            </div>
        </div>
    `;
}

async function loadSiteData() {
    try {
        const snap = await withTimeout(fb.getDoc(fb.doc(db, "site", "main")));
        data = snap.exists() ? normalizeSiteData(snap.data()) : clone(fallbackData);
        renderAll();
        setStatus("Данные сайта загружены.", "ok");
    } catch (error) {
        console.error(error);
        data = clone(fallbackData);
        renderAll();
        setStatus("Данные сайта не загрузились. Оставил локальный шаблон.", "error");
    }
}

async function loadProducts() {
    if (!db) {
        products = [];
        renderProducts();
        return;
    }

    try {
        const snap = await withTimeout(fb.getDocs(fb.collection(db, "products")));
        products = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) =>
                String(a.group || "").localeCompare(String(b.group || ""), "ru") ||
                String(a.name || "").localeCompare(String(b.name || ""), "ru")
            );

        deletedProductIds = [];
        renderProducts();
        setStatus(`Товары загружены: ${products.length}.`, "ok");
    } catch (error) {
        console.error(error);
        products = [];
        renderProducts();
        setStatus("Товары из products не загрузились. Проверь правила Firestore.", "error");
    }
}

async function loadData() {
    setStatus("Загрузка данных…");
    const ready = await initFirebase();

    if (!ready) {
        data = clone(fallbackData);
        renderAll();
        renderProducts();
        return;
    }

    await loadSiteData();
    await loadProducts();
}

async function saveData() {
    collectDataFromForm();
    collectProductsFromForm();

    if (!db) {
        setStatus("Сохранение недоступно: проверь firebase-config.js.", "error");
        return;
    }

    try {
        const siteData = prepareSiteDataForFirestore(data);
        await fb.setDoc(fb.doc(db, "site", "main"), siteData, { merge: true });

        for (const id of deletedProductIds) {
            await fb.deleteDoc(fb.doc(db, "products", id));
        }

        for (const item of products) {
            const clean = {
                code: item.code || "",
                name: item.name,
                group: item.group,
                bonus: item.bonus,
                plan: item.plan,
                sold: item.sold
            };

            if (item.id) {
                await fb.setDoc(fb.doc(db, "products", item.id), clean, { merge: true });
            } else {
                await fb.addDoc(fb.collection(db, "products"), clean);
            }
        }

        deletedProductIds = [];
        setStatus("Сохранено в Firebase. Обнови сайт и вкладку премии.", "ok");
        await loadProducts();
    } catch (error) {
        console.error(error);
        setStatus("Ошибка сохранения: " + (error.message || "проверь правила Firestore"), "error");
    }
}

function bindEvents() {
    document.querySelectorAll(".admin-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            collectDataFromForm();
            collectProductsFromForm();

            document.querySelectorAll(".admin-tab").forEach(x => x.classList.remove("active"));
            document.querySelectorAll(".admin-panel").forEach(x => x.classList.remove("active"));

            btn.classList.add("active");
            const panel = $(`tab-${btn.dataset.tab}`);
            if (panel) panel.classList.add("active");
        });
    });

    if ($("saveBtn")) $("saveBtn").onclick = saveData;
    if ($("reloadBtn")) $("reloadBtn").onclick = loadData;

    if ($("addCalculatorBtn")) {
        $("addCalculatorBtn").onclick = () => {
            collectDataFromForm();
            data.calculators.push({ title: "КАЛЬКУЛЯТОР РАССРОЧКИ", bank: "НОВЫЙ БАНК", rows: [["3 мес.", 0.95]] });
            renderAll();
        };
    }

    if ($("addMenuBtn")) {
        $("addMenuBtn").onclick = () => {
            collectDataFromForm();
            data.menu.push({ href: "#", icon: "🔗", title: "Новая карточка", desc: "Описание" });
            renderAll();
        };
    }

    if ($("addUserBtn")) {
        $("addUserBtn").onclick = () => {
            collectDataFromForm();
            data.users[`user${Object.keys(data.users).length + 1}`] = { name: "Новый пользователь", pass: "0000", manager: false };
            renderAll();
        };
    }

    if ($("addProductBtn")) {
        $("addProductBtn").onclick = () => {
            collectProductsFromForm();
            const groups = getProductGroups();
            products.push({ id: "", code: "", name: "Новый товар", group: groups[0] || "Новая группа", bonus: 0, plan: 0, sold: 0 });
            renderProducts();
        };
    }

    if ($("applyJsonBtn")) {
        $("applyJsonBtn").onclick = () => {
            try {
                data = normalizeSiteData(JSON.parse($("jsonEditor").value));
                renderAll();
                setStatus("JSON применён. Теперь можно сохранить в Firebase.", "ok");
            } catch {
                setStatus("Ошибка в JSON. Проверь запятые и кавычки.", "error");
            }
        };
    }

    document.body.addEventListener("click", (e) => {
        if (e.target.matches("[data-remove-calc]")) {
            e.target.closest("[data-calc]").remove();
            collectDataFromForm();
            renderAll();
        }

        if (e.target.matches("[data-add-row]")) {
            e.target.previousElementSibling.insertAdjacentHTML("beforeend", rowTemplate());
        }

        if (e.target.matches("[data-remove-row]")) {
            e.target.closest("[data-calc-row]").remove();
            collectDataFromForm();
        }

        if (e.target.matches("[data-remove-menu]")) {
            e.target.closest("[data-menu]").remove();
            collectDataFromForm();
            renderAll();
        }

        if (e.target.matches("[data-remove-user]")) {
            e.target.closest("[data-user]").remove();
            collectDataFromForm();
            renderAll();
        }

        if (e.target.matches("[data-add-product-to-group]")) {
            collectProductsFromForm();
            products.push({ id: "", code: "", name: "Новый товар", group: e.target.dataset.addProductToGroup || "Новая группа", bonus: 0, plan: 0, sold: 0 });
            renderProducts();
        }

        if (e.target.matches("[data-remove-product]")) {
            const card = e.target.closest("[data-product]");
            if (card.dataset.id) deletedProductIds.push(card.dataset.id);
            card.remove();
            collectProductsFromForm();
            renderProducts();
        }
    });
}

bindEvents();
loadData();
