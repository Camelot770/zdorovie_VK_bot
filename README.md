# Здоровье семьи — VK Mini App

Мини-приложение для записи на приём в клинику «Здоровье семьи» через ВКонтакте.

Параллельная версия MAX-мини-приложения, работает на том же бекенде.

## Стек

- **React 18** + **TypeScript** + **Vite**
- **VK Bridge** (`@vkontakte/vk-bridge`) — взаимодействие с хостом ВК
- **Tailwind CSS** + **lucide-react** — UI
- **Zustand** — глобальное состояние
- **React Router v7** — навигация

## Авторизация

В отличие от MAX-версии (где используется `requestContact`), здесь привязка пациента
работает через **SMS-код**:

1. Юзер открывает мини-приложение в сообществе VK
2. Получает `vk_user_id` из launch-параметров (`?vk_user_id=...`)
3. На странице профиля вводит свой телефон
4. Бекенд отправляет SMS с 4-значным кодом через SMS.RU
5. Юзер вводит код, бекенд проверяет и привязывает к пациенту в 1С

Backend endpoints:
- `POST /api/auth/sms/send` — генерирует код и шлёт SMS
- `POST /api/auth/sms/verify` — проверяет код, привязывает к 1С пациенту
- `GET /api/auth/patient/{vk_user_id}?source=vk` — получить привязанную карту
- `GET /api/auth/patients/{vk_user_id}?source=vk` — все привязанные карты

## Локальный запуск

```bash
npm install
npm run dev
```

Откроется http://localhost:5173. Для теста без ВК:
```
http://localhost:5173?vk_user_id=12345&userId=12345
```

## Деплой

```bash
npm run build
```

Артефакт собирается в `dist/`. Деплоится на Vercel.

## Переменные окружения

```env
VITE_API_URL=https://your-amvera-backend.amvera.io/api
```

## Настройка VK Mini App

В кабинете VK для разработчиков (https://dev.vk.com/admin):

1. Создать новое мини-приложение, привязать к сообществу клиники
2. Указать URL фронта (Vercel)
3. Платформы: Mobile + Web
4. Запросить scope `phone` (опционально, если нужен авто-получение номера)

## Структура

```
src/
├── api/client.ts         — HTTP клиент (с GET-кэшем 5 мин)
├── components/           — переиспользуемые UI-компоненты
├── hooks/                — useAuth, useApi, usePullToRefresh
├── pages/                — экраны
│   ├── MainPage          — главный
│   ├── BookingWizardPage — мастер записи
│   ├── ConfirmPage       — подтверждение
│   ├── ProfilePage       — профиль + SMS-привязка
│   ├── MyRecordsPage     — список записей
│   └── ...
├── services/vkBridge.ts  — обёртка над VK Bridge
├── store/                — Zustand-сторы (auth, booking, favorites)
├── types/                — TypeScript типы
└── utils/prices.ts       — расчёт цен консультаций
```

## Различия с MAX-версией

| Что | MAX | VK |
|-----|-----|-----|
| Bridge | `window.WebApp` (max-web-app.js) | `@vkontakte/vk-bridge` |
| User ID | `initData` HMAC-валидация | `?vk_user_id=` из launch-params |
| Авторизация | `requestContact` (нативный диалог) | SMS-код через SMS.RU |
| Закрытие | `WebApp.close()` | `VKWebAppClose` |
| Haptic | `WebApp.HapticFeedback.*` | `VKWebAppTapticImpactOccurred` |
| Back button | `WebApp.BackButton` | встроен в хост |
