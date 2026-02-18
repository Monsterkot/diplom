# =============================================================================
# Makefile для управления проектом Literature Aggregation System
# =============================================================================

.PHONY: help start stop restart logs clean build shell-backend shell-frontend db-migrate db-upgrade

# Определение docker-compose команды
DOCKER_COMPOSE := $(shell command -v docker-compose 2> /dev/null || echo "docker compose")

# Цвета
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m

help: ## Показать справку
	@echo ""
	@echo "$(BLUE)Literature Aggregation System - Доступные команды:$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

# =============================================================================
# Основные команды
# =============================================================================

start: ## Запустить все сервисы
	@echo "$(BLUE)Starting all services...$(NC)"
	$(DOCKER_COMPOSE) up -d
	@echo "$(GREEN)Services started!$(NC)"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend:  http://localhost:8000"

stop: ## Остановить все сервисы
	@echo "$(YELLOW)Stopping all services...$(NC)"
	$(DOCKER_COMPOSE) down

restart: stop start ## Перезапустить все сервисы

logs: ## Показать логи всех сервисов
	$(DOCKER_COMPOSE) logs -f

logs-backend: ## Показать логи backend
	$(DOCKER_COMPOSE) logs -f backend

logs-frontend: ## Показать логи frontend
	$(DOCKER_COMPOSE) logs -f frontend

# =============================================================================
# Разработка
# =============================================================================

dev: ## Запустить в режиме разработки (с hot reload)
	@./scripts/start-dev.sh

build: ## Пересобрать все образы
	@echo "$(BLUE)Building all images...$(NC)"
	$(DOCKER_COMPOSE) build --no-cache

build-backend: ## Пересобрать backend
	$(DOCKER_COMPOSE) build --no-cache backend

build-frontend: ## Пересобрать frontend
	$(DOCKER_COMPOSE) build --no-cache frontend

# =============================================================================
# Доступ к контейнерам
# =============================================================================

shell-backend: ## Открыть shell в backend контейнере
	$(DOCKER_COMPOSE) exec backend /bin/bash

shell-frontend: ## Открыть shell в frontend контейнере
	$(DOCKER_COMPOSE) exec frontend /bin/sh

shell-db: ## Открыть psql в PostgreSQL
	$(DOCKER_COMPOSE) exec postgres psql -U literature_user -d literature_db

# =============================================================================
# База данных
# =============================================================================

db-migrate: ## Создать новую миграцию (usage: make db-migrate name="migration_name")
	$(DOCKER_COMPOSE) exec backend alembic revision --autogenerate -m "$(name)"

db-upgrade: ## Применить миграции
	$(DOCKER_COMPOSE) exec backend alembic upgrade head

db-downgrade: ## Откатить последнюю миграцию
	$(DOCKER_COMPOSE) exec backend alembic downgrade -1

db-reset: ## Сбросить базу данных (ОПАСНО!)
	@echo "$(YELLOW)WARNING: This will delete all data!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	$(DOCKER_COMPOSE) down -v
	$(DOCKER_COMPOSE) up -d postgres
	@sleep 5
	$(DOCKER_COMPOSE) up -d backend
	@sleep 5
	$(DOCKER_COMPOSE) exec backend alembic upgrade head

# =============================================================================
# Тестирование
# =============================================================================

test: ## Запустить тесты backend
	$(DOCKER_COMPOSE) exec backend pytest -v

test-cov: ## Запустить тесты с coverage
	$(DOCKER_COMPOSE) exec backend pytest --cov=app --cov-report=html

lint: ## Проверить код (black, isort)
	$(DOCKER_COMPOSE) exec backend black --check app/
	$(DOCKER_COMPOSE) exec backend isort --check-only app/

format: ## Форматировать код
	$(DOCKER_COMPOSE) exec backend black app/
	$(DOCKER_COMPOSE) exec backend isort app/

# =============================================================================
# Очистка
# =============================================================================

clean: ## Остановить и удалить контейнеры
	$(DOCKER_COMPOSE) down --remove-orphans

clean-volumes: ## Удалить все данные (volumes)
	@echo "$(YELLOW)WARNING: This will delete all data including database!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	$(DOCKER_COMPOSE) down -v --remove-orphans

clean-all: ## Полная очистка (images, volumes, networks)
	@echo "$(YELLOW)WARNING: This will delete everything!$(NC)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	$(DOCKER_COMPOSE) down -v --rmi all --remove-orphans

# =============================================================================
# Production
# =============================================================================

prod: ## Запустить с nginx (production profile)
	$(DOCKER_COMPOSE) --profile production up -d

prod-stop: ## Остановить production
	$(DOCKER_COMPOSE) --profile production down

# =============================================================================
# Статус
# =============================================================================

status: ## Показать статус сервисов
	$(DOCKER_COMPOSE) ps

health: ## Проверить health всех сервисов
	@echo "$(BLUE)Checking service health...$(NC)"
	@curl -sf http://localhost:8000/health && echo "$(GREEN)Backend: OK$(NC)" || echo "$(YELLOW)Backend: Not available$(NC)"
	@curl -sf http://localhost:3000 > /dev/null && echo "$(GREEN)Frontend: OK$(NC)" || echo "$(YELLOW)Frontend: Not available$(NC)"
	@curl -sf http://localhost:9000/minio/health/live && echo "$(GREEN)MinIO: OK$(NC)" || echo "$(YELLOW)MinIO: Not available$(NC)"
	@curl -sf http://localhost:7700/health && echo "$(GREEN)Meilisearch: OK$(NC)" || echo "$(YELLOW)Meilisearch: Not available$(NC)"
