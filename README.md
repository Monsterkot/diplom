# Система агрегации учебной литературы

Дипломный проект: "Проектирование и реализация информационной системы для агрегации и анализа учебной литературы"

## Описание

Веб-приложение для:
- Агрегации электронной литературы из открытых API (Open Library, Project Gutenberg)
- Загрузки и хранения собственных файлов (PDF, EPUB, TXT, DOCX)
- Встроенного просмотра документов
- Полнотекстового поиска по библиотеке

## Технологический стек

| Компонент | Технология |
|-----------|------------|
| Backend | Python 3.11, FastAPI |
| Frontend | React 18, TypeScript, Vite |
| База данных | PostgreSQL 15 |
| Хранилище файлов | MinIO |
| Поиск | Meilisearch |
| Контейнеризация | Docker, Docker Compose |

## Структура проекта

```
diplom/
├── docker-compose.yml    # Конфигурация Docker
├── .env                  # Переменные окружения
├── backend/              # FastAPI приложение
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py       # Точка входа
│       ├── api/          # API endpoints
│       ├── core/         # Конфигурация
│       ├── models/       # SQLAlchemy модели
│       ├── schemas/      # Pydantic схемы
│       └── services/     # Бизнес-логика
├── frontend/             # React приложение
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── App.tsx
│       ├── components/   # React компоненты
│       ├── pages/        # Страницы
│       ├── services/     # API клиент
│       └── types/        # TypeScript типы
└── scripts/              # Вспомогательные скрипты
```

## Быстрый старт

### Требования

- Docker и Docker Compose
- Git

### Установка и запуск

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd diplom
```

2. Скопируйте файл переменных окружения:
```bash
cp .env.example .env
```

3. Запустите все сервисы:
```bash
docker-compose up -d
```

4. Дождитесь запуска всех контейнеров и откройте:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API документация: http://localhost:8000/docs
   - MinIO Console: http://localhost:9001
   - Meilisearch: http://localhost:7700

### Остановка

```bash
docker-compose down
```

Для удаления данных (volumes):
```bash
docker-compose down -v
```

## Разработка

### Backend (без Docker)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend (без Docker)

```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | /health | Проверка состояния |
| GET | /api/books | Список книг |
| GET | /api/books/{id} | Получить книгу |
| POST | /api/books | Создать книгу |
| DELETE | /api/books/{id} | Удалить книгу |
| POST | /api/files/upload | Загрузить файл |
| GET | /api/files/{id} | Скачать файл |
| GET | /api/search?q=... | Поиск |

## Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| POSTGRES_USER | Пользователь БД | literature_user |
| POSTGRES_PASSWORD | Пароль БД | literature_password |
| POSTGRES_DB | Имя БД | literature_db |
| MINIO_ROOT_USER | Пользователь MinIO | minioadmin |
| MINIO_ROOT_PASSWORD | Пароль MinIO | minioadmin123 |
| MEILI_MASTER_KEY | Ключ Meilisearch | masterKey123 |
| SECRET_KEY | Секретный ключ JWT | - |

## Лицензия

Дипломный проект - только для образовательных целей.
