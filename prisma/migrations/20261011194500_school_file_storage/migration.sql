-- Track Cloudinary uploads per school for storage usage reporting
CREATE TABLE IF NOT EXISTS "school_files" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT '',
    "resourceType" TEXT NOT NULL DEFAULT 'image',
    "format" TEXT,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "originalName" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'other',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_files_schoolId_idx" ON "school_files"("schoolId");
CREATE INDEX IF NOT EXISTS "school_files_schoolId_purpose_idx" ON "school_files"("schoolId", "purpose");
CREATE INDEX IF NOT EXISTS "school_files_publicId_idx" ON "school_files"("publicId");

ALTER TABLE "school_files"
  ADD CONSTRAINT "school_files_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
