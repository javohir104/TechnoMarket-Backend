# Telefon Market — Backend (Node.js + Express + MongoDB)

Telefon internet-do'koni API'si: mahsulotlar, ombor, buyurtmalar, admin va foyda hisobi.

## Ishga tushirish
1. Node.js 18+ o'rnating.
2. `cp .env.example .env` va qiymatlarni to'ldiring (`MONGODB_URI`, `ACCESS_TOKEN_SECRET` majburiy).
3. `npm install`
4. Eski ma'lumotingiz bo'lsa, **bir marta**: `npm run migrate`
5. `npm start` → `http://localhost:3000/api/health`

### Birinchi administrator
1. Frontendda oddiy foydalanuvchi sifatida ro'yxatdan o'ting (parol kamida 8 belgi).
2. `npm run make-admin -- sizning@email.uz`
Ommaviy ro'yxatdan o'tish **hech qachon** admin yarata olmaydi.

### Namuna ma'lumot
`npm run seed:products` — 6 ta namuna telefon (`isDemo`, tannarxsiz). Ishga tushirishdan oldin `npm run clear-demo`.

## Testlar
`npm test` — haqiqiy MongoDB kerak (alohida test bazasi!). Standart: `mongodb://127.0.0.1:27017/tm_test`,
boshqa bo'lsa `TEST_MONGODB_URI=... npm test`. **Test har safar bazani tozalaydi — Atlas ishchi bazangizni bermang.**

## API qisqacha
Ommaviy: `GET /products` (filtrlar: q, type, condition, brand, storage, color, minPrice, maxPrice, inStock, sort=newest|price_asc|price_desc|popular, page, limit; jami soni `X-Total-Count` sarlavhasida), `GET /products/meta`, `GET /products/:id`, `POST /orders`, `GET /orders/track?orderNumber=&phone=`, `POST /auth/register|login|google`, `GET /auth/me`.

Admin (Bearer token + `role: admin`, har so'rovda bazadan tekshiriladi):
`/admin/products` (CRUD), `/admin/orders` (ro'yxat, `PATCH :id/status`, `PATCH :id/costs`), `/admin/finance/report`, `/admin/finance/expenses`, `/admin/uploads`.

## Buyurtma holatlari
`new → confirmed → shipped → delivered`; bekor qilish (`cancelled`) yetkazishdan oldin; `delivered → returned`.
Buyurtma yaratilganda ombor atomik kamayadi (ikki mijoz oxirgi telefonni ola olmaydi); bekor qilinsa qaytadi.

## Foyda hisobi (muhim)
- **Tushum ≠ foyda.** Tushum yetkazilgan kunda hisoblanadi.
- Har buyurtma narx va **tannarx snapshot**'ini saqlaydi — keyin mahsulot narxi o'zgarsa ham eski foyda o'zgarmaydi.
- Qaytarilgan buyurtma: tushum qaytariladi, omborga qaytgan telefon tannarxi tiklanadi, qo'shimcha zarar (`returnLoss`) yoziladi.
- Bekor qilingan buyurtmaga ketgan xarajat — zarar.
- `Sof foyda = Sof tushum − Sof tannarx − buyurtma xarajatlari (yetkazish, qadoqlash) − zararlar − umumiy xarajatlar (reklama, ijara…)`.
- Buyurtma xarajatlarini (yetkazish/qadoqlash) buyurtma ichida kiriting, umumiy xarajatlarni (reklama va h.k.) `expenses`da — **ikkalasiga bir xil xarajatni yozmang.**
- Tannarxi kiritilmagan mahsulot sotilsa, hisobot `warnings.profitIsEstimate: true` qaytaradi.
- Vaqt zonasi: O'zbekiston (UTC+5).

## Xavfsizlik
helmet, CORS (faqat `CLIENT_ORIGIN`), rate limit (umumiy, `/auth`, `/orders`, `/admin`), zod validatsiya, bcrypt (12 raund), JWT (HS256), rasm imzosi (magic bytes) tekshiruvi, `nosniff`. Tannarx ommaviy API'ga chiqmaydi.

## Telegram
`TELEGRAM_BOT_TOKEN` va `TELEGRAM_CHAT_ID` to'ldirilsa, yangi buyurtmada adminlarga xabar boradi. Aks holda jim o'tkazib yuboriladi.

## To'lov (Click / Payme)
**Hozircha ulanmagan.** Faqat naqd to'lov (`paymentMethod: cash`). Ulash uchun rasmiy merchant ma'lumotlari kerak; buyurtmada `paymentMethod`/`paymentStatus` maydonlari tayyor.

## Deploy eslatmalari
- `TRUST_PROXY=true`, `CLIENT_ORIGIN`ni haqiqiy domen qiling, `NODE_ENV=production`.
- Yuklangan rasmlar `UPLOAD_DIR`da saqlanadi. Render/Railway'ning bepul diskida **fayllar o'chib ketadi** — doimiy disk (volume) yoki Cloudinary/S3 kerak.
