-- AlterTable: store class teacher employee id
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "teacherId" TEXT;

CREATE INDEX IF NOT EXISTS "classes_teacherId_idx" ON "classes"("teacherId");

-- CreateTable: student attendance
CREATE TABLE "student_attendance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentCode" TEXT,
    "cls" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "remark" TEXT,
    "markedById" TEXT,
    "markedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_attendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_attendance_schoolId_studentId_date_key" ON "student_attendance"("schoolId", "studentId", "date");
CREATE INDEX "student_attendance_schoolId_date_idx" ON "student_attendance"("schoolId", "date");
CREATE INDEX "student_attendance_schoolId_cls_section_date_idx" ON "student_attendance"("schoolId", "cls", "section", "date");
CREATE INDEX "student_attendance_schoolId_studentId_idx" ON "student_attendance"("schoolId", "studentId");

ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: staff attendance
CREATE TABLE "staff_attendance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeCode" TEXT,
    "designation" TEXT,
    "department" TEXT,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inTime" TEXT,
    "outTime" TEXT,
    "remark" TEXT,
    "markedById" TEXT,
    "markedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_attendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_attendance_schoolId_employeeId_date_key" ON "staff_attendance"("schoolId", "employeeId", "date");
CREATE INDEX "staff_attendance_schoolId_date_idx" ON "staff_attendance"("schoolId", "date");
CREATE INDEX "staff_attendance_schoolId_employeeId_idx" ON "staff_attendance"("schoolId", "employeeId");

ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
