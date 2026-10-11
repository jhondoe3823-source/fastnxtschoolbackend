-- Exam module: sessions, class-wise paper timetable, question paper submissions

CREATE TABLE IF NOT EXISTS "exams" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "paperSubmitFrom" TEXT,
    "paperSubmitTo" TEXT,
    "classes" JSONB NOT NULL DEFAULT '[]',
    "classesCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "notifyNote" TEXT,
    "notifiedAt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "exam_paper_slots" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "branchId" TEXT,
    "cls" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL,
    "subjectId" TEXT,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT,
    "invigilator" TEXT,
    "teacherId" TEXT,
    "teacherName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exam_paper_slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "question_paper_submissions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "slotId" TEXT,
    "branchId" TEXT,
    "cls" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL,
    "teacherId" TEXT,
    "teacherName" TEXT NOT NULL,
    "employeeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "note" TEXT,
    "files" JSONB NOT NULL DEFAULT '[]',
    "submittedAt" TEXT,
    "reviewedAt" TEXT,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "question_paper_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "exams_schoolId_idx" ON "exams"("schoolId");
CREATE INDEX IF NOT EXISTS "exams_schoolId_branchId_idx" ON "exams"("schoolId", "branchId");
CREATE INDEX IF NOT EXISTS "exams_schoolId_status_idx" ON "exams"("schoolId", "status");

CREATE INDEX IF NOT EXISTS "exam_paper_slots_schoolId_idx" ON "exam_paper_slots"("schoolId");
CREATE INDEX IF NOT EXISTS "exam_paper_slots_schoolId_examId_idx" ON "exam_paper_slots"("schoolId", "examId");
CREATE INDEX IF NOT EXISTS "exam_paper_slots_schoolId_teacherId_idx" ON "exam_paper_slots"("schoolId", "teacherId");
CREATE INDEX IF NOT EXISTS "exam_paper_slots_schoolId_cls_subject_idx" ON "exam_paper_slots"("schoolId", "cls", "subject");

CREATE INDEX IF NOT EXISTS "question_paper_submissions_schoolId_idx" ON "question_paper_submissions"("schoolId");
CREATE INDEX IF NOT EXISTS "question_paper_submissions_schoolId_examId_idx" ON "question_paper_submissions"("schoolId", "examId");
CREATE INDEX IF NOT EXISTS "question_paper_submissions_schoolId_teacherId_idx" ON "question_paper_submissions"("schoolId", "teacherId");
CREATE INDEX IF NOT EXISTS "question_paper_submissions_schoolId_slotId_idx" ON "question_paper_submissions"("schoolId", "slotId");

ALTER TABLE "exams" ADD CONSTRAINT "exams_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exam_paper_slots" ADD CONSTRAINT "exam_paper_slots_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exam_paper_slots" ADD CONSTRAINT "exam_paper_slots_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "question_paper_submissions" ADD CONSTRAINT "question_paper_submissions_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "question_paper_submissions" ADD CONSTRAINT "question_paper_submissions_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "question_paper_submissions" ADD CONSTRAINT "question_paper_submissions_slotId_fkey"
  FOREIGN KEY ("slotId") REFERENCES "exam_paper_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
