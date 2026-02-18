#!/bin/bash
# Script to initialize MinIO bucket

set -e

echo "Waiting for MinIO to be ready..."
sleep 5

# Install mc (MinIO Client) if not present
if ! command -v mc &> /dev/null; then
    echo "Installing MinIO Client..."
    curl -O https://dl.min.io/client/mc/release/linux-amd64/mc
    chmod +x mc
    sudo mv mc /usr/local/bin/
fi

# Configure mc alias
mc alias set myminio http://localhost:9000 ${MINIO_ROOT_USER:-minioadmin} ${MINIO_ROOT_PASSWORD:-minioadmin123}

# Create bucket if not exists
mc mb --ignore-existing myminio/${MINIO_BUCKET:-literature}

# Set bucket policy to allow downloads
mc anonymous set download myminio/${MINIO_BUCKET:-literature}

echo "MinIO bucket initialized successfully!"
