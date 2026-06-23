from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.engines.base_engine import BaseEngine


class EngineRegistry:
    """Central registry for pluggable processing engines."""

    _engines: dict[str, BaseEngine] = {}

    @classmethod
    def register(cls, engine: BaseEngine) -> None:
        """Register an engine instance by its name."""
        cls._engines[engine.name] = engine

    @classmethod
    def get(cls, name: str) -> BaseEngine | None:
        """Retrieve a registered engine by name."""
        return cls._engines.get(name)

    @classmethod
    def get_all(cls) -> dict[str, BaseEngine]:
        """Return a copy of all registered engines."""
        return cls._engines.copy()

    @classmethod
    async def initialize_all(cls, config: dict) -> None:
        """Initialize all registered engines with the given configuration."""
        for engine in cls._engines.values():
            await engine.initialize(config)

    @classmethod
    async def health_check_all(cls) -> dict[str, dict]:
        """Run health checks on all registered engines."""
        results: dict[str, dict] = {}
        for name, engine in cls._engines.items():
            try:
                results[name] = await engine.health_check()
            except Exception as e:
                results[name] = {"status": "error", "detail": str(e)}
        return results

    @classmethod
    async def shutdown_all(cls) -> None:
        """Gracefully shut down all registered engines."""
        for engine in cls._engines.values():
            await engine.shutdown()
