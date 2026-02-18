# Руководство по развертыванию

## Система агрегации учебной литературы

Пошаговая инструкция по развертыванию проекта на локальной машине.

---

## Содержание

1. [Системные требования](#системные-требования)
2. [Предварительные требования](#предварительные-требования)
3. [Быстрый старт](#быстрый-старт)
4. [Детальная установка](#детальная-установка)
5. [Конфигурация](#конфигурация)
6. [Запуск приложения](#запуск-приложения)
7. [Проверка работоспособности](#проверка-работоспособности)
8. [Работа с базой данных](#работа-с-базой-данных)
9. [Устранение неполадок](#устранение-неполадок)
10. [Разработка](#разработка)

---

## Системные требования

### Минимальные требования:
- **CPU**: 2 ядра
- **RAM**: 4 GB
- **Диск**: 10 GB свободного места
- **ОС**: Linux, macOS, Windows 10/11 с WSL2

### Рекомендуемые требования:
- **CPU**: 4 ядра
- **RAM**: 8 GB
- **Диск**: 20 GB свободного места (SSD)

---

## Предварительные требования

### 1. Docker и Docker Compose

#### Linux (Ubuntu/Debian):
```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker

# Проверка установки
docker --version
docker compose version
```

#### macOS:
```bash
# Установка через Homebrew
brew install --cask docker

# Или скачайте Docker Desktop: https://www.docker.com/products/docker-desktop
```

#### Windows:
1. Установите [Docker Desktop для Windows](https://www.docker.com/products/docker-desktop)
2. Включите WSL2 backend в настройках Docker Desktop
3. Убедитесь, что WSL2 установлен: `wsl --install`

### 2. Git
```bash
# Linux
sudo apt install git

# macOS
brew install git

# Проверка
git --version
```

### 3. (Опционально) Make
```bash
# Linux
sudo apt install make

# macOS
brew install make
```

---

## Быстрый старт

Для быстрого запуска выполните следующие команды:

```bash
# 1. Клонируйте репозиторий
git clone <url-репозитория>
cd diplom

# 2. Создайте файл окружения
cp .env.example .env

# 3. Запустите все сервисы
docker compose up -d

# 4. Дождитесь запуска (около 2-3 минут)
docker compose logs -f backend

# 5. Откройте в браузере
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/docs
# MinIO Console: http://localhost:9001
# Meilisearch: http://localhost:7700
```

---

## Детальная установка

### Шаг 1: Клонирование репозитория

```bash
git clone <url-репозитория>
cd diplom
```

### Шаг 2: Настройка переменных окружения

```bash
# Копируем пример файла окружения
cp .env.example .env

# Редактируем файл (опционально)
nano .env  # или vim .env
```

### Шаг 3: Настройка .env файла

Откройте `.env` и настройте следующие параметры:

```env
# =============================================================================
# PostgreSQL - База данных
# =============================================================================
POSTGRES_USER=literature_user
POSTGRES_PASSWORD=literature_password  # Измените для production!
POSTGRES_DB=literature_db
POSTGRES_PORT=5432

# =============================================================================
# MinIO - Хранилище файлов
# =============================================================================
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123  # Измените для production!
MINIO_BUCKET=literature
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001

# =============================================================================
# Meilisearch - Полнотекстовый поиск
# =============================================================================
MEILI_MASTER_KEY=masterKey123  # Измените для production!
MEILI_ENV=development
MEILI_PORT=7700

# =============================================================================
# Backend - FastAPI
# =============================================================================
# Генерация ключа: openssl rand -hex 32
SECRET_KEY=your-secret-key-change-in-production-use-openssl-rand-hex-32
DEBUG=true
BACKEND_PORT=8000

# =============================================================================
# Frontend - React
# =============================================================================
FRONTEND_PORT=3000
VITE_API_URL=http://localhost:8000

# =============================================================================
# Redis / Celery - Фоновые задачи
# =============================================================================
REDIS_PORT=6379

# =============================================================================
# External APIs (опционально)
# =============================================================================
# Google Books API key: https://developers.google.com/books/docs/v1/using
GOOGLE_BOOKS_API_KEY=
```

### Шаг 4: Сборка и запуск контейнеров

```bash
# Сборка образов (первый запуск)
docker compose build

# Запуск всех сервисов в фоновом режиме
docker compose up -d

# Просмотр логов всех сервисов
docker compose logs -f

# Или логи конкретного сервиса
docker compose logs -f backend
docker compose logs -f frontend
```

### Шаг 5: Инициализация базы данных

База данных инициализируется автоматически при первом запуске. Если необходимо выполнить миграции вручную:

```bash
# Вход в контейнер backend
docker compose exec backend bash

# Выполнение миграций Alembic
alembic upgrade head

# Выход из контейнера
exit
```

---

## Конфигурация

### Порты сервисов

| Сервис | Порт | Описание |
|--------|------|----------|
| Frontend | 3000 | React приложение |
| Backend | 8000 | FastAPI API |
| PostgreSQL | 5432 | База данных |
| MinIO API | 9000 | S3-совместимое хранилище |
| MinIO Console | 9001 | Веб-интерфейс MinIO |
| Meilisearch | 7700 | Поисковый движок |
| Redis | 6379 | Message broker |

### Volumes (постоянные данные)

```yaml
postgres_data      # Данные PostgreSQL
minio_data         # Файлы пользователей
meilisearch_data   # Поисковые индексы
redis_data         # Данные Redis
```

---

## Запуск приложения

### Основные команды

```bash
# Запуск всех сервисов
docker compose up -d

# Остановка всех сервисов
docker compose down

# Остановка с удалением volumes (ОСТОРОЖНО: удалит все данные!)
docker compose down -v

# Перезапуск конкретного сервиса
docker compose restart backend

# Пересборка и перезапуск
docker compose up -d --build backend
```

### Использование Makefile (если установлен make)

```bash
make up        # Запуск
make down      # Остановка
make logs      # Просмотр логов
make rebuild   # Пересборка
make clean     # Полная очистка
```

---

## Проверка работоспособности

### 1. Проверка статуса контейнеров

```bash
docker compose ps
```

Все сервисы должны иметь статус `Up (healthy)`:

```
NAME                    STATUS
literature_backend      Up (healthy)
literature_frontend     Up (healthy)
literature_db           Up (healthy)
literature_minio        Up (healthy)
literature_search       Up (healthy)
literature_redis        Up (healthy)
literature_celery_worker Up
literature_celery_beat   Up
```

### 2. Проверка API

```bash
# Health check
curl http://localhost:8000/health

# Ожидаемый ответ:
# {"status":"healthy","service":"Literature Aggregation System","version":"1.0.0"}
```

### 3. Доступ к веб-интерфейсам

| Интерфейс | URL | Описание |
|-----------|-----|----------|
| Frontend | http://localhost:3000 | Основное приложение |
| API Docs | http://localhost:8000/docs | Swagger UI |
| ReDoc | http://localhost:8000/redoc | Альтернативная документация |
| MinIO | http://localhost:9001 | Управление файлами |
| Meilisearch | http://localhost:7700 | Поисковый движок |

### 4. Тестовая загрузка файла

1. Откройте http://localhost:3000
2. Перейдите на страницу "Загрузить"
3. Загрузите PDF или EPUB файл
4. Проверьте появление книги в библиотеке

---

## Работа с базой данных

### Подключение к PostgreSQL

```bash
# Через docker compose
docker compose exec postgres psql -U literature_user -d literature_db

# Или напрямую
psql -h localhost -p 5432 -U literature_user -d literature_db
```

### Полезные SQL запросы

```sql
-- Количество книг
SELECT COUNT(*) FROM books;

-- Количество пользователей
SELECT COUNT(*) FROM users;

-- Последние загруженные книги
SELECT id, title, author, created_at
FROM books
ORDER BY created_at DESC
LIMIT 10;

-- Статистика по категориям
SELECT category, COUNT(*) as count
FROM books
WHERE category IS NOT NULL
GROUP BY category
ORDER BY count DESC;
```

### Миграции Alembic

```bash
# Создание новой миграции
docker compose exec backend alembic revision --autogenerate -m "Описание миграции"

# Применение миграций
docker compose exec backend alembic upgrade head

# Откат последней миграции
docker compose exec backend alembic downgrade -1

# Просмотр истории миграций
docker compose exec backend alembic history
```

---

## Устранение неполадок

### Проблема: Контейнер не запускается

```bash
# Проверьте логи
docker compose logs <service_name>

# Проверьте использование ресурсов
docker stats

# Пересоберите образ
docker compose build --no-cache <service_name>
```

### Проблема: Backend не может подключиться к PostgreSQL

```bash
# Проверьте, что PostgreSQL запущен и healthy
docker compose ps postgres

# Проверьте логи PostgreSQL
docker compose logs postgres

# Проверьте сеть
docker network ls
docker network inspect diplom_literature_network
```

### Проблема: Frontend не может подключиться к Backend

1. Проверьте значение `VITE_API_URL` в `.env`
2. Убедитесь, что backend доступен: `curl http://localhost:8000/health`
3. Проверьте CORS настройки в backend

### Проблема: MinIO bucket не создается

```bash
# Проверьте логи minio-init
docker compose logs minio-init

# Создайте bucket вручную
docker compose exec minio mc mb local/literature
```

### Проблема: Meilisearch индексы не создаются

```bash
# Проверьте логи backend при запуске
docker compose logs backend | grep -i meilisearch

# Проверьте здоровье Meilisearch
curl http://localhost:7700/health

# Перезапустите backend
docker compose restart backend
```

### Очистка и переустановка

```bash
# Остановка всех контейнеров
docker compose down

# Удаление всех volumes (ВНИМАНИЕ: удалит все данные!)
docker compose down -v

# Удаление неиспользуемых образов
docker image prune -a

# Полная пересборка
docker compose build --no-cache
docker compose up -d
```

---

## Разработка

### Hot Reload

Код автоматически перезагружается при изменениях:
- **Backend**: Папка `backend/app/` примонтирована к контейнеру
- **Frontend**: Папка `frontend/src/` примонтирована к контейнеру

### Запуск тестов

```bash
# Backend тесты
docker compose exec backend pytest

# С покрытием
docker compose exec backend pytest --cov=app

# Конкретный тест
docker compose exec backend pytest tests/test_books.py -v
```

### Линтинг и форматирование

```bash
# Backend
docker compose exec backend black app/
docker compose exec backend isort app/
docker compose exec backend mypy app/

# Frontend
docker compose exec frontend npm run lint
```

### Локальная разработка без Docker

#### Backend:

```bash
cd backend

# Создание виртуального окружения
python -m venv venv
source venv/bin/activate  # Linux/macOS
# или: venv\Scripts\activate  # Windows

# Установка зависимостей
pip install -r requirements.txt

# Настройка переменных окружения
export DATABASE_URL=postgresql+asyncpg://literature_user:literature_password@localhost:5432/literature_db
export MINIO_ENDPOINT=localhost:9000
export MEILI_URL=http://localhost:7700

# Запуск
uvicorn app.main:app --reload --port 8000
```

#### Frontend:

```bash
cd frontend

# Установка зависимостей
npm install

# Настройка переменных окружения
echo "VITE_API_URL=http://localhost:8000" > .env.local

# Запуск
npm run dev
```

---

## Структура проекта

```
diplom/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/               # API endpoints
│   │   │   └── endpoints/     # Отдельные роутеры
│   │   ├── core/              # Конфигурация
│   │   ├── crud/              # CRUD операции
│   │   ├── models/            # SQLAlchemy модели
│   │   ├── schemas/           # Pydantic схемы
│   │   ├── services/          # Бизнес-логика
│   │   ├── tasks/             # Celery задачи
│   │   └── main.py            # Точка входа
│   ├── alembic/               # Миграции БД
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # React компоненты
│   │   ├── pages/             # Страницы
│   │   ├── services/          # API сервисы
│   │   ├── types/             # TypeScript типы
│   │   └── App.tsx            # Главный компонент
│   ├── package.json
│   └── Dockerfile
│
├── nginx/                      # Nginx конфигурация
├── scripts/                    # Вспомогательные скрипты
├── docker-compose.yml          # Docker Compose
├── .env.example               # Пример конфигурации
├── Makefile                   # Make команды
└── README.md                  # Документация
```

---

## API Документация

После запуска приложения, документация API доступна по адресам:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

### Основные эндпоинты:

| Метод | Путь | Описание |
|-------|------|----------|
| POST | /api/auth/register | Регистрация пользователя |
| POST | /api/auth/login | Авторизация |
| GET | /api/books | Список книг |
| POST | /api/books | Загрузка книги |
| GET | /api/books/{id} | Получение книги |
| GET | /api/books/{id}/file/stream | Стриминг файла |
| GET | /api/search | Полнотекстовый поиск |
| GET | /api/search/suggest | Автодополнение |
| GET | /api/external/search | Поиск во внешних источниках |
| POST | /api/external/import | Импорт внешней книги |

---

## Полезные ссылки

- [FastAPI документация](https://fastapi.tiangolo.com/)
- [React документация](https://react.dev/)
- [Meilisearch документация](https://www.meilisearch.com/docs)
- [MinIO документация](https://min.io/docs/minio/linux/index.html)
- [Docker Compose документация](https://docs.docker.com/compose/)

---

## Поддержка

При возникновении проблем:

1. Проверьте раздел [Устранение неполадок](#устранение-неполадок)
2. Просмотрите логи: `docker compose logs -f`
3. Создайте issue в репозитории проекта
