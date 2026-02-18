"""
MinIO storage service for file operations.
"""
import uuid
import io
from datetime import timedelta
from typing import BinaryIO
from minio import Minio
from minio.error import S3Error
from fastapi import UploadFile, HTTPException, status
from loguru import logger

from app.core.config import settings


class StorageService:
    """Service for interacting with MinIO object storage."""

    def __init__(self):
        self._client: Minio | None = None

    @property
    def client(self) -> Minio:
        """Lazy initialization of MinIO client."""
        if self._client is None:
            self._client = Minio(
                endpoint=settings.minio_endpoint,
                access_key=settings.minio_access_key,
                secret_key=settings.minio_secret_key,
                secure=settings.minio_secure,
            )
        return self._client

    async def ensure_bucket_exists(self) -> None:
        """Ensure the configured bucket exists."""
        try:
            if not self.client.bucket_exists(settings.minio_bucket):
                self.client.make_bucket(settings.minio_bucket)
                logger.info(f"Created bucket: {settings.minio_bucket}")
        except S3Error as e:
            logger.error(f"Failed to create bucket: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Storage service unavailable",
            )

    def _generate_object_name(self, filename: str, prefix: str = "books") -> str:
        """Generate unique object name with UUID."""
        file_ext = filename.rsplit(".", 1)[-1] if "." in filename else ""
        unique_id = uuid.uuid4().hex
        return f"{prefix}/{unique_id}.{file_ext}" if file_ext else f"{prefix}/{unique_id}"

    async def upload_file(
        self,
        file: UploadFile,
        prefix: str = "books",
    ) -> tuple[str, int]:
        """
        Upload a file to MinIO storage.

        Returns:
            Tuple of (object_name, file_size)
        """
        await self.ensure_bucket_exists()

        # Validate content type
        if file.content_type not in settings.allowed_file_types_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {file.content_type} is not allowed",
            )

        # Read file content
        content = await file.read()
        file_size = len(content)

        # Validate file size
        if file_size > settings.max_file_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds maximum allowed ({settings.max_file_size_mb}MB)",
            )

        # Generate unique object name
        object_name = self._generate_object_name(file.filename or "unknown", prefix)

        try:
            # Upload to MinIO
            self.client.put_object(
                bucket_name=settings.minio_bucket,
                object_name=object_name,
                data=io.BytesIO(content),
                length=file_size,
                content_type=file.content_type,
            )
            logger.info(f"Uploaded file: {object_name} ({file_size} bytes)")
            return object_name, file_size

        except S3Error as e:
            logger.error(f"Failed to upload file: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file",
            )

    async def upload_bytes(
        self,
        data: bytes,
        filename: str,
        content_type: str,
        prefix: str = "books",
    ) -> tuple[str, int]:
        """
        Upload bytes data to MinIO storage.

        Returns:
            Tuple of (object_name, file_size)
        """
        await self.ensure_bucket_exists()

        file_size = len(data)
        object_name = self._generate_object_name(filename, prefix)

        try:
            self.client.put_object(
                bucket_name=settings.minio_bucket,
                object_name=object_name,
                data=io.BytesIO(data),
                length=file_size,
                content_type=content_type,
            )
            logger.info(f"Uploaded file: {object_name} ({file_size} bytes)")
            return object_name, file_size

        except S3Error as e:
            logger.error(f"Failed to upload file: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file",
            )

    async def get_download_url(
        self,
        object_name: str,
        expires: timedelta = timedelta(hours=1),
    ) -> str:
        """
        Get presigned URL for downloading a file (internal use).

        Note: For browser access, use /api/books/{id}/file/stream endpoint.

        Args:
            object_name: The object path in storage
            expires: URL expiration time (default 1 hour)

        Returns:
            Presigned download URL (internal)
        """
        try:
            url = self.client.presigned_get_object(
                bucket_name=settings.minio_bucket,
                object_name=object_name,
                expires=expires,
            )
            return url
        except S3Error as e:
            logger.error(f"Failed to generate download URL: {e}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found",
            )

    async def delete_file(self, object_name: str) -> bool:
        """
        Delete a file from storage.

        Returns:
            True if deleted successfully
        """
        try:
            self.client.remove_object(
                bucket_name=settings.minio_bucket,
                object_name=object_name,
            )
            logger.info(f"Deleted file: {object_name}")
            return True
        except S3Error as e:
            logger.error(f"Failed to delete file: {e}")
            return False

    async def file_exists(self, object_name: str) -> bool:
        """Check if file exists in storage."""
        try:
            self.client.stat_object(
                bucket_name=settings.minio_bucket,
                object_name=object_name,
            )
            return True
        except S3Error:
            return False

    async def get_file(self, object_name: str) -> bytes:
        """
        Get file content from storage.

        Returns:
            File content as bytes
        """
        try:
            response = self.client.get_object(
                bucket_name=settings.minio_bucket,
                object_name=object_name,
            )
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            logger.error(f"Failed to get file: {e}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found",
            )


# Singleton instance
storage_service = StorageService()
