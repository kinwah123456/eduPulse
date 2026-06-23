from __future__ import annotations

from app.engines.base_engine import BaseEngine


class OMREngine(BaseEngine):
    """Engine for grading multiple choice tests (OMR sheets)."""

    @property
    def name(self) -> str:
        return "OMREngine"

    @property
    def version(self) -> str:
        return "1.0.0"

    async def initialize(self, config: dict) -> None:
        pass

    async def process(self, payload: dict) -> dict:
        """Process multiple choice responses.

        Payload structure:
        {
            "student_response": {"1": "A", "2": "C", ...},
            "answer_key": {"1": "A", "2": "B", ...}
        }
        """
        student_response = payload.get("student_response") or {}
        answer_key = payload.get("answer_key") or {}

        if not answer_key:
            return {
                "score": 0.0,
                "correct_count": 0,
                "incorrect_count": 0,
                "total_questions": 0,
                "breakdown": {},
                "message": "Error: Answer key is empty."
            }

        total_questions = len(answer_key)
        correct_count = 0
        breakdown = {}

        for q_num, correct_ans in answer_key.items():
            student_ans = student_response.get(q_num)
            is_correct = (student_ans == correct_ans)
            if is_correct:
                correct_count += 1
            breakdown[q_num] = {
                "expected": correct_ans,
                "student": student_ans,
                "correct": is_correct
            }

        score = (correct_count / total_questions) * 100.0 if total_questions > 0 else 0.0
        incorrect_count = total_questions - correct_count

        return {
            "score": round(score, 2),
            "correct_count": correct_count,
            "incorrect_count": incorrect_count,
            "total_questions": total_questions,
            "breakdown": breakdown,
            "message": f"Graded successfully. Score: {correct_count}/{total_questions} ({score:.1f}%)"
        }

    async def health_check(self) -> dict:
        return {"status": "healthy", "engine": self.name, "version": self.version}
