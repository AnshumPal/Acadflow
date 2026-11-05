"""
AcadFlow - Database Models for Syllabus Tracking & Lecture Audit.
"""
from datetime import datetime
from sqlalchemy import (
    Boolean, DateTime, Integer, String, UniqueConstraint, ForeignKey
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class SyllabusLedger(Base):
    """One progress ledger per course and section."""
    __tablename__ = "syllabus_ledgers"
    __table_args__ = (
        UniqueConstraint("course_id", "section_id", name="uq_course_section_ledger"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    course_id: Mapped[str] = mapped_column(String(100), index=True)
    section_id: Mapped[str] = mapped_column(String(100), index=True)
    regular_target: Mapped[int] = mapped_column(Integer, default=36)
    extra_target: Mapped[int] = mapped_column(Integer, default=3)
    regular_completed: Mapped[int] = mapped_column(Integer, default=0)
    extra_completed: Mapped[int] = mapped_column(Integer, default=0)
    extra_scheduled: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    lecture_logs: Mapped[list["LectureLog"]] = relationship(
        back_populates="ledger", cascade="all, delete-orphan"
    )


class LectureLog(Base):
    """Audit trail for completed lectures; request_id prevents duplicate submissions."""
    __tablename__ = "lecture_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ledger_id: Mapped[int] = mapped_column(
        ForeignKey("syllabus_ledgers.id"), index=True
    )
    lecture_type: Mapped[str] = mapped_column(String(20))
    request_id: Mapped[str | None] = mapped_column(
        String(100), unique=True, nullable=True, index=True
    )
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ledger: Mapped[SyllabusLedger] = relationship(back_populates="lecture_logs")

