"""
DOCX to HTML conversion service using mammoth.
Converts DOCX files to HTML for preview while preserving formatting.
"""
import hashlib
import json
import asyncio
import re
import io
from pathlib import Path
from typing import Any
from datetime import datetime, timedelta, timezone
import aiofiles
import mammoth


class ConversionError(Exception):
    """Error during DOCX to HTML conversion."""
    pass


class HtmlCache:
    """File-based cache for converted HTML."""

    def __init__(self, cache_dir: str = "/tmp/html_cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_ttl = timedelta(days=7)

    def _get_cache_key(self, file_hash: str) -> str:
        """Generate cache key from file hash."""
        return hashlib.md5(file_hash.encode()).hexdigest()

    def _get_cache_path(self, cache_key: str) -> Path:
        """Get cache file path."""
        return self.cache_dir / f"{cache_key}.json"

    async def get(self, file_hash: str) -> dict[str, Any] | None:
        """Get cached conversion result."""
        cache_key = self._get_cache_key(file_hash)
        cache_path = self._get_cache_path(cache_key)

        if not cache_path.exists():
            return None

        try:
            async with aiofiles.open(cache_path, 'r', encoding='utf-8') as f:
                data = json.loads(await f.read())

            # Check expiration
            cached_at = datetime.fromisoformat(data.get("cached_at", ""))
            if cached_at.tzinfo is None:
                cached_at = cached_at.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - cached_at > self.cache_ttl:
                cache_path.unlink()
                return None

            return data.get("result")
        except Exception:
            return None

    async def set(self, file_hash: str, result: dict[str, Any]):
        """Cache conversion result."""
        cache_key = self._get_cache_key(file_hash)
        cache_path = self._get_cache_path(cache_key)

        data = {
            "cached_at": datetime.now(timezone.utc).isoformat(),
            "file_hash": file_hash,
            "result": result,
        }

        try:
            async with aiofiles.open(cache_path, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(data, ensure_ascii=False))
        except Exception:
            pass  # Caching failures are not critical

    async def invalidate(self, file_hash: str):
        """Invalidate cache entry."""
        cache_key = self._get_cache_key(file_hash)
        cache_path = self._get_cache_path(cache_key)
        if cache_path.exists():
            cache_path.unlink()


class DocxConverter:
    """
    Service for converting DOCX files to HTML using mammoth.
    Preserves formatting including headings, lists, tables, bold, and italic.
    """

    # Mammoth style map for custom HTML output
    STYLE_MAP = """
    p[style-name='Heading 1'] => h1:fresh
    p[style-name='Heading 2'] => h2:fresh
    p[style-name='Heading 3'] => h3:fresh
    p[style-name='Heading 4'] => h4:fresh
    p[style-name='Heading 5'] => h5:fresh
    p[style-name='Heading 6'] => h6:fresh
    p[style-name='Title'] => h1:fresh
    p[style-name='Subtitle'] => h2:fresh
    p => p:fresh
    r[style-name='Strong'] => strong
    r[style-name='Bold'] => strong
    r[style-name='Italic'] => em
    r[style-name='Emphasis'] => em
    r[style-name='Underline'] => u
    r[style-name='Strikethrough'] => strike
    table => table
    tr => tr
    td => td
    th => th
    tc => td
    p[style-name='Normal'] => p:fresh
    p[style-name='List Paragraph'] => li:fresh
    p[style-name='List'] => li:fresh
    """

    def __init__(self):
        self._cache = HtmlCache()

    def _compute_file_hash(self, content: bytes) -> str:
        """Compute MD5 hash of file content."""
        return hashlib.md5(content).hexdigest()

    async def convert_to_html(
        self,
        content: bytes,
        use_cache: bool = True,
    ) -> dict[str, Any]:
        """
        Convert DOCX content to HTML.

        Args:
            content: DOCX file content as bytes
            use_cache: Whether to use caching (default: True)

        Returns:
            Dictionary with:
            - html: Converted HTML string
            - text: Plain text extracted from document
            - messages: List of conversion messages (warnings, info)
        """
        file_hash = self._compute_file_hash(content)

        # Check cache
        if use_cache:
            cached = await self._cache.get(file_hash)
            if cached:
                return cached

        # Perform conversion
        result = await self._convert(content)

        # Cache result
        if use_cache:
            await self._cache.set(file_hash, result)

        return result

    async def _convert(self, content: bytes) -> dict[str, Any]:
        """
        Internal method to perform DOCX to HTML conversion.

        Args:
            content: DOCX file content as bytes

        Returns:
            Dictionary with html, text, and messages
        """
        def _do_conversion() -> dict[str, Any]:
            try:
                # Convert DOCX to HTML using mammoth
                # mammoth requires a file-like object, so we wrap bytes in BytesIO
                result = mammoth.convert_to_html(
                    io.BytesIO(content),
                    style_map=self.STYLE_MAP,
                )

                html = result.value
                messages = result.messages

                # Extract plain text from the HTML
                text = self._html_to_text(html)

                return {
                    "html": html,
                    "text": text,
                    "messages": messages,
                }

            except Exception as e:
                raise ConversionError(f"Failed to convert DOCX to HTML: {str(e)}")

        # Run in thread pool to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _do_conversion)

    def _html_to_text(self, html: str) -> str:
        """
        Extract plain text from HTML.

        Simple implementation that removes HTML tags while preserving
        paragraph breaks.
        """
        # Replace block elements with newlines
        text = re.sub(r'</?(?:p|div|h[1-6]|li|tr)[^>]*>', '\n', html, flags=re.IGNORECASE)

        # Remove remaining HTML tags
        text = re.sub(r'<[^>]+>', '', text)

        # Decode HTML entities
        text = text.replace('&nbsp;', ' ')
        text = text.replace('&amp;', '&')
        text = text.replace('&lt;', '<')
        text = text.replace('&gt;', '>')
        text = text.replace('&quot;', '"')
        text = text.replace('&#39;', "'")

        # Clean up whitespace
        text = re.sub(r'\n\s*\n', '\n\n', text)
        text = text.strip()

        return text

    async def get_html_preview(
        self,
        content: bytes,
        max_chars: int = 5000,
    ) -> str:
        """
        Get a short HTML preview for display.

        Args:
            content: DOCX file content as bytes
            max_chars: Maximum number of characters in preview

        Returns:
            HTML preview string
        """
        try:
            result = await self.convert_to_html(content)
            html = result.get("html", "")
            if len(html) > max_chars:
                html = html[:max_chars] + "..."
            return html
        except ConversionError:
            return ""


# Singleton instance
_docx_converter: DocxConverter | None = None


def get_docx_converter() -> DocxConverter:
    """Get singleton DocxConverter instance."""
    global _docx_converter
    if _docx_converter is None:
        _docx_converter = DocxConverter()
    return _docx_converter
