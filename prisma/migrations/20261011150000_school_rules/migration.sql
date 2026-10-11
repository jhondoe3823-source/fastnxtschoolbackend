-- CreateTable
CREATE TABLE "school_rules" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'Both',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_rules_schoolId_idx" ON "school_rules"("schoolId");
CREATE INDEX "school_rules_schoolId_audience_idx" ON "school_rules"("schoolId", "audience");
CREATE INDEX "school_rules_schoolId_status_idx" ON "school_rules"("schoolId", "status");

ALTER TABLE "school_rules" ADD CONSTRAINT "school_rules_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
