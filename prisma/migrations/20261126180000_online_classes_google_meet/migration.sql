-- Google Meet / Online Classes integration

CREATE TABLE "google_integrations" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "googleAccountId" TEXT,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3),
    "scopes" TEXT NOT NULL DEFAULT '',
    "connectionStatus" TEXT NOT NULL DEFAULT 'Connected',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_integrations_schoolId_userId_key" ON "google_integrations"("schoolId", "userId");
CREATE INDEX "google_integrations_schoolId_idx" ON "google_integrations"("schoolId");
CREATE INDEX "google_integrations_userId_idx" ON "google_integrations"("userId");

ALTER TABLE "google_integrations"
  ADD CONSTRAINT "google_integrations_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "online_classes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "teacherUserId" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL DEFAULT '',
    "teacherEmployeeId" TEXT,
    "cls" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "subjectId" TEXT,
    "subjectName" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 45,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "meetingSpaceName" TEXT,
    "meetingUrl" TEXT,
    "meetingCode" TEXT,
    "conferenceRecordName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "studentIds" JSONB,
    "cancelReason" TEXT,
    "googleIntegrationId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "online_classes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "online_classes_schoolId_idx" ON "online_classes"("schoolId");
CREATE INDEX "online_classes_schoolId_status_idx" ON "online_classes"("schoolId", "status");
CREATE INDEX "online_classes_schoolId_teacherUserId_idx" ON "online_classes"("schoolId", "teacherUserId");
CREATE INDEX "online_classes_schoolId_scheduledAt_idx" ON "online_classes"("schoolId", "scheduledAt");
CREATE INDEX "online_classes_schoolId_cls_section_idx" ON "online_classes"("schoolId", "cls", "section");

ALTER TABLE "online_classes"
  ADD CONSTRAINT "online_classes_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "online_class_participants" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "onlineClassId" TEXT NOT NULL,
    "studentId" TEXT,
    "studentName" TEXT NOT NULL DEFAULT '',
    "studentCode" TEXT,
    "googleParticipantName" TEXT,
    "googleParticipantIdentifier" TEXT,
    "googleDisplayName" TEXT,
    "joinTime" TIMESTAMP(3),
    "leaveTime" TIMESTAMP(3),
    "attendedMinutes" INTEGER NOT NULL DEFAULT 0,
    "attendanceStatus" TEXT NOT NULL DEFAULT 'Pending Verification',
    "joinAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastJoinAt" TIMESTAMP(3),
    "manuallyVerified" BOOLEAN NOT NULL DEFAULT false,
    "matchedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "online_class_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "online_class_participants_onlineClassId_studentId_key"
  ON "online_class_participants"("onlineClassId", "studentId");
CREATE INDEX "online_class_participants_schoolId_idx" ON "online_class_participants"("schoolId");
CREATE INDEX "online_class_participants_onlineClassId_idx" ON "online_class_participants"("onlineClassId");
CREATE INDEX "online_class_participants_studentId_idx" ON "online_class_participants"("studentId");

ALTER TABLE "online_class_participants"
  ADD CONSTRAINT "online_class_participants_onlineClassId_fkey"
  FOREIGN KEY ("onlineClassId") REFERENCES "online_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "online_class_attendance_syncs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "onlineClassId" TEXT NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'Pending',
    "lastSyncedAt" TIMESTAMP(3),
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "online_class_attendance_syncs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "online_class_attendance_syncs_schoolId_idx" ON "online_class_attendance_syncs"("schoolId");
CREATE INDEX "online_class_attendance_syncs_onlineClassId_idx" ON "online_class_attendance_syncs"("onlineClassId");

ALTER TABLE "online_class_attendance_syncs"
  ADD CONSTRAINT "online_class_attendance_syncs_onlineClassId_fkey"
  FOREIGN KEY ("onlineClassId") REFERENCES "online_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
