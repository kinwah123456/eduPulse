from __future__ import annotations


class EduPulseException(Exception):
    """Base exception for all EduPulse errors."""

    def __init__(self, detail: str = "An error occurred") -> None:
        self.detail = detail
        super().__init__(detail)


class NotFoundException(EduPulseException):
    """Resource not found (HTTP 404)."""

    def __init__(self, detail: str = "Resource not found") -> None:
        super().__init__(detail)


class UnauthorizedException(EduPulseException):
    """Authentication required or failed (HTTP 401)."""

    def __init__(self, detail: str = "Not authenticated") -> None:
        super().__init__(detail)


class ForbiddenException(EduPulseException):
    """Insufficient permissions (HTTP 403)."""

    def __init__(self, detail: str = "Permission denied") -> None:
        super().__init__(detail)


class ConflictException(EduPulseException):
    """Duplicate or conflict (HTTP 409)."""

    def __init__(self, detail: str = "Resource already exists") -> None:
        super().__init__(detail)


class ValidationException(EduPulseException):
    """Validation error (HTTP 422)."""

    def __init__(self, detail: str = "Validation error") -> None:
        super().__init__(detail)
