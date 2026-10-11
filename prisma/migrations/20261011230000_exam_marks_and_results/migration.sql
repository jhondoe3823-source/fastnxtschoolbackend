-- AlterTable
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "resultAnnounceDate" TEXT;
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "publishedAt" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "exam_marks" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "slotId" TEXT,
    "branchId" TEXT,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentCode" TEXT,
    "cls" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL,
    "obtained" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 100,
    "grade" TEXT,
    "remark" TEXT,
    "enteredById" TEXT,
    "enteredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_marks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "exam_marks_schoolId_examId_studentId_subject_cls_section_key"
  ON "exam_marks"("schoolId", "examId", "studentId", "subject", "cls", "section");

CREATE INDEX IF NOT EXISTS "exam_marks_schoolId_examId_idx" ON "exam_marks"("schoolId", "examId");
CREATE INDEX IF NOT EXISTS "exam_marks_schoolId_studentId_idx" ON "exam_marks"("schoolId", "studentId");
CREATE INDEX IF NOT EXISTS "exam_marks_schoolId_examId_cls_section_subject_idx"
  ON "exam_marks"("schoolId", "examId", "cls", "section", "subject");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "exam_marks" ADD CONSTRAINT "exam_marks_examId_fkey"
    FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
