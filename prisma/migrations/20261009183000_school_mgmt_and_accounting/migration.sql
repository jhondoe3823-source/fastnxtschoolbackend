-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "role_permissions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tickets" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "raisedBy" TEXT NOT NULL,
    "assignedTo" TEXT,
    "due" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "employees" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT DEFAULT 'Male',
    "dob" TEXT,
    "cnic" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "photo" TEXT,
    "designation" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "joining" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Permanent',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "documents" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "job_letters" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "employeeId" TEXT,
    "employee" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "classes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "session" TEXT DEFAULT '2025-2026',
    "sections" JSONB NOT NULL,
    "teacher" TEXT,
    "students" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "subjects" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Core',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "subject_assignments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "classId" TEXT,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "subjectId" TEXT,
    "subjectName" TEXT NOT NULL,
    "teacherId" TEXT,
    "teacherName" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "students" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "studentId" TEXT NOT NULL,
    "admissionNo" TEXT,
    "admissionDate" TEXT,
    "name" TEXT NOT NULL,
    "gender" TEXT DEFAULT 'Male',
    "dob" TEXT,
    "blood" TEXT,
    "photo" TEXT,
    "session" TEXT DEFAULT '2025-2026',
    "cls" TEXT NOT NULL,
    "classId" TEXT,
    "section" TEXT NOT NULL,
    "father" TEXT,
    "mother" TEXT,
    "guardian" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "prevSchool" TEXT,
    "medical" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "admission_letters" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "studentId" TEXT,
    "student" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "cls" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "families" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "familyCode" TEXT NOT NULL,
    "guardian" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "admission_enquiries" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "applicant" TEXT NOT NULL,
    "guardian" TEXT,
    "phone" TEXT,
    "cls" TEXT,
    "source" TEXT,
    "followUp" TEXT,
    "counselor" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'Enquiry',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "visitors" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "visitor" TEXT NOT NULL,
    "phone" TEXT,
    "purpose" TEXT,
    "host" TEXT,
    "badge" TEXT,
    "date" TEXT,
    "inTime" TEXT,
    "outTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'In',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notices" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "audience" TEXT,
    "channel" TEXT,
    "type" TEXT,
    "date" TEXT,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "author" TEXT,
    "authorId" TEXT,
    "cls" TEXT,
    "section" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "events" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "venue" TEXT,
    "audience" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Upcoming',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "meetings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "title" TEXT NOT NULL,
    "date" TEXT,
    "time" TEXT,
    "venue" TEXT,
    "organizer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "description" TEXT,
    "participants" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vehicles" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Bus',
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "driver" TEXT NOT NULL,
    "driverPhone" TEXT,
    "route" TEXT,
    "fitness" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "transport_routes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "stops" INTEGER NOT NULL DEFAULT 1,
    "distance" TEXT,
    "students" INTEGER NOT NULL DEFAULT 0,
    "monthlyFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vehicleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "hostel_rooms" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "hostel" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Double',
    "beds" INTEGER NOT NULL DEFAULT 2,
    "occupied" INTEGER NOT NULL DEFAULT 0,
    "warden" TEXT,
    "monthlyFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Available',
    "residents" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hostel_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "timetable_slots" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "cls" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "subject" TEXT NOT NULL,
    "teacher" TEXT NOT NULL,
    "teacherId" TEXT,
    "room" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "homework" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "branchId" TEXT,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "cls" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "teacher" TEXT NOT NULL,
    "teacherId" TEXT,
    "assigned" TEXT NOT NULL,
    "due" TEXT NOT NULL,
    "instructions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "submitted" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "accounts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parent" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "fiscal_years" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "accounting_period" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "journal_entries" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL DEFAULT '',
    "postedAt" TIMESTAMP(3),
    "reversedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "journal_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "debit" INTEGER NOT NULL DEFAULT 0,
    "credit" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vouchers" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "party" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'Cash',
    "reference" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "total" INTEGER NOT NULL,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "accountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "budgets" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "spent" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "bank_accounts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'Bank',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "bank_transactions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "bookAmount" INTEGER NOT NULL DEFAULT 0,
    "bankAmount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Unmatched',
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "role_permissions_schoolId_idx" ON "role_permissions"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_schoolId_role_key" ON "role_permissions"("schoolId", "role");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tickets_schoolId_idx" ON "tickets"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employees_schoolId_idx" ON "employees"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "job_letters_schoolId_idx" ON "job_letters"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "classes_schoolId_idx" ON "classes"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "classes_status_idx" ON "classes"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subjects_schoolId_idx" ON "subjects"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subjects_status_idx" ON "subjects"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subject_assignments_schoolId_idx" ON "subject_assignments"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subject_assignments_className_idx" ON "subject_assignments"("className");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "students_schoolId_idx" ON "students"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "students_cls_idx" ON "students"("cls");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "students_status_idx" ON "students"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admission_letters_schoolId_idx" ON "admission_letters"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "families_schoolId_idx" ON "families"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "families_status_idx" ON "families"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admission_enquiries_schoolId_idx" ON "admission_enquiries"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admission_enquiries_stage_idx" ON "admission_enquiries"("stage");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "visitors_schoolId_idx" ON "visitors"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "visitors_status_idx" ON "visitors"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notices_schoolId_idx" ON "notices"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "events_schoolId_idx" ON "events"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "meetings_schoolId_idx" ON "meetings"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vehicles_schoolId_idx" ON "vehicles"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "transport_routes_schoolId_idx" ON "transport_routes"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "hostel_rooms_schoolId_idx" ON "hostel_rooms"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "timetable_slots_schoolId_idx" ON "timetable_slots"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "timetable_slots_schoolId_branchId_idx" ON "timetable_slots"("schoolId", "branchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "timetable_slots_schoolId_teacher_idx" ON "timetable_slots"("schoolId", "teacher");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "timetable_slots_schoolId_cls_section_idx" ON "timetable_slots"("schoolId", "cls", "section");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "homework_schoolId_idx" ON "homework"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "homework_schoolId_branchId_idx" ON "homework"("schoolId", "branchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "homework_schoolId_teacher_idx" ON "homework"("schoolId", "teacher");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "homework_schoolId_cls_section_idx" ON "homework"("schoolId", "cls", "section");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "accounts_schoolId_idx" ON "accounts"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "accounts_schoolId_type_idx" ON "accounts"("schoolId", "type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_schoolId_code_key" ON "accounts"("schoolId", "code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "fiscal_years_schoolId_idx" ON "fiscal_years"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_years_schoolId_name_key" ON "fiscal_years"("schoolId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "accounting_period_fiscalYearId_idx" ON "accounting_period"("fiscalYearId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "journal_entries_schoolId_idx" ON "journal_entries"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "journal_entries_schoolId_status_idx" ON "journal_entries"("schoolId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "journal_entries_schoolId_date_idx" ON "journal_entries"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_schoolId_no_key" ON "journal_entries"("schoolId", "no");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "journal_lines_entryId_idx" ON "journal_lines"("entryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "journal_lines_accountId_idx" ON "journal_lines"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vouchers_schoolId_idx" ON "vouchers"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vouchers_schoolId_kind_idx" ON "vouchers"("schoolId", "kind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vouchers_schoolId_status_idx" ON "vouchers"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vouchers_schoolId_no_key" ON "vouchers"("schoolId", "no");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_schoolId_idx" ON "invoices"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "invoices_schoolId_status_idx" ON "invoices"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_schoolId_invoiceNo_key" ON "invoices"("schoolId", "invoiceNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "budgets_schoolId_idx" ON "budgets"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "budgets_schoolId_name_year_key" ON "budgets"("schoolId", "name", "year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bank_accounts_schoolId_idx" ON "bank_accounts"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "bank_accounts_schoolId_name_key" ON "bank_accounts"("schoolId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bank_transactions_bankAccountId_idx" ON "bank_transactions"("bankAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bank_transactions_schoolId_idx" ON "bank_transactions"("schoolId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_branchId_idx" ON "users"("branchId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "tickets" ADD CONSTRAINT "tickets_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "employees" ADD CONSTRAINT "employees_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "job_letters" ADD CONSTRAINT "job_letters_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "classes" ADD CONSTRAINT "classes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "subjects" ADD CONSTRAINT "subjects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "subject_assignments" ADD CONSTRAINT "subject_assignments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "students" ADD CONSTRAINT "students_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "admission_letters" ADD CONSTRAINT "admission_letters_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "families" ADD CONSTRAINT "families_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "admission_enquiries" ADD CONSTRAINT "admission_enquiries_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "visitors" ADD CONSTRAINT "visitors_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "notices" ADD CONSTRAINT "notices_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "events" ADD CONSTRAINT "events_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "meetings" ADD CONSTRAINT "meetings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "homework" ADD CONSTRAINT "homework_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "accounting_period" ADD CONSTRAINT "accounting_period_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "budgets" ADD CONSTRAINT "budgets_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

