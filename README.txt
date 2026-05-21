Что изменено:
1. index.html — облегченная HTML-структура без большого CSS и без большого встроенного JS.
2. styles.css — весь CSS вынесен отдельно.
3. app.js — логика страницы, рендер новостей, калькуляторов, меню и подключение Firebase.
4. firebase-config.js — сюда вставить конфиг Firebase.
5. firestore-site-main.example.json — пример документа Firestore: site/main.

Firebase:
- Создай в Firestore коллекцию site и документ main.
- Перенеси туда данные из firestore-site-main.example.json.
- В firebase-config.js вставь свой firebaseConfig.

Важно:
Пароли в Firestore/JS — это не полноценная защита. Для настоящей безопасности лучше перевести вход на Firebase Authentication и правила Firestore.
