from __future__ import annotations

from abc import ABC, abstractmethod


class BaseEngine(ABC):
    """Abstract base class for all EduPulse processing engines.

    To add a new engine:
    1. Create a new directory under app/engines/
    2. Subclass BaseEngine
    3. Register via EngineRegistry.register()
    """

    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def version(self) -> str: ...

    @abstractmethod
    async def initialize(self, config: dict) -> None: ...

    @abstractmethod
    async def process(self, payload: dict) -> dict: ...

    @abstractmethod
    async def health_check(self) -> dict: ...

    async def shutdown(self) -> None:
        pass
