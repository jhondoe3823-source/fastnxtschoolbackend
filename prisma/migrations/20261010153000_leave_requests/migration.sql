-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "applicantType" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "cls" TEXT,
    "section" TEXT,
    "studentId" TEXT,
    "employeeId" TEXT,
    "type" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "reviewedById" TEXT,
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leave_requests_schoolId_status_idx" ON "leave_requests"("schoolId", "status");
CREATE INDEX "leave_requests_schoolId_applicantType_idx" ON "leave_requests"("schoolId", "applicantType");
CREATE INDEX "leave_requests_schoolId_studentId_idx" ON "leave_requests"("schoolId", "studentId");
CREATE INDEX "leave_requests_schoolId_employeeId_idx" ON "leave_requests"("schoolId", "employeeId");
CREATE INDEX "leave_requests_schoolId_cls_section_idx" ON "leave_requests"("schoolId", "cls", "section");

ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
