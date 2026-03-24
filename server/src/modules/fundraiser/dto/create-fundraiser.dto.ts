import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUrl } from "class-validator";
import { FundraiserStatus } from "../enums/fundraiser.status.enum";
import { Type } from "class-transformer";

export class CreateFundraiserDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEnum(FundraiserStatus)
    status: FundraiserStatus;

    @IsString()
    @IsOptional()
    description?: string;

    @IsNumber()
    @IsPositive()
    @Type(() => Number)
    goalAmount: number;

    @IsNumber()
    @IsPositive()
    @Type(() => Number)
    currentAmount: number;

    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    startDate: Date;

    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    endDate: Date;

    @IsString()
    @IsUrl()
    @IsNotEmpty()
    detailsLink: string;
}
