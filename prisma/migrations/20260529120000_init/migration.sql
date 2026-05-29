-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executors" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'permanent',
    "companyStatus" TEXT,
    "legalForm" TEXT,
    "recipientType" TEXT,
    "specialty" TEXT,
    "contractFile" TEXT,
    "ndaFile" TEXT,
    "inTgChat" BOOLEAN NOT NULL DEFAULT false,
    "contacts" TEXT,
    "requisites" TEXT,
    "note" TEXT,
    "defaultBankAccountId" TEXT,
    "responsibleUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "accessRevokedAt" TIMESTAMP(3),
    "onboardingSeeded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "responsibleUserId" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_work_types" (
    "projectId" TEXT NOT NULL,
    "workTypeId" TEXT NOT NULL,

    CONSTRAINT "project_work_types_pkey" PRIMARY KEY ("projectId","workTypeId")
);

-- CreateTable
CREATE TABLE "project_executors" (
    "projectId" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,

    CONSTRAINT "project_executors_pkey" PRIMARY KEY ("projectId","executorId")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "details" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "work_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executor_work_types" (
    "executorId" TEXT NOT NULL,
    "workTypeId" TEXT NOT NULL,

    CONSTRAINT "executor_work_types_pkey" PRIMARY KEY ("executorId","workTypeId")
);

-- CreateTable
CREATE TABLE "works" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "workTypeId" TEXT NOT NULL,
    "executionYear" INTEGER NOT NULL,
    "executionMonth" INTEGER NOT NULL,
    "techTask" TEXT,
    "report" TEXT,
    "link" TEXT,
    "volume" DOUBLE PRECISION,
    "rate" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL,
    "plannedPayAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "filledTechTask" TEXT,
    "filledAct" TEXT,
    "workStatus" TEXT NOT NULL DEFAULT 'submitted',
    "checkedAt" TIMESTAMP(3),
    "comment" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'planned',
    "plannedPayAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "bankAccountId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "other_expenses" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "workTypeId" TEXT NOT NULL,
    "responsibleUserId" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "executionYear" INTEGER NOT NULL,
    "executionMonth" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentAmount" DOUBLE PRECISION,
    "plannedPayAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3),
    "workStatus" TEXT NOT NULL DEFAULT 'submitted',
    "paymentStatus" TEXT NOT NULL DEFAULT 'planned',
    "preferredPayMethod" TEXT,
    "comment" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "other_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charges" (
    "id" TEXT NOT NULL,
    "chargeNumber" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "issuedPlanAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "paidPlanAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentPurpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "documents" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_operations" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spending_plan_lines" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "workTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "sourceType" TEXT,
    "comment" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spending_plan_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacation_entries" (
    "id" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "daysCount" INTEGER NOT NULL,
    "secondStartAt" TIMESTAMP(3),
    "secondEndAt" TIMESTAMP(3),
    "secondDaysCount" INTEGER,
    "substituteContacts" TEXT,
    "status" TEXT NOT NULL DEFAULT 'need_approval',
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "executorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "plannedDoneAt" TIMESTAMP(3),
    "result" TEXT,
    "comment" TEXT,
    "isOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashflow_opening_balances" (
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cashflow_opening_balances_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT,
    "changes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "executors_userId_key" ON "executors"("userId");

-- CreateIndex
CREATE INDEX "executors_status_idx" ON "executors"("status");

-- CreateIndex
CREATE INDEX "executors_type_idx" ON "executors"("type");

-- CreateIndex
CREATE UNIQUE INDEX "clients_name_key" ON "clients"("name");

-- CreateIndex
CREATE INDEX "projects_responsibleUserId_idx" ON "projects"("responsibleUserId");

-- CreateIndex
CREATE INDEX "projects_clientId_idx" ON "projects"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_clientId_shortName_key" ON "projects"("clientId", "shortName");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_name_key" ON "bank_accounts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "work_types_name_key" ON "work_types"("name");

-- CreateIndex
CREATE INDEX "works_executorId_executionYear_executionMonth_idx" ON "works"("executorId", "executionYear", "executionMonth");

-- CreateIndex
CREATE INDEX "works_projectId_idx" ON "works"("projectId");

-- CreateIndex
CREATE INDEX "works_workStatus_idx" ON "works"("workStatus");

-- CreateIndex
CREATE INDEX "payments_executorId_periodYear_periodMonth_idx" ON "payments"("executorId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "payments_paymentStatus_idx" ON "payments"("paymentStatus");

-- CreateIndex
CREATE INDEX "other_expenses_projectId_idx" ON "other_expenses"("projectId");

-- CreateIndex
CREATE INDEX "other_expenses_executorId_idx" ON "other_expenses"("executorId");

-- CreateIndex
CREATE INDEX "other_expenses_responsibleUserId_idx" ON "other_expenses"("responsibleUserId");

-- CreateIndex
CREATE INDEX "other_expenses_workStatus_idx" ON "other_expenses"("workStatus");

-- CreateIndex
CREATE INDEX "other_expenses_paymentStatus_idx" ON "other_expenses"("paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "charges_chargeNumber_key" ON "charges"("chargeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "charges_invoiceNumber_key" ON "charges"("invoiceNumber");

-- CreateIndex
CREATE INDEX "charges_bankAccountId_idx" ON "charges"("bankAccountId");

-- CreateIndex
CREATE INDEX "charges_orderId_idx" ON "charges"("orderId");

-- CreateIndex
CREATE INDEX "charges_status_idx" ON "charges"("status");

-- CreateIndex
CREATE INDEX "bank_operations_bankAccountId_idx" ON "bank_operations"("bankAccountId");

-- CreateIndex
CREATE INDEX "bank_operations_date_idx" ON "bank_operations"("date");

-- CreateIndex
CREATE INDEX "spending_plan_lines_projectId_year_week_idx" ON "spending_plan_lines"("projectId", "year", "week");

-- CreateIndex
CREATE INDEX "vacation_entries_executorId_idx" ON "vacation_entries"("executorId");

-- CreateIndex
CREATE INDEX "vacation_entries_status_idx" ON "vacation_entries"("status");

-- CreateIndex
CREATE INDEX "tasks_executorId_status_idx" ON "tasks"("executorId", "status");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_createdAt_idx" ON "activity_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "executors" ADD CONSTRAINT "executors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executors" ADD CONSTRAINT "executors_defaultBankAccountId_fkey" FOREIGN KEY ("defaultBankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executors" ADD CONSTRAINT "executors_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work_types" ADD CONSTRAINT "project_work_types_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work_types" ADD CONSTRAINT "project_work_types_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "work_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_executors" ADD CONSTRAINT "project_executors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_executors" ADD CONSTRAINT "project_executors_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "executors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executor_work_types" ADD CONSTRAINT "executor_work_types_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "executors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executor_work_types" ADD CONSTRAINT "executor_work_types_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "work_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "works" ADD CONSTRAINT "works_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "works" ADD CONSTRAINT "works_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "executors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "works" ADD CONSTRAINT "works_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "work_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "works" ADD CONSTRAINT "works_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "executors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_expenses" ADD CONSTRAINT "other_expenses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_expenses" ADD CONSTRAINT "other_expenses_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "executors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_expenses" ADD CONSTRAINT "other_expenses_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "work_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_expenses" ADD CONSTRAINT "other_expenses_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_expenses" ADD CONSTRAINT "other_expenses_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "other_expenses" ADD CONSTRAINT "other_expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_operations" ADD CONSTRAINT "bank_operations_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spending_plan_lines" ADD CONSTRAINT "spending_plan_lines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spending_plan_lines" ADD CONSTRAINT "spending_plan_lines_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "executors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spending_plan_lines" ADD CONSTRAINT "spending_plan_lines_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "work_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spending_plan_lines" ADD CONSTRAINT "spending_plan_lines_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation_entries" ADD CONSTRAINT "vacation_entries_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "executors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation_entries" ADD CONSTRAINT "vacation_entries_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_executorId_fkey" FOREIGN KEY ("executorId") REFERENCES "executors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

