"""
Enhanced file service for managing book files with MinIO storage.
"""
import io
import uuid
import mimetypes
from datetime import timedelta
from enum import Enum
from pathlib import Path
from typing import BinaryIO, NamedTuple
from urllib.parse import quote

from fastapi import HTTPException, UploadFile, status
from loguru import logger
from minio import Minio
from minio.error import S3Error

from app.core.config import settings


class FileType(str, Enum):
    """Supported file types."""
    PDF = "application/pdf"
    EPUB = "application/epub+zip"
    TXT = "text/plain"
    DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


class FileValidationResult(NamedTuple):
    """Result of file validation."""
    is_valid: bool
    error_message: str | None
    content_type: str | None
    file_size: int


class UploadResult(NamedTuple):
    """Result of file upload."""
    object_name: str
    file_size: int
    content_type: str
    original_filename: str


class FileInfo(NamedTuple):
    """File information from storage."""
    object_name: str
    file_size: int
    content_type: str
    last_modified: str | None


# File type configuration
ALLOWED_EXTENSIONS = {
    ".pdf": FileType.PDF,
    ".epub": FileType.EPUB,
    ".txt": FileType.TXT,
    ".docx": FileType.DOCX,
}

ALLOWED_MIME_TYPES = {
    FileType.PDF.value,
    FileType.EPUB.value,
    FileType.TXT.value,
    FileType.DOCX.value,
    "application/octet-stream",  # Fallback for some browsers
}

# Magic bytes for file type detection
# Note: ZIP-based formats (EPUB, DOCX) both start with PK\x03\x04
# For these, we rely on file extension for disambiguation
MAGIC_BYTES = {
    b"%PDF": FileType.PDF,
}


class FileService:
    """
    Service for managing book files with MinIO storage.

    Provides file upload, download, validation, and management capabilities.
    """

    def __init__(self):
        self._client: Minio | None = None
        self._bucket_checked = False

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
        """Ensure the configured bucket exists (cached)."""
        if self._bucket_checked:
            return

        try:
            if not self.client.bucket_exists(settings.minio_bucket):
                self.client.make_bucket(settings.minio_bucket)
                logger.info(f"Created bucket: {settings.minio_bucket}")
            self._bucket_checked = True
        except S3Error as e:
            logger.error(f"Failed to create/check bucket: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Storage service unavailable",
            )

    def _detect_content_type(self, content: bytes, filename: str) -> str:
        """
        Detect content type from file content and filename.

        Uses magic bytes for reliable detection, falls back to extension.
        For ZIP-based formats (EPUB, DOCX), relies on file extension.
        """
        # First check extension for ZIP-based formats (EPUB, DOCX)
        ext = Path(filename).suffix.lower()
        if ext in ALLOWED_EXTENSIONS:
            file_type = ALLOWED_EXTENSIONS[ext]
            # For ZIP-based formats, verify magic bytes
            if file_type in (FileType.EPUB, FileType.DOCX):
                if content.startswith(b"PK\x03\x04"):
                    return file_type.value
            # For PDF, verify magic bytes
            elif file_type == FileType.PDF:
                if content.startswith(b"%PDF"):
                    return file_type.value
            else:
                # TXT and other formats
                return file_type.value

        # Try magic bytes detection for PDF
        for magic, file_type in MAGIC_BYTES.items():
            if content.startswith(magic):
                return file_type.value

        # Fallback to extension-based detection
        if ext in ALLOWED_EXTENSIONS:
            return ALLOWED_EXTENSIONS[ext].value

        # Use mimetypes as last resort
        mime_type, _ = mimetypes.guess_type(filename)
        return mime_type or "application/octet-stream"

    def _generate_object_name(self, filename: str, prefix: str = "books") -> str:
        """Generate unique object name preserving original extension."""
        ext = Path(filename).suffix.lower() or ""
        unique_id = uuid.uuid4().hex
        return f"{prefix}/{unique_id}{ext}"

    def validate_file(
        self,
        content: bytes,
        filename: str,
        content_type: str | None = None,
    ) -> FileValidationResult:
        """
        Validate file content, size, and type.

        Args:
            content: File content as bytes
            filename: Original filename
            content_type: MIME type from upload (may be unreliable)

        Returns:
            FileValidationResult with validation status and detected type
        """
        file_size = len(content)

        # Check file size
        if file_size == 0:
            return FileValidationResult(
                is_valid=False,
                error_message="File is empty",
                content_type=None,
                file_size=0,
            )

        if file_size > settings.max_file_size_bytes:
            return FileValidationResult(
                is_valid=False,
                error_message=f"File size ({file_size / 1024 / 1024:.1f}MB) exceeds "
                             f"maximum allowed ({settings.max_file_size_mb}MB)",
                content_type=None,
                file_size=file_size,
            )

        # Detect actual content type
        detected_type = self._detect_content_type(content, filename)

        # Validate extension
        ext = Path(filename).suffix.lower()
        if ext and ext not in ALLOWED_EXTENSIONS:
            return FileValidationResult(
                is_valid=False,
                error_message=f"File extension '{ext}' is not allowed. "
                             f"Allowed: {', '.join(ALLOWED_EXTENSIONS.keys())}",
                content_type=detected_type,
                file_size=file_size,
            )

        # Validate content type
        if detected_type not in ALLOWED_MIME_TYPES:
            return FileValidationResult(
                is_valid=False,
                error_message=f"File type '{detected_type}' is not allowed. "
                             f"Allowed: PDF, EPUB, TXT, DOCX",
                content_type=detected_type,
                file_size=file_size,
            )

        return FileValidationResult(
            is_valid=True,
            error_message=None,
            content_type=detected_type,
            file_size=file_size,
        )

    async def upload_file(
        self,
        file: UploadFile,
        prefix: str = "books",
        validate: bool = True,
    ) -> UploadResult:
        """
        Upload a file to MinIO storage.

        Args:
            file: FastAPI UploadFile object
            prefix: Storage path prefix (e.g., "books", "covers")
            validate: Whether to validate file before upload

        Returns:
            UploadResult with storage path and metadata

        Raises:
            HTTPException: If validation fails or upload error occurs
        """
        await self.ensure_bucket_exists()

        # Read file content
        content = await file.read()
        filename = file.filename or "unknown"

        # Validate file
        if validate:
            validation = self.validate_file(content, filename, file.content_type)
            if not validation.is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=validation.error_message,
                )
            content_type = validation.content_type
            file_size = validation.file_size
        else:
            content_type = file.content_type or "application/octet-stream"
            file_size = len(content)

        # Generate unique object name
        object_name = self._generate_object_name(filename, prefix)

        try:
            # Upload to MinIO
            self.client.put_object(
                bucket_name=settings.minio_bucket,
                object_name=object_name,
                data=io.BytesIO(content),
                length=file_size,
                content_type=content_type,
            )
            logger.info(f"Uploaded file: {object_name} ({file_size} bytes, {content_type})")

            return UploadResult(
                object_name=object_name,
                file_size=file_size,
                content_type=content_type,
                original_filename=filename,
            )

        except S3Error as e:
            logger.error(f"Failed to upload file: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file to storage",
            )

    async def upload_bytes(
        self,
        data: bytes,
        filename: str,
        content_type: str,
        prefix: str = "books",
    ) -> UploadResult:
        """
        Upload raw bytes to MinIO storage.

        Args:
            data: File content as bytes
            filename: Original filename (for extension detection)
            content_type: MIME type
            prefix: Storage path prefix

        Returns:
            UploadResult with storage path and metadata
        """
        await self.ensure_bucket_exists()

        object_name = self._generate_object_name(filename, prefix)
        file_size = len(data)

        try:
            self.client.put_object(
                bucket_name=settings.minio_bucket,
                object_name=object_name,
                data=io.BytesIO(data),
                length=file_size,
                content_type=content_type,
            )
            logger.info(f"Uploaded bytes: {object_name} ({file_size} bytes)")

            return UploadResult(
                object_name=object_name,
                file_size=file_size,
                content_type=content_type,
                original_filename=filename,
            )

        except S3Error as e:
            logger.error(f"Failed to upload bytes: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file to storage",
            )

    async def download_file(self, object_name: str) -> tuple[bytes, str]:
        """
        Download file content from storage.

        Args:
            object_name: Object path in storage

        Returns:
            Tuple of (file_content, content_type)

        Raises:
            HTTPException: If file not found
        """
        try:
            response = self.client.get_object(
                bucket_name=settings.minio_bucket,
                object_name=object_name,
            )
            content = response.read()
            content_type = response.headers.get("Content-Type", "application/octet-stream")
            response.close()
            response.release_conn()

            logger.debug(f"Downloaded file: {object_name}")
            return content, content_type

        except S3Error as e:
            logger.error(f"Failed to download file {object_name}: {e}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found",
            )

    async def get_download_url(
        self,
        object_name: str,
        expires: timedelta = timedelta(hours=1),
        filename: str | None = None,
    ) -> str:
        """
        Generate presigned URL for downloading a file.

        Note: This generates internal URLs. For browser access, use the
        /api/books/{id}/file/stream endpoint instead.

        Args:
            object_name: Object path in storage
            expires: URL expiration time (default 1 hour)
            filename: Optional filename for Content-Disposition header

        Returns:
            Presigned download URL (internal)
        """
        try:
            # Build response headers for download
            response_headers = {}
            if filename:
                # Encode filename for Content-Disposition (RFC 5987)
                ascii_filename = filename.encode("ascii", errors="replace").decode("ascii").replace("?", "_")
                encoded_filename = quote(filename)
                response_headers["response-content-disposition"] = (
                    f"attachment; filename=\"{ascii_filename}\"; filename*=UTF-8''{encoded_filename}"
                )

            url = self.client.presigned_get_object(
                bucket_name=settings.minio_bucket,
                object_name=object_name,
                expires=expires,
                response_headers=response_headers if response_headers else None,
            )
            return url

        except S3Error as e:
            logger.error(f"Failed to generate download URL for {object_name}: {e}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found",
            )

    async def get_file_url(
        self,
        object_name: str,
        expires: timedelta = timedelta(hours=1),
    ) -> str:
        """
        Generate presigned URL for viewing/streaming a file (inline).

        Note: This generates internal URLs. For browser access, use the
        /api/books/{id}/file/stream endpoint instead.

        Args:
            object_name: Object path in storage
            expires: URL expiration time (default 1 hour)

        Returns:
            Presigned view URL (internal)
        """
        try:
            url = self.client.presigned_get_object(
                bucket_name=settings.minio_bucket,
                object_name=object_name,
                expires=expires,
            )
            return url

        except S3Error as e:
            logger.error(f"Failed to generate file URL for {object_name}: {e}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found",
            )

    async def delete_file(self, object_name: str) -> bool:
        """
        Delete a file from storage.

        Args:
            object_name: Object path in storage

        Returns:
            True if deleted successfully, False otherwise
        """
        try:
            self.client.remove_object(
                bucket_name=settings.minio_bucket,
                object_name=object_name,
            )
            logger.info(f"Deleted file: {object_name}")
            return True

        except S3Error as e:
            logger.error(f"Failed to delete file {object_name}: {e}")
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

    async def get_file_info(self, object_name: str) -> FileInfo | None:
        """
        Get file metadata from storage.

        Args:
            object_name: Object path in storage

        Returns:
            FileInfo with metadata or None if not found
        """
        try:
            stat = self.client.stat_object(
                bucket_name=settings.minio_bucket,
                object_name=object_name,
            )
            return FileInfo(
                object_name=object_name,
                file_size=stat.size,
                content_type=stat.content_type,
                last_modified=stat.last_modified.isoformat() if stat.last_modified else None,
            )
        except S3Error:
            return None

    async def copy_file(
        self,
        source_object: str,
        dest_prefix: str = "copies",
    ) -> str:
        """
        Copy a file within the bucket.

        Args:
            source_object: Source object path
            dest_prefix: Destination prefix

        Returns:
            New object path
        """
        from minio.commonconfig import CopySource

        await self.ensure_bucket_exists()

        # Generate new object name
        ext = Path(source_object).suffix
        dest_object = f"{dest_prefix}/{uuid.uuid4().hex}{ext}"

        try:
            self.client.copy_object(
                bucket_name=settings.minio_bucket,
                object_name=dest_object,
                source=CopySource(
                    bucket_name=settings.minio_bucket,
                    object_name=source_object,
                ),
            )
            logger.info(f"Copied file: {source_object} -> {dest_object}")
            return dest_object

        except S3Error as e:
            logger.error(f"Failed to copy file: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to copy file",
            )


# Singleton instance
file_service = FileService()


def get_file_service() -> FileService:
    """Get the file service singleton instance."""
    return file_service
