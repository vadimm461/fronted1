import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
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
        text: `Запускаем <b>Бонусный проект</b> — систему накопительных скидок.<br><br>
               Привязка клиента:<br>• по ФИО<br>• по номеру телефона<br><br>
               Все покупки сохраняются автоматически.`,
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

let appData = fallbackData;
let timerInterval = null;

const $ = (id) => document.getElementById(id);

async function loadData() {
    try {
        if (firebaseConfig.apiKey.includes("PASTE_")) return fallbackData;

        const firebaseApp = initializeApp(firebaseConfig);
        const db = getFirestore(firebaseApp);
        const snapshot = await getDoc(doc(db, "site", "main"));

        return snapshot.exists() ? { ...fallbackData, ...snapshot.data() } : fallbackData;
    } catch (error) {
        console.warn("Firebase недоступен, используется локальный fallback:", error);
        return fallbackData;
    }
}

function renderLoginUsers() {
    $("userSelect").innerHTML = Object.entries(appData.users)
        .map(([key, user]) => `<option value="${key}">${user.name}</option>`)
        .join("");
}

function renderNews() {
    $("newsContainer").innerHTML = `
        <div class="news-banner">
            <div class="news-left">
                <div class="news-badge">${appData.news.badge}</div>
                <div class="news-title">${appData.news.title}</div>
                <div class="news-text">${appData.news.text}</div>
            </div>
            <div class="news-timer">
                <div class="timer-label">СТАРТ ЧЕРЕЗ</div>
                <div class="days" id="days">--д 00:00:00</div>
            </div>
        </div>`;
}

function renderCalculators() {
    $("calculatorsContainer").innerHTML = appData.calculators.map(calc => `
        <div class="calculator">
            <div class="calc-title">${calc.title}</div>
            <div class="calc-subtitle">${calc.bank}</div>
            <input type="number" class="sum">
            <button class="btn btn-calc">РАССЧИТАТЬ</button>
            <table>
                ${calc.rows.map(([term, coef]) => `
                    <tr>
                        <td>${term}</td>
                        <td class="coef">${coef}</td>
                        <td class="result"></td>
                    </tr>`).join("")}
            </table>
        </div>`).join("");
}

function renderMenu(isManager = false) {
    $("menuGrid").innerHTML = appData.menu
        .filter(item => !item.managerOnly || isManager)
        .map(item => `
            <a href="${item.href}" class="menu-card" ${item.action ? `data-action="${item.action}"` : ""}>
                <div class="menu-icon">${item.icon}</div>
                <div class="menu-title">${item.title}</div>
                <div class="menu-desc">${item.desc}</div>
            </a>`).join("");
}

function bindCalculators() {
    document.querySelectorAll(".calculator").forEach(calc => {
        calc.querySelector(".btn-calc").onclick = () => {
            const sum = parseFloat(calc.querySelector(".sum").value);
            if (isNaN(sum)) return;

            calc.querySelectorAll(".coef").forEach((coef, i) => {
                const value = sum / parseFloat(coef.textContent);
                calc.querySelectorAll(".result")[i].textContent = value.toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            });
        };
    });
}

function bindMenu() {
    $("menuGrid").addEventListener("click", (event) => {
        const card = event.target.closest("[data-action='logout']");
        if (!card) return;
        event.preventDefault();
        logout();
    });
}

function login() {
    const userKey = $("userSelect").value;
    const user = appData.users[userKey];

    if ($("passwordInput").value !== user.pass) {
        $("errorMsg").textContent = "Неверный пароль";
        return;
    }

    const expire = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem("session", JSON.stringify({ key: userKey, name: user.name, manager: !!user.manager, expire }));
    openApp(user.name, !!user.manager);
}

function openApp(name, isManager = false) {
    $("loginScreen").style.display = "none";
    $("app").style.display = "block";
    $("currentUser").innerHTML = "👤 " + name;
    renderMenu(isManager);
}

function logout() {
    localStorage.removeItem("session");
    location.reload();
}

function updateTimer() {
    const endDate = new Date(appData.news.endDate).getTime();
    const diff = endDate - Date.now();
    const el = $("days");
    if (!el) return;

    if (diff <= 0) {
        el.innerHTML = "СТАРТ";
        return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    el.innerHTML = `${days}д ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startTimer() {
    clearInterval(timerInterval);
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

async function init() {
    appData = await loadData();

    renderLoginUsers();
    renderNews();
    renderCalculators();
    renderMenu(false);
    bindCalculators();
    bindMenu();
    startTimer();

    const session = JSON.parse(localStorage.getItem("session"));
    if (session && session.expire > Date.now()) openApp(session.name, !!session.manager);

    $("loginBtn").onclick = login;
    $("passwordInput").addEventListener("keyup", e => {
        if (e.key === "Enter") login();
    });
}

init();
