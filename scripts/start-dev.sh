#!/bin/bash
# =============================================================================
# Development Startup Script
# =============================================================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "=============================================="
echo "  Literature Aggregation System"
echo "  Starting Development Environment"
echo "=============================================="
echo -e "${NC}"

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    exit 1
fi

# Определяем команду docker-compose
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Переход в директорию проекта
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo -e "${YELLOW}Project directory: $PROJECT_DIR${NC}"

# Проверка .env файла
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    cp .env.example .env
fi

# Запуск инфраструктуры
echo -e "\n${BLUE}[1/3] Starting infrastructure services...${NC}"
$DOCKER_COMPOSE up -d postgres minio meilisearch

echo -e "\n${YELLOW}Waiting for services to be healthy...${NC}"
sleep 5

# Ожидание готовности PostgreSQL
echo -e "${YELLOW}Waiting for PostgreSQL...${NC}"
until $DOCKER_COMPOSE exec -T postgres pg_isready -U literature_user > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}Ready!${NC}"

# Ожидание готовности MinIO
echo -e "${YELLOW}Waiting for MinIO...${NC}"
until curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}Ready!${NC}"

# Инициализация MinIO bucket
echo -e "\n${BLUE}[2/3] Initializing MinIO bucket...${NC}"
$DOCKER_COMPOSE up minio-init

# Запуск приложений
echo -e "\n${BLUE}[3/3] Starting application services...${NC}"
$DOCKER_COMPOSE up -d backend frontend

echo -e "\n${YELLOW}Waiting for applications to start...${NC}"
sleep 10

# Проверка статуса
echo -e "\n${GREEN}"
echo "=============================================="
echo "  Services Started Successfully!"
echo "=============================================="
echo -e "${NC}"
echo ""
echo -e "  ${BLUE}Frontend:${NC}      http://localhost:3000"
echo -e "  ${BLUE}Backend API:${NC}   http://localhost:8000"
echo -e "  ${BLUE}API Docs:${NC}      http://localhost:8000/docs"
echo -e "  ${BLUE}MinIO Console:${NC} http://localhost:9001"
echo -e "  ${BLUE}Meilisearch:${NC}   http://localhost:7700"
echo ""
echo -e "  ${YELLOW}MinIO Credentials:${NC}"
echo "    User:     minioadmin"
echo "    Password: minioadmin123"
echo ""
echo -e "${YELLOW}Commands:${NC}"
echo "  View logs:    $DOCKER_COMPOSE logs -f"
echo "  Stop all:     $DOCKER_COMPOSE down"
echo "  Stop + clean: $DOCKER_COMPOSE down -v"
echo ""
