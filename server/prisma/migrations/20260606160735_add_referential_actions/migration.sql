-- DropForeignKey
ALTER TABLE "ApplicantDepartment" DROP CONSTRAINT "ApplicantDepartment_applicantId_fkey";

-- DropForeignKey
ALTER TABLE "ApplicantDepartment" DROP CONSTRAINT "ApplicantDepartment_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "DepartmentMemberAssignment" DROP CONSTRAINT "DepartmentMemberAssignment_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "DepartmentMemberAssignment" DROP CONSTRAINT "DepartmentMemberAssignment_memberId_fkey";

-- DropForeignKey
ALTER TABLE "EventPartner" DROP CONSTRAINT "EventPartner_eventId_fkey";

-- DropForeignKey
ALTER TABLE "EventPartner" DROP CONSTRAINT "EventPartner_partnerId_fkey";

-- AddForeignKey
ALTER TABLE "DepartmentMemberAssignment" ADD CONSTRAINT "DepartmentMemberAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMemberAssignment" ADD CONSTRAINT "DepartmentMemberAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "DepartmentMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantDepartment" ADD CONSTRAINT "ApplicantDepartment_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantDepartment" ADD CONSTRAINT "ApplicantDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPartner" ADD CONSTRAINT "EventPartner_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPartner" ADD CONSTRAINT "EventPartner_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
