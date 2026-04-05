export interface TeamMember {
    id: string;
    name: string;
    position: string;
    photoUrl: string;
    description: string;
    telegram: string;
}

export interface AboutSection{
    mission: string;
    vision: string;
    values: string;
    whoAreWe: string;
}

export interface Event{
    id: string;
    title: string;
    date: string;
    photoUrl: string;
    description: string;
    location: string;
}

export interface CharityCampaign{
    id: string;
    title: string;
    amount: string;
    description: string;
    date: string;
    progress: number;
    closed: boolean;
}

export interface Partner {
    id: string;
    name: string;
    logoUrl: string;
}

export interface JoinApplication{
    fullName: string;
    telegram: string;
    group: string;
    contact: string;
    motivation: string;
    departments: string[];
    experience: string;
}