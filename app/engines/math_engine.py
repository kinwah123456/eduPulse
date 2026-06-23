from __future__ import annotations

from app.engines.base_engine import BaseEngine


class MathEngine(BaseEngine):
    """Engine for grading mathematical expressions (Placeholder/Stub)."""

    @property
    def name(self) -> str:
        return "MathEngine"

    @property
    def version(self) -> str:
        return "0.1.0"

    async def initialize(self, config: dict) -> None:
        pass

    async def process(self, payload: dict) -> dict:
        """Stub process for math grading.

        Payload structure:
        {
            "student_response": "x = 5",
            "expected_answer": "x = 5"
        }
        """
        student_response = str(payload.get("student_response") or "").strip().lower()
        expected_answer = str(payload.get("expected_answer") or "").strip().lower()

        is_correct = (student_response == expected_answer)
        score = 100.0 if is_correct else 0.0

        return {
            "score": score,
            "correct_count": 1 if is_correct else 0,
            "incorrect_count": 0 if is_correct else 1,
            "total_questions": 1,
            "breakdown": {
                "1": {
                    "expected": expected_answer,
                    "student": student_response,
                    "correct": is_correct
                }
            },
            "message": f"Math Grading (Stub). Correct: {is_correct}. Score: {score}%"
        }

    async def health_check(self) -> dict:
        return {"status": "healthy", "engine": self.name, "version": self.version}
