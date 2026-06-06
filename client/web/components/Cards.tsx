import { TeamMember, Event, CharityCampaign } from '../app/types';

export const EventCard = ({event}: {event: Event}) => (
    <div className="p-4 border">Захід: {event.title}</div>
);

export const CharityCard = ({campaign}: {campaign: CharityCampaign}) => (
    <div className="p-4 border bg-green-50">Збір: {campaign.title}</div>
);

export const MemberCard = ({member}: {member: TeamMember}) => (
    <div className="p-4 border rounded-full">Команда: {member.name} - {member.position}</div>
)
