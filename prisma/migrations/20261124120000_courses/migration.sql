-- School course catalog, plus the course stored on a student and an admission letter.

CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "duration" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "courses_schoolId_name_key" ON "courses"("schoolId", "name");
CREATE INDEX "courses_schoolId_idx" ON "courses"("schoolId");
CREATE INDEX "courses_category_idx" ON "courses"("category");

ALTER TABLE "courses" ADD CONSTRAINT "courses_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "students" ADD COLUMN "course" TEXT;
ALTER TABLE "students" ADD COLUMN "courseId" TEXT;
CREATE INDEX "students_course_idx" ON "students"("course");

ALTER TABLE "admission_letters" ADD COLUMN "course" TEXT;
