"""Job handler registry."""

from collections.abc import Awaitable, Callable

from katibay_api.jobs.queue import Job

JobHandler = Callable[[Job], Awaitable[None]]


class HandlerRegistry:
    """Registry mapping job kinds to execution handlers."""

    def __init__(self) -> None:
        self._handlers: dict[str, JobHandler] = {}

    def register(self, kind: str, handler: JobHandler) -> None:
        self._handlers[kind] = handler

    def get(self, kind: str) -> JobHandler | None:
        return self._handlers.get(kind)

    def registered_kinds(self) -> list[str]:
        return list(self._handlers.keys())


handler_registry = HandlerRegistry()


def register_handler(kind: str) -> Callable[[JobHandler], JobHandler]:
    """Decorator to register a job handler."""

    def decorator(fn: JobHandler) -> JobHandler:
        handler_registry.register(kind, fn)
        return fn

    return decorator
